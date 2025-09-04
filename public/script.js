// Global variables
let accData = [];
let summaryData = {};
let monthlyData = [];
let charts = {};
let forecastData = null;
let patternsData = null;

// Thai month names
const thaiMonths = {
    '01': 'มกราคม', '02': 'กุมภาพันธ์', '03': 'มีนาคม', '04': 'เมษายน',
    '05': 'พฤษภาคม', '06': 'มิถุนายน', '07': 'กรกฎาคม', '08': 'สิงหาคม',
    '09': 'กันยายน', '10': 'ตุลาคม', '11': 'พฤศจิกายน', '12': 'ธันวาคม'
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadData();
});

// Navigation handling
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewSections = document.querySelectorAll('.view-section');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            
            // Update active nav button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active view section
            viewSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetView) {
                    section.classList.add('active');
                }
            });
            
            // Load specific view data
            loadViewData(targetView);
        });
    });
}

// Load data from API
async function loadData() {
    showLoading(true);
    
    try {
        // Load summary data
        const summaryResponse = await fetch('/api/summary');
        const summaryResult = await summaryResponse.json();
        
        if (summaryResult.success && summaryResult.data) {
            summaryData = { summary: summaryResult.data }; // Wrap for compatibility
            updateOverviewStats(summaryData.summary);
        } else {
            console.error('Summary data missing:', summaryResult.error);
        }
        
        // Load full data
        const dataResponse = await fetch('/api/data');
        const dataResult = await dataResponse.json();
        
        if (dataResult.success) {
            accData = dataResult.data;
            loadViewData('overview');
        }
        
        // Load monthly data
        const monthlyResponse = await fetch('/api/monthly');
        const monthlyResult = await monthlyResponse.json();
        
        if (monthlyResult.success) {
            monthlyData = monthlyResult.data;
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ');
    }
    
    showLoading(false);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// Update overview statistics
function updateOverviewStats(summary) {
    document.getElementById('total-accidents').textContent = formatNumber(summary.totalAccidents);
    document.getElementById('total-deaths').textContent = formatNumber(summary.totalDeaths);
    document.getElementById('drink-driving').textContent = formatNumber(summary.drinkDriving);
    document.getElementById('admit-cases').textContent = formatNumber(summary.admitCases);
    document.getElementById('death-rate').textContent = summary.deathRate;
    document.getElementById('youth-cases').textContent = formatNumber(summary.youthCases);
    
    // Update period info
    const dateRangeText = `${summary.dateRange.start} ถึง ${summary.dateRange.end}`;
    const dateRangeEl = document.getElementById('date-range');
    const totalDaysEl = document.getElementById('total-days');
    
    if (dateRangeEl) dateRangeEl.textContent = `ระยะเวลา: ${dateRangeText}`;
    if (totalDaysEl) totalDaysEl.textContent = `จำนวนวัน: ${summary.totalDays} วัน`;
}

// Load specific view data
function loadViewData(viewName) {
    switch (viewName) {
        case 'overview':
            createCausesChart();
            createRecentTrendChart();
            break;
        case 'trends':
            createDailyTrendChart();
            createDrinkTrendChart();
            createEMSTrendChart();
            break;
        case 'forecast':
            loadForecast();
            break;
        case 'patterns':
            loadPatternsData();
            break;
        case 'causes':
            createInjuryCausesChart();
            createSafetyChart();
            updateSafetyStats();
            break;
        case 'timeline':
            createMonthlyChart();
            break;
        case 'reports':
            generateReport();
            populateMonthlyTable();
            break;
    }
}

// Chart creation functions
function createCausesChart() {
    const ctx = document.getElementById('causesChart');
    if (!ctx || charts.causes) return;
    
    const summary = summaryData.summary;
    
    charts.causes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ดื่มแล้วขับ', 'ไม่สวมหมวก', 'ไม่คาดเข็มขัด'],
            datasets: [{
                data: [summary.drinkDriving, summary.noHelmet, summary.noSeatbelt],
                backgroundColor: ['#e74c3c', '#f39c12', '#9b59b6'],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        font: { size: 14 }
                    }
                }
            }
        }
    });
}

