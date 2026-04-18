// ===============================
// GLOBAL VARIABLES
// ===============================
let map;
let routeLayer;
let predictionLayerGroup;

let realTimeInterval = null;
let basePrimaryDuration = 0;
let baseAltDuration = 0;
window.lastCommentCount = 0;

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchComments();
    setInterval(fetchComments, 10000);
});

function initMap() {
    map = L.map('map').setView([37.7749, -122.4194], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    predictionLayerGroup = L.layerGroup().addTo(map);
}

// ===============================
// GEOCODING
// ===============================
async function getCoordinates(place) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0) {
        throw new Error(`Location not found: ${place}`);
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
    };
}

// ===============================
// MAIN ROUTE FUNCTION
// ===============================
async function calculateRoute(routeType) {
    const startInput = document.getElementById("source-input").value;
    const endInput = document.getElementById("dest-input").value;

    if (!startInput || !endInput) {
        alert("Please enter both source and destination.");
        return;
    }

    document.getElementById("route-distance").textContent = "Loading...";
    document.getElementById("route-duration").textContent = "Loading...";
    document.getElementById("route-details").classList.remove("d-none");

    try {
        const start = await getCoordinates(startInput);
        const end = await getCoordinates(endInput);

        await drawRoute(start, end, routeType, startInput, endInput);

    } catch (error) {
        console.error("Routing error:", error);
        alert(error.message);
        document.getElementById("route-details").classList.add("d-none");
    }
}

// ===============================
// DRAW ROUTE (FIXED CORE LOGIC)
// ===============================
async function drawRoute(start, end, routeType, sourceStr, destStr) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    try {
        // ✅ CLEAN OSRM CALL
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;

        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error("No route found between these locations.");
        }

        let primaryRoute = data.routes[0];
        let altRoute = data.routes.length > 1 ? data.routes[1] : null;

        // Route selection
        if (routeType === "alternative" && altRoute) {
            primaryRoute = altRoute;
        }

        // ===============================
        // STORE FOR PREDICTION.JS
        // ===============================
        window.currentRouteData = {
            primary: primaryRoute,
            alternate: altRoute
        };

        // ===============================
        // DRAW ROUTES
        // ===============================
        routeLayer = L.featureGroup().addTo(map);

        L.geoJSON(primaryRoute.geometry, {
            style: { color: '#4361ee', weight: 5, opacity: 0.8 }
        }).addTo(routeLayer);

        if (altRoute && routeType !== "alternative") {
            L.geoJSON(altRoute.geometry, {
                style: { color: '#adb5bd', weight: 4, opacity: 0.7 }
            }).addTo(routeLayer);
        }

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // ===============================
        // REAL DISTANCE & TIME
        // ===============================
        const distanceKm = (primaryRoute.distance / 1000).toFixed(2);
        const durationMin = Math.round(primaryRoute.duration / 60);

        basePrimaryDuration = primaryRoute.duration;
        baseAltDuration = altRoute ? altRoute.duration : 0;

        document.getElementById("route-distance").textContent = `${distanceKm} km`;
        document.getElementById("route-duration").textContent = `${durationMin} min`;

        // ===============================
        // ALT ROUTE DISPLAY
        // ===============================
        if (altRoute) {
            const altDistanceKm = (altRoute.distance / 1000).toFixed(2);
            const altDurationMin = Math.round(altRoute.duration / 60);

            const altDistEl = document.getElementById("alt-route-distance");
            const altDurEl = document.getElementById("alt-route-duration");

            if (altDistEl && altDurEl) {
                altDistEl.textContent = `${altDistanceKm} km`;
                altDurEl.textContent = `${altDurationMin} min`;
            }
        }

        // ===============================
        // REAL-TIME SIMULATION
        // ===============================
        if (realTimeInterval) clearInterval(realTimeInterval);
        realTimeInterval = setInterval(updateRealTimeDuration, 5000);

        // Save route history
        saveRouteToHistory(sourceStr, destStr, routeType);

    } catch (error) {
        console.error("OSRM error:", error);
        alert(error.message);
        document.getElementById("route-details").classList.add("d-none");
    }
}

// ===============================
// REAL-TIME TRAFFIC SIMULATION
// ===============================
function updateRealTimeDuration() {
    if (!basePrimaryDuration) return;

    const variance = 0.95 + Math.random() * 0.1;
    const commentImpact = window.lastCommentCount * 0.02;

    const newDuration = basePrimaryDuration * (variance + commentImpact);

    document.getElementById("route-duration").textContent =
        formatDuration(newDuration) + " 🔄";
}

// ===============================
// HELPERS
// ===============================
function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    return totalMinutes < 60
        ? `${totalMinutes} min`
        : `${Math.floor(totalMinutes / 60)} hr ${totalMinutes % 60} min`;
}

function saveRouteToHistory(source, dest, routeType) {
    fetch('/api/save_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: source,
            destination: dest,
            route_type: routeType
        })
    }).catch(err => console.error("History save failed:", err));
}

// ===============================
// TRAFFIC PREDICTION HOOK
// ===============================
async function showPredictedTraffic(type) {
    if (typeof renderTrafficPrediction === 'function') {
        renderTrafficPrediction(type, map, predictionLayerGroup);
    } else {
        console.error("Prediction function not found");
    }
}

// ===============================
// COMMENTS SYSTEM
// ===============================
function fetchComments() {
    fetch('/api/comments')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('comments-list');
            if (!list) return;

            list.innerHTML = '';

            if (data.length === 0) {
                list.innerHTML = '<li class="text-muted small text-center">No updates yet.</li>';
                return;
            }

            data.forEach(comment => {
                const li = document.createElement('li');
                li.textContent = `${comment.user_name}: ${comment.comment}`;
                list.appendChild(li);
            });

            window.lastCommentCount = data.length;
        })
        .catch(err => console.error("Comments fetch error:", err));
}

function submitComment() {
    const routeName = document.getElementById('comment-route').value;
    const commentText = document.getElementById('comment-text').value;

    if (!routeName || !commentText) {
        alert("Please enter both Route and Comment.");
        return;
    }

    fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_name: routeName, comment: commentText })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('comment-route').value = '';
            document.getElementById('comment-text').value = '';
            fetchComments();
        }
    })
    .catch(err => console.error(err));
}