const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper functions
function safeConvertToInt(value) {
    if (!value || value === 'na' || value === '-' || value === null) {
        return 0;
    }
    if (typeof value === 'string') {
        // Handle "x/y" format - take only the first number
        if (value.includes('/')) {
            value = value.split('/')[0].trim();
        }
        // Remove non-numeric characters
        value = value.replace(/[^\d]/g, '');
        if (!value) return 0;
    }
    try {
        return parseInt(value) || 0;
    } catch {
        return 0;
    }
}

function safeConvertToFloat(value) {
    if (!value || value === 'na' || value === '-' || value === null) {
        return 0.0;
    }
    if (typeof value === 'string') {
        value = value.replace(/[^\d.]/g, '');
        if (!value) return 0.0;
    }
    try {
        return parseFloat(value) || 0.0;
    } catch {
        return 0.0;
    }
}

function parseExcelData(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const processedData = [];
    
    // Skip header rows and process data
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Skip if no date or invalid date format
        if (!row[0] || typeof row[0] !== 'string' || !row[0].includes('-')) {
            continue;
        }
        
        const data = {
            วันเดือนปี: row[0],
            เสียชีวิต: safeConvertToInt(row[3]),
            รวม: safeConvertToInt(row[5]),
            EMS: safeConvertToInt(row[6]),
            Admit: safeConvertToInt(row[8])
        };
        
        // Handle drink driving data (format: "x / y")
        const drinkDrive = String(row[10] || '');
        if (drinkDrive.includes('/')) {
            const parts = drinkDrive.split('/');
            data.ดื่มแล้วขับ = safeConvertToInt(parts[0]);
            data.ตรวจดื่มแล้วขับ = safeConvertToInt(parts[1]);
        } else {
            data.ดื่มแล้วขับ = safeConvertToInt(drinkDrive);
            data.ตรวจดื่มแล้วขับ = 0;
        }
        
        // Handle youth data (format: "x / y")
        const youthDrink = String(row[12] || '');
        if (youthDrink.includes('/')) {
            const parts = youthDrink.split('/');
            data['อายุ<20_ดื่มแล้วขับ'] = safeConvertToInt(parts[0]);
            data['อายุ<20_ทั้งหมด'] = safeConvertToInt(parts[1]);
        } else {
            data['อายุ<20_ดื่มแล้วขับ'] = safeConvertToInt(youthDrink);
            data['อายุ<20_ทั้งหมด'] = 0;
        }
        
        // Other safety data
        data.ไม่สวมหมวก = safeConvertToInt(row[14]);
        data.ไม่คาดเข็มขัด = safeConvertToInt(row[16]);
        
        // Percentages
        data['เสียชีวิต_%'] = safeConvertToFloat(row[4]);
        data['EMS_%'] = safeConvertToFloat(row[7]);
        data['Admit_%'] = safeConvertToFloat(row[9]);
        data['ดื่มแล้วขับ_%'] = safeConvertToFloat(row[11]);
        data['อายุ<20_ดื่มแล้วขับ_%'] = safeConvertToFloat(row[13]);
        data['ไม่สวมหมวก_%'] = safeConvertToFloat(row[15]);
        data['ไม่คาดเข็มขัด_%'] = safeConvertToFloat(row[17]);
        
        // Process date
        const dateStr = row[0];
        if (dateStr.includes('-')) {
            const [day, month, year] = dateStr.split('-');
            // Convert Buddhist year to Christian year
            const christianYear = parseInt(year) - 543;
            data.วันที่ = `${christianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        processedData.push(data);
    }
    
    return processedData;
}

// API Routes
app.get('/api/data', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/summary', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        
        const summary = {
            totalAccidents: data.reduce((sum, row) => sum + row.รวม, 0),
            totalDeaths: data.reduce((sum, row) => sum + row.เสียชีวิต, 0),
            drinkDriving: data.reduce((sum, row) => sum + row.ดื่มแล้วขับ, 0),
            youthCases: data.reduce((sum, row) => sum + row['อายุ<20_ทั้งหมด'], 0),
            admitCases: data.reduce((sum, row) => sum + row.Admit, 0),
            noHelmet: data.reduce((sum, row) => sum + row.ไม่สวมหมวก, 0),
            noSeatbelt: data.reduce((sum, row) => sum + row.ไม่คาดเข็มขัด, 0),
            dateRange: {
                start: data[0]?.วันเดือนปี || '',
                end: data[data.length - 1]?.วันเดือนปี || ''
            },
            totalDays: data.length
        };
        
        // Calculate rates
        summary.deathRate = summary.totalAccidents > 0 ? 
            (summary.totalDeaths / summary.totalAccidents * 100).toFixed(2) : 0;
        summary.avgAccidentsPerDay = (summary.totalAccidents / summary.totalDays).toFixed(1);
        summary.avgDeathsPerDay = (summary.totalDeaths / summary.totalDays).toFixed(1);
        
        res.json({ success: true, summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/monthly', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        const monthlyData = {};
        
        data.forEach(row => {
            if (row.วันที่) {
                const date = new Date(row.วันที่);
                const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        month: monthKey,
                        รวม: 0,
                        เสียชีวิต: 0,
                        ดื่มแล้วขับ: 0,
                        Admit: 0,
                        ไม่สวมหมวก: 0,
                        ไม่คาดเข็มขัด: 0
                    };
                }
                
                monthlyData[monthKey].รวม += row.รวม;
                monthlyData[monthKey].เสียชีวิต += row.เสียชีวิต;
                monthlyData[monthKey].ดื่มแล้วขับ += row.ดื่มแล้วขับ;
                monthlyData[monthKey].Admit += row.Admit;
                monthlyData[monthKey].ไม่สวมหมวก += row.ไม่สวมหมวก;
                monthlyData[monthKey].ไม่คาดเข็มขัด += row.ไม่คาดเข็มขัด;
            }
        });
        
        res.json({ success: true, data: Object.values(monthlyData) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/trends', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        const trends = data.map(row => ({
            date: row.วันที่,
            วันเดือนปี: row.วันเดือนปี,
            รวม: row.รวม,
            เสียชีวิต: row.เสียชีวิต,
            ดื่มแล้วขับ: row.ดื่มแล้วขับ,
            Admit: row.Admit,
            EMS: row.EMS
        }));
        
        res.json({ success: true, trends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Simple Linear Regression for forecasting
function simpleLinearRegression(data) {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    data.forEach((point, index) => {
        const x = index;
        const y = point;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
}

app.get('/api/forecast', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        const days = parseInt(req.query.days) || 7;
        
        // Get recent 30 days for forecasting
        const recentData = data.slice(-30);
        const accidentValues = recentData.map(d => d.รวม);
        const deathValues = recentData.map(d => d.เสียชีวิต);
        
        // Calculate regression
        const accidentRegression = simpleLinearRegression(accidentValues);
        const deathRegression = simpleLinearRegression(deathValues);
        
        // Generate forecast
        const forecast = [];
        const lastDate = new Date(recentData[recentData.length - 1].วันที่);
        
        for (let i = 1; i <= days; i++) {
            const forecastDate = new Date(lastDate);
            forecastDate.setDate(forecastDate.getDate() + i);
            
            const x = 30 + i - 1;
            const predictedAccidents = Math.max(0, Math.round(accidentRegression.slope * x + accidentRegression.intercept));
            const predictedDeaths = Math.max(0, Math.round(deathRegression.slope * x + deathRegression.intercept));
            
            forecast.push({
                date: forecastDate.toISOString().split('T')[0],
                วันเดือนปี: forecastDate.toLocaleDateString('th-TH', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).replace(/\//g, '-'),
                predictedAccidents,
                predictedDeaths,
                confidence: Math.max(0.6, 0.9 - (i * 0.05))
            });
        }
        
        res.json({ success: true, forecast, historical: recentData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/patterns', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        
        // Day of week patterns
        const dayPatterns = {};
        data.forEach(row => {
            if (row.วันที่) {
                const date = new Date(row.วันที่);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                
                if (!dayPatterns[dayName]) {
                    dayPatterns[dayName] = { total: 0, count: 0, deaths: 0, drinkDriving: 0 };
                }
                
                dayPatterns[dayName].total += row.รวม;
                dayPatterns[dayName].deaths += row.เสียชีวิต;
                dayPatterns[dayName].drinkDriving += row.ดื่มแล้วขับ;
                dayPatterns[dayName].count += 1;
            }
        });
        
        // Calculate averages
        Object.keys(dayPatterns).forEach(day => {
            const pattern = dayPatterns[day];
            pattern.avgAccidents = (pattern.total / pattern.count).toFixed(1);
            pattern.avgDeaths = (pattern.deaths / pattern.count).toFixed(1);
            pattern.avgDrinkDriving = (pattern.drinkDriving / pattern.count).toFixed(1);
        });
        
        // Correlation analysis
        const correlations = calculateCorrelations(data);
        
        // Risk scoring (last 90 days only for performance)
        const riskScores = calculateRiskScores(data).slice(-90);
        
        res.json({ 
            success: true, 
            dayPatterns,
            correlations,
            riskScores,
            seasonalTrends: calculateSeasonalTrends(data)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

function calculateCorrelations(data) {
    const factors = ['รวม', 'เสียชีวิต', 'ดื่มแล้วขับ', 'ไม่สวมหมวก', 'ไม่คาดเข็มขัด'];
    const correlations = {};
    
    // Calculate correlation between each pair
    for (let i = 0; i < factors.length; i++) {
        for (let j = i + 1; j < factors.length; j++) {
            const factor1 = factors[i];
            const factor2 = factors[j];
            
            const values1 = data.map(d => d[factor1] || 0);
            const values2 = data.map(d => d[factor2] || 0);
            
            const correlation = calculatePearsonCorrelation(values1, values2);
            correlations[`${factor1}_${factor2}`] = correlation;
        }
    }
    
    return correlations;
}

function calculatePearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

function calculateRiskScores(data) {
    return data.map(row => {
        let riskScore = 0;
        
        // Base risk from total accidents
        riskScore += (row.รวม || 0) * 0.3;
        
        // High risk factors
        riskScore += (row.ดื่มแล้วขับ || 0) * 2.5;  // Drink driving high weight
        riskScore += (row['อายุ<20_ทั้งหมด'] || 0) * 1.8; // Youth high weight
        riskScore += (row.ไม่สวมหมวก || 0) * 1.2; // No helmet
        riskScore += (row.ไม่คาดเข็มขัด || 0) * 1.0; // No seatbelt
        
        // Death multiplier
        riskScore += (row.เสียชีวิต || 0) * 5.0;
        
        return {
            date: row.วันเดือนปี,
            riskScore: Math.round(riskScore * 10) / 10,
            level: riskScore > 30 ? 'สูงมาก' : riskScore > 20 ? 'สูง' : riskScore > 10 ? 'ปานกลาง' : 'ต่ำ'
        };
    });
}

function calculateSeasonalTrends(data) {
    const seasons = {
        'แล้ง': [12, 1, 2],      // ฤดูแล้ง
        'ร้อน': [3, 4, 5],       // ฤดูร้อน  
        'ฝน': [6, 7, 8, 9, 10, 11] // ฤดูฝน
    };
    
    const seasonalData = {};
    
    Object.keys(seasons).forEach(season => {
        seasonalData[season] = {
            totalAccidents: 0,
            totalDeaths: 0,
            drinkDriving: 0,
            count: 0
        };
    });
    
    data.forEach(row => {
        if (row.วันที่) {
            const date = new Date(row.วันที่);
            const month = date.getMonth() + 1;
            
            let season = '';
            Object.keys(seasons).forEach(s => {
                if (seasons[s].includes(month)) {
                    season = s;
                }
            });
            
            if (season && seasonalData[season]) {
                seasonalData[season].totalAccidents += row.รวม || 0;
                seasonalData[season].totalDeaths += row.เสียชีวิต || 0;
                seasonalData[season].drinkDriving += row.ดื่มแล้วขับ || 0;
                seasonalData[season].count += 1;
            }
        }
    });
    
    // Calculate averages
    Object.keys(seasonalData).forEach(season => {
        const data = seasonalData[season];
        if (data.count > 0) {
            data.avgAccidents = (data.totalAccidents / data.count).toFixed(1);
            data.avgDeaths = (data.totalDeaths / data.count).toFixed(1);
            data.avgDrinkDriving = (data.drinkDriving / data.count).toFixed(1);
        }
    });
    
    return seasonalData;
}

app.get('/api/heatmap', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        
        // Create day of week vs hour heatmap (simulate hours from other factors)
        const dayHourMatrix = {};
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        // Initialize matrix
        daysOfWeek.forEach(day => {
            dayHourMatrix[day] = {};
            for (let hour = 0; hour < 24; hour++) {
                dayHourMatrix[day][hour] = 0;
            }
        });
        
        // Simulate hourly distribution based on accident patterns
        data.forEach(row => {
            if (row.วันที่) {
                const date = new Date(row.วันที่);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                const accidents = row.รวม || 0;
                
                // Distribute accidents across hours based on common patterns
                const hourDistribution = [
                    0.02, 0.01, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, // 0-7
                    0.08, 0.06, 0.05, 0.04, 0.05, 0.06, 0.07, 0.08, // 8-15
                    0.09, 0.10, 0.11, 0.09, 0.07, 0.05, 0.04, 0.03  // 16-23
                ];
                
                hourDistribution.forEach((ratio, hour) => {
                    dayHourMatrix[dayName][hour] += Math.round(accidents * ratio);
                });
            }
        });
        
        res.json({ success: true, heatmapData: dayHourMatrix });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/scatter', (req, res) => {
    try {
        const data = parseExcelData('./Book3.xlsx');
        
        const scatterData = data.map(row => ({
            x: row.รวม || 0,
            y: row.เสียชีวิต || 0,
            drinkDriving: row.ดื่มแล้วขับ || 0,
            youth: row['อายุ<20_ทั้งหมด'] || 0,
            date: row.วันเดือนปี,
            severity: row.เสียชีวิต > 0 ? 'fatal' : row.Admit > 5 ? 'serious' : 'minor'
        }));
        
        // Factor analysis data
        const factorData = data.map(row => ({
            date: row.วันเดือนปี,
            drinkDriving: row.ดื่มแล้วขับ || 0,
            noHelmet: row.ไม่สวมหมวก || 0,
            noSeatbelt: row.ไม่คาดเข็มขัด || 0,
            youth: row['อายุ<20_ทั้งหมด'] || 0,
            total: row.รวม || 0
        }));
        
        res.json({ success: true, scatterData, factorData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚨 ACC Data Analysis Server running at http://localhost:${PORT}`);
    console.log('📊 Ready to analyze accident data from Book3.xlsx');
});