function createRecentTrendChart() {
    const ctx = document.getElementById('recentTrendChart');
    if (!ctx || charts.recentTrend) return;
    
    // Get last 30 days of data
    const recentData = accData.slice(-30);
    
    charts.recentTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recentData.map(d => d.วันเดือนปี),
            datasets: [{
                label: 'อุบัติเหตุ',
                data: recentData.map(d => d.รวม),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createDailyTrendChart() {
    const ctx = document.getElementById('dailyTrendChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (charts.dailyTrend) {
        charts.dailyTrend.destroy();
    }
    
    charts.dailyTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: accData.map(d => d.วันเดือนปี),
            datasets: [{
                label: 'รวมอุบัติเหตุ',
                data: accData.map(d => d.รวม),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.2
            }, {
                label: 'เสียชีวิต',
                data: accData.map(d => d.เสียชีวิต),
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function createDrinkTrendChart() {
    const ctx = document.getElementById('drinkTrendChart');
    if (!ctx) return;
    
    if (charts.drinkTrend) {
        charts.drinkTrend.destroy();
    }
    
    charts.drinkTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: accData.slice(-30).map(d => d.วันเดือนปี),
            datasets: [{
                label: 'ดื่มแล้วขับ',
                data: accData.slice(-30).map(d => d.ดื่มแล้วขับ),
                backgroundColor: '#f39c12',
                borderColor: '#e67e22',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createEMSTrendChart() {
    const ctx = document.getElementById('emsTrendChart');
    if (!ctx) return;
    
    if (charts.emsTrend) {
        charts.emsTrend.destroy();
    }
    
    charts.emsTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: accData.slice(-30).map(d => d.วันเดือนปี),
            datasets: [{
                label: 'EMS',
                data: accData.slice(-30).map(d => d.EMS),
                borderColor: '#17a2b8',
                backgroundColor: 'rgba(23, 162, 184, 0.1)',
                tension: 0.3
            }, {
                label: 'Admit',
                data: accData.slice(-30).map(d => d.Admit),
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    const labels = monthlyData.map(d => {
        const [year, month] = d.month.split('-');
        return `${thaiMonths[month]} ${parseInt(year) + 543}`;
    });
    
    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'รวมอุบัติเหตุ',
                data: monthlyData.map(d => d.รวม),
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }, {
                label: 'เสียชีวิต',
                data: monthlyData.map(d => d.เสียชีวิต),
                backgroundColor: '#e74c3c',
                borderColor: '#c0392b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createInjuryCausesChart() {
    const ctx = document.getElementById('injuryCausesChart');
    if (!ctx) return;
    
    if (charts.injuryCauses) {
        charts.injuryCauses.destroy();
    }
    
    const summary = summaryData.summary;
    
    charts.injuryCauses = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['ดื่มแล้วขับ', 'อายุ < 20 ปี', 'ไม่สวมหมวก', 'ไม่คาดเข็มขัด'],
            datasets: [{
                label: 'จำนวนครั้ง',
                data: [
                    summary.drinkDriving,
                    summary.youthCases,
                    summary.noHelmet,
                    summary.noSeatbelt
                ],
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderColor: '#e74c3c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createSafetyChart() {
    const ctx = document.getElementById('safetyChart');
    if (!ctx) return;
    
    if (charts.safety) {
        charts.safety.destroy();
    }
    
    const summary = summaryData.summary;
    
    charts.safety = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: ['ไม่สวมหมวก', 'ไม่คาดเข็มขัด'],
            datasets: [{
                data: [summary.noHelmet, summary.noSeatbelt],
                backgroundColor: ['#f39c12', '#9b59b6'],
                borderColor: ['#e67e22', '#8e44ad'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateSafetyStats() {
    const summary = summaryData.summary;
    
    document.getElementById('no-helmet-count').textContent = formatNumber(summary.noHelmet);
    document.getElementById('no-seatbelt-count').textContent = formatNumber(summary.noSeatbelt);
    
    const helmetPercent = ((summary.noHelmet / summary.totalAccidents) * 100).toFixed(1);
    const seatbeltPercent = ((summary.noSeatbelt / summary.totalAccidents) * 100).toFixed(1);
    
    document.getElementById('no-helmet-percent').textContent = `${helmetPercent}%`;
    document.getElementById('no-seatbelt-percent').textContent = `${seatbeltPercent}%`;
}

function generateReport() {
    const summary = summaryData.summary;
    const reportContent = document.getElementById('report-content');
    
    const html = `
        <h4><i class="fas fa-chart-bar"></i> สรุปภาพรวม</h4>
        <p><strong>ช่วงเวลา:</strong> ${summary.dateRange.start} ถึง ${summary.dateRange.end}</p>
        <p><strong>จำนวนวันที่เก็บข้อมูล:</strong> ${summary.totalDays} วัน</p>
        
        <h4><i class="fas fa-ambulance"></i> สถิติอุบัติเหตุ</h4>
        <ul>
            <li>รวมอุบัติเหตุ: <strong>${formatNumber(summary.totalAccidents)} ครั้ง</strong></li>
            <li>รวมผู้เสียชีวิต: <strong>${formatNumber(summary.totalDeaths)} คน</strong></li>
            <li>อัตราเสียชีวิต: <strong>${summary.deathRate}%</strong></li>
            <li>ค่าเฉลี่ยอุบัติเหตุต่อวัน: <strong>${summary.avgAccidentsPerDay} ครั้ง</strong></li>
            <li>ค่าเฉลี่ยเสียชีวิตต่อวัน: <strong>${summary.avgDeathsPerDay} คน</strong></li>
        </ul>
        
        <h4><i class="fas fa-exclamation-triangle"></i> สาเหตุหลัก</h4>
        <ul>
            <li>ดื่มแล้วขับ: <strong>${formatNumber(summary.drinkDriving)} ครั้ง</strong> (${((summary.drinkDriving/summary.totalAccidents)*100).toFixed(1)}%)</li>
            <li>กลุ่มอายุ < 20 ปี: <strong>${formatNumber(summary.youthCases)} ครั้ง</strong> (${((summary.youthCases/summary.totalAccidents)*100).toFixed(1)}%)</li>
            <li>ไม่สวมหมวก: <strong>${formatNumber(summary.noHelmet)} ครั้ง</strong> (${((summary.noHelmet/summary.totalAccidents)*100).toFixed(1)}%)</li>
            <li>ไม่คาดเข็มขัด: <strong>${formatNumber(summary.noSeatbelt)} ครั้ง</strong> (${((summary.noSeatbelt/summary.totalAccidents)*100).toFixed(1)}%)</li>
        </ul>
        
        <h4><i class="fas fa-hospital"></i> การรักษา</h4>
        <ul>
            <li>ผู้ป่วยที่ต้อง Admit: <strong>${formatNumber(summary.admitCases)} ครั้ง</strong> (${((summary.admitCases/summary.totalAccidents)*100).toFixed(1)}%)</li>
        </ul>
    `;
    
    reportContent.innerHTML = html;
}

function populateMonthlyTable() {
    const tableBody = document.querySelector('#monthly-table tbody');
    if (!tableBody || !monthlyData.length) return;
    
    tableBody.innerHTML = '';
    
    monthlyData.forEach(row => {
        const [year, month] = row.month.split('-');
        const thaiMonth = `${thaiMonths[month]} ${parseInt(year) + 543}`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${thaiMonth}</td>
            <td>${formatNumber(row.รวม)}</td>
            <td>${formatNumber(row.เสียชีวิต)}</td>
            <td>${formatNumber(row.ดื่มแล้วขับ)}</td>
            <td>${formatNumber(row.Admit)}</td>
            <td>${formatNumber(row.ไม่สวมหมวก)}</td>
            <td>${formatNumber(row.ไม่คาดเข็มขัด)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// Forecast functions
async function loadForecast() {
    const days = document.getElementById('forecast-days').value;
    
    try {
        const response = await fetch(`/api/forecast?days=${days}`);
        const result = await response.json();
        
        if (result.success) {
            forecastData = result;
            createForecastChart();
            updateForecastStats();
        }
    } catch (error) {
        console.error('Error loading forecast:', error);
    }
}

function createForecastChart() {
    const ctx = document.getElementById('forecastChart');
    if (!ctx || !forecastData) return;
    
    if (charts.forecast) {
        charts.forecast.destroy();
    }
    
    const historical = forecastData.historical;
    const forecast = forecastData.forecast;
    
    // Prepare data
    const allDates = [...historical.map(d => d.วันเดือนปี), ...forecast.map(f => f.วันเดือนปี)];
    const historicalAccidents = [...historical.map(d => d.รวม), ...new Array(forecast.length).fill(null)];
    const forecastAccidents = [...new Array(historical.length).fill(null), ...forecast.map(f => f.predictedAccidents)];
    const forecastDeaths = [...new Array(historical.length).fill(null), ...forecast.map(f => f.predictedDeaths)];
    
    charts.forecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [{
                label: 'อุบัติเหตุ (ข้อมูลจริง)',
                data: historicalAccidents,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.3,
                fill: false
            }, {
                label: 'อุบัติเหตุ (พยากรณ์)',
                data: forecastAccidents,
                borderColor: '#e67e22',
                backgroundColor: 'rgba(230, 126, 34, 0.2)',
                borderDash: [5, 5],
                tension: 0.3,
                fill: false
            }, {
                label: 'เสียชีวิต (พยากรณ์)',
                data: forecastDeaths,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderDash: [3, 3],
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 15
                    }
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            if (context.datasetIndex > 0) {
                                const pointIndex = context.dataIndex - historical.length;
                                if (pointIndex >= 0 && forecast[pointIndex]) {
                                    return `ความเชื่อมั่น: ${(forecast[pointIndex].confidence * 100).toFixed(0)}%`;
                                }
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

function updateForecastStats() {
    if (!forecastData) return;
    
    const forecast = forecastData.forecast;
    const totalPredicted = forecast.reduce((sum, f) => sum + f.predictedAccidents, 0);
    const avgPredicted = (totalPredicted / forecast.length).toFixed(1);
    const maxPredicted = Math.max(...forecast.map(f => f.predictedAccidents));
    
    document.getElementById('forecast-stats').innerHTML = `
        <p><strong>รวมพยากรณ์:</strong> ${formatNumber(totalPredicted)} ครั้ง</p>
        <p><strong>เฉลี่ยต่อวัน:</strong> ${avgPredicted} ครั้ง</p>
        <p><strong>วันที่คาดว่าจะสูงสุด:</strong> ${maxPredicted} ครั้ง</p>
    `;
    
    const warnings = [];
    if (maxPredicted > 100) {
        warnings.push('⚠️ คาดการณ์อุบัติเหตุสูงเกิน 100 ครั้ง/วัน');
    }
    if (avgPredicted > 80) {
        warnings.push('🔴 แนวโน้มเพิ่มขึ้นอย่างต่อเนื่อง');
    }
    if (warnings.length === 0) {
        warnings.push('✅ แนวโน้มอยู่ในระดับปกติ');
    }
    
    document.getElementById('forecast-warnings').innerHTML = warnings.map(w => `<p>${w}</p>`).join('');
}

// Patterns analysis functions
async function loadPatternsData() {
    try {
        const response = await fetch('/api/patterns');
        const result = await response.json();
        
        if (result.success) {
            patternsData = result;
            createDayPatternsChart();
            createSeasonalChart();
            createCorrelationChart();
            createRiskScoreChart();
            updateRiskSummary();
            loadHeatmapData();
            loadScatterData();
        }
    } catch (error) {
        console.error('Error loading patterns:', error);
    }
}

function createDayPatternsChart() {
    const ctx = document.getElementById('dayPatternsChart');
    if (!ctx || !patternsData) return;
    
    if (charts.dayPatterns) {
        charts.dayPatterns.destroy();
    }
    
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const thaiDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
    
    const orderedData = dayOrder.map(day => patternsData.dayPatterns[day] || { avgAccidents: 0, avgDeaths: 0 });
    
    charts.dayPatterns = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: thaiDays,
            datasets: [{
                label: 'อุบัติเหตุเฉลี่ย/วัน',
                data: orderedData.map(d => parseFloat(d.avgAccidents)),
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }, {
                label: 'เสียชีวิตเฉลี่ย/วัน',
                data: orderedData.map(d => parseFloat(d.avgDeaths)),
                backgroundColor: '#e74c3c',
                borderColor: '#c0392b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createSeasonalChart() {
    const ctx = document.getElementById('seasonalChart');
    if (!ctx || !patternsData) return;
    
    if (charts.seasonal) {
        charts.seasonal.destroy();
    }
    
    const seasonalData = patternsData.seasonalTrends;
    const seasons = Object.keys(seasonalData);
    
    charts.seasonal = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: seasons,
            datasets: [{
                label: 'อุบัติเหตุเฉลี่ย',
                data: seasons.map(s => parseFloat(seasonalData[s].avgAccidents || 0)),
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: '#3498db',
                borderWidth: 2
            }, {
                label: 'เสียชีวิตเฉลี่ย',
                data: seasons.map(s => parseFloat(seasonalData[s].avgDeaths || 0)),
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderColor: '#e74c3c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createCorrelationChart() {
    const ctx = document.getElementById('correlationChart');
    if (!ctx || !patternsData) return;
    
    if (charts.correlation) {
        charts.correlation.destroy();
    }
    
    const correlations = patternsData.correlations;
    const labels = Object.keys(correlations).map(key => key.replace('_', ' vs '));
    const values = Object.values(correlations).map(v => Math.abs(v));
    
    charts.correlation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ความสัมพันธ์ (Correlation)',
                data: values,
                backgroundColor: values.map(v => 
                    v > 0.7 ? '#e74c3c' : v > 0.5 ? '#f39c12' : v > 0.3 ? '#f1c40f' : '#27ae60'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    max: 1
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const strength = context.parsed.x > 0.7 ? 'แข็งแกร่งมาก' : 
                                           context.parsed.x > 0.5 ? 'แข็งแกร่ง' : 
                                           context.parsed.x > 0.3 ? 'ปานกลาง' : 'อ่อน';
                            return `ความสัมพันธ์: ${context.parsed.x.toFixed(3)} (${strength})`;
                        }
                    }
                }
            }
        }
    });
}

function createRiskScoreChart() {
    const ctx = document.getElementById('riskScoreChart');
    if (!ctx || !patternsData) return;
    
    if (charts.riskScore) {
        charts.riskScore.destroy();
    }
    
    const riskScores = patternsData.riskScores.slice(-60); // Last 60 days
    
    const riskColors = riskScores.map(r => 
        r.riskScore > 30 ? '#e74c3c' : 
        r.riskScore > 20 ? '#f39c12' : 
        r.riskScore > 10 ? '#f1c40f' : '#27ae60'
    );
    
    charts.riskScore = new Chart(ctx, {
        type: 'line',
        data: {
            labels: riskScores.map(r => r.date),
            datasets: [{
                label: 'คะแนนความเสี่ยง',
                data: riskScores.map(r => r.riskScore),
                borderColor: '#e67e22',
                backgroundColor: 'rgba(230, 126, 34, 0.2)',
                pointBackgroundColor: riskColors,
                pointBorderColor: riskColors,
                pointRadius: 4,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const level = riskScores[index].level;
                            return `ระดับความเสี่ยง: ${level}`;
                        }
                    }
                }
            }
        }
    });
}

function updateRiskSummary() {
    if (!patternsData) return;
    
    const riskScores = patternsData.riskScores;
    const highRisk = riskScores.filter(r => r.riskScore > 20).slice(-10);
    const mediumRisk = riskScores.filter(r => r.riskScore > 10 && r.riskScore <= 20).slice(-10);
    
    document.getElementById('high-risk-days').innerHTML = 
        highRisk.length > 0 ? 
        highRisk.map(r => `<p>${r.date}: ${r.riskScore} คะแนน</p>`).join('') : 
        '<p>ไม่มีวันที่มีความเสี่ยงสูง</p>';
        
    document.getElementById('medium-risk-days').innerHTML = 
        mediumRisk.length > 0 ? 
        mediumRisk.map(r => `<p>${r.date}: ${r.riskScore} คะแนน</p>`).join('') : 
        '<p>ไม่มีวันที่มีความเสี่ยงปานกลาง</p>';
}

// Heatmap and Scatter functions
async function loadHeatmapData() {
    try {
        const response = await fetch('/api/heatmap');
        const result = await response.json();
        
        if (result.success) {
            createHeatmapChart(result.heatmapData);
        }
    } catch (error) {
        console.error('Error loading heatmap:', error);
    }
}

async function loadScatterData() {
    try {
        const response = await fetch('/api/scatter');
        const result = await response.json();
        
        if (result.success) {
            createScatterChart(result.scatterData, result.factorData);
        }
    } catch (error) {
        console.error('Error loading scatter:', error);
    }
}

function createHeatmapChart(heatmapData) {
    const ctx = document.getElementById('heatmapChart');
    if (!ctx) return;
    
    if (charts.heatmap) {
        charts.heatmap.destroy();
    }
    
    // Convert heatmap data to chart.js format
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const thaiDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
    const hours = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    
    // Create datasets for each hour
    const datasets = [];
    for (let hour = 0; hour < 24; hour++) {
        datasets.push({
            label: `${hour.toString().padStart(2, '0')}:00`,
            data: daysOfWeek.map(day => heatmapData[day][hour] || 0),
            backgroundColor: `hsla(${(hour * 15) % 360}, 70%, 60%, 0.8)`,
            borderWidth: 1,
            borderColor: '#fff'
        });
    }
    
    charts.heatmap = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: thaiDays,
            datasets: datasets.filter((_, hour) => hour % 4 === 0) // Show every 4 hours
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function createScatterChart(scatterData) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;
    
    if (charts.scatter) {
        charts.scatter.destroy();
    }
    
    // Group data by severity
    const fatalData = scatterData.filter(d => d.severity === 'fatal');
    const seriousData = scatterData.filter(d => d.severity === 'serious');
    const minorData = scatterData.filter(d => d.severity === 'minor');
    
    charts.scatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'เสียชีวิต (Fatal)',
                data: fatalData.map(d => ({x: d.x, y: d.y})),
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: '#e74c3c',
                pointRadius: 6
            }, {
                label: 'รุนแรง (Serious)',
                data: seriousData.map(d => ({x: d.x, y: d.y})),
                backgroundColor: 'rgba(243, 156, 18, 0.7)',
                borderColor: '#f39c12',
                pointRadius: 4
            }, {
                label: 'เล็กน้อย (Minor)',
                data: minorData.map(d => ({x: d.x, y: d.y})),
                backgroundColor: 'rgba(39, 174, 96, 0.7)',
                borderColor: '#27ae60',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'จำนวนอุบัติเหตุ'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'จำนวนผู้เสียชีวิต'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const dataset = context[0].dataset;
                            let originalData;
                            
                            if (dataset.label === 'เสียชีวิต (Fatal)') {
                                originalData = fatalData[dataIndex];
                            } else if (dataset.label === 'รุนแรง (Serious)') {
                                originalData = seriousData[dataIndex];
                            } else {
                                originalData = minorData[dataIndex];
                            }
                            
                            return originalData ? originalData.date : '';
                        },
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            const dataset = context.dataset;
                            let originalData;
                            
                            if (dataset.label === 'เสียชีวิต (Fatal)') {
                                originalData = fatalData[dataIndex];
                            } else if (dataset.label === 'รุนแรง (Serious)') {
                                originalData = seriousData[dataIndex];
                            } else {
                                originalData = minorData[dataIndex];
                            }
                            
                            if (originalData) {
                                return [
                                    `ดื่มแล้วขับ: ${originalData.drinkDriving} ครั้ง`,
                                    `อายุ < 20: ${originalData.youth} ครั้ง`
                                ];
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

// Utility functions
function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num);
}

function exportReport() {
    const summary = summaryData.summary;
    const reportText = `ระบบวิเคราะห์ข้อมูลอุบัติเหตุ - รพ.วชิระภูเก็ต
ช่วงเวลา: ${summary.dateRange.start} ถึง ${summary.dateRange.end}
จำนวนวัน: ${summary.totalDays} วัน

สถิติอุบัติเหตุ:
- รวมอุบัติเหตุ: ${formatNumber(summary.totalAccidents)} ครั้ง
- รวมผู้เสียชีวิต: ${formatNumber(summary.totalDeaths)} คน  
- อัตราเสียชีวิต: ${summary.deathRate}%
- ค่าเฉลี่ยอุบัติเหตุต่อวัน: ${summary.avgAccidentsPerDay} ครั้ง
- ค่าเฉลี่ยเสียชีวิตต่อวัน: ${summary.avgDeathsPerDay} คน

สาเหตุหลัก:
- ดื่มแล้วขับ: ${formatNumber(summary.drinkDriving)} ครั้ง (${((summary.drinkDriving/summary.totalAccidents)*100).toFixed(1)}%)
- กลุ่มอายุ < 20 ปี: ${formatNumber(summary.youthCases)} ครั้ง (${((summary.youthCases/summary.totalAccidents)*100).toFixed(1)}%)
- ไม่สวมหมวก: ${formatNumber(summary.noHelmet)} ครั้ง (${((summary.noHelmet/summary.totalAccidents)*100).toFixed(1)}%)
- ไม่คาดเข็มขัด: ${formatNumber(summary.noSeatbelt)} ครั้ง (${((summary.noSeatbelt/summary.totalAccidents)*100).toFixed(1)}%)`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accident_report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}