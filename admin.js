// static/js/admin.js
let adminMap;
let adminPredictionLayer;

document.addEventListener('DOMContentLoaded', function() {
    // Render Traffic Prediction Chart using Chart.js
    const ctx = document.getElementById('trafficChart');
    if (ctx) {
        // Fetch data from Flask backend
        fetch('/api/traffic_prediction')
            .then(response => response.json())
            .then(data => {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Predicted Congestion Level (%)',
                            data: data.congestion,
                            borderColor: '#4361ee',
                            backgroundColor: 'rgba(67, 97, 238, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4, // Smooth curves
                            pointBackgroundColor: '#f72585',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                            },
                            tooltip: {
                                backgroundColor: 'rgba(11, 15, 25, 0.9)',
                                titleFont: { size: 13, family: 'Inter' },
                                bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
                                padding: 12,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) {
                                        return context.raw + '% Congestion';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                grid: {
                                    color: 'rgba(0,0,0,0.05)',
                                    drawBorder: false,
                                },
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            },
                            x: {
                                grid: {
                                    display: false,
                                }
                            }
                        }
                    }
                });
            })
            .catch(error => console.error('Error fetching traffic prediction data:', error));
    }

    // Initialize Admin Prediction Map
    if (document.getElementById('prediction-map')) {
        adminMap = L.map('prediction-map').setView([37.7749, -122.4194], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(adminMap);
        adminPredictionLayer = L.layerGroup().addTo(adminMap);
    }
});

function showMapPrediction(type) {
    if (typeof renderTrafficPrediction === 'function') {
        renderTrafficPrediction(type, adminMap, adminPredictionLayer);
    } else {
        console.error("renderTrafficPrediction function not found in prediction.js");
    }
}
