// static/js/prediction.js
console.log("Prediction JS loaded");

async function renderTrafficPrediction(type, mapInstance, predictionLayerGroup) {
    if (!predictionLayerGroup || !mapInstance) return;
    
    const sourceInput = document.getElementById("source-input") ? document.getElementById("source-input").value : "";
    let centerLatLng;

    if (sourceInput) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sourceInput)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                centerLatLng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        } catch (e) {
            console.error("Geocoding failed for prediction:", e);
        }
    }

    // Fallback to map center if no source or geocoding failed
    if (!centerLatLng) {
        const center = mapInstance.getCenter();
        centerLatLng = { lat: center.lat, lng: center.lng };
    }

    // Fetch prediction from backend
    try {
        const response = await fetch(`/api/nearby_traffic_prediction?lat=${centerLatLng.lat}&lng=${centerLatLng.lng}&type=${type}`);
        const result = await response.json();
        
        // Clear existing prediction layers
        predictionLayerGroup.clearLayers();

        const bounds = [];
        
        let routesToProcess = [];
        if (window.currentRouteData) {
            if (window.currentRouteData.primary) routesToProcess.push(window.currentRouteData.primary.geometry.coordinates);
            if (window.currentRouteData.alternate) routesToProcess.push(window.currentRouteData.alternate.geometry.coordinates);
        }

        if (routesToProcess.length === 0) {
            alert("Please calculate a route first to see traffic density along it.");
            return;
        }

        routesToProcess.forEach(coords => {
            for (let i = 0; i < coords.length - 1; i++) {
                const pt1 = coords[i];
                const pt2 = coords[i+1];
                const midLat = (pt1[1] + pt2[1]) / 2;
                const midLng = (pt1[0] + pt2[0]) / 2;

                let highestDensity = 'low';
                
                result.points.forEach(p => {
                    const dist = mapInstance.distance([midLat, midLng], [p.lat, p.lng]);
                    if (dist <= p.radius * 0.8) {
                        highestDensity = 'high';
                    } else if (dist <= p.radius * 1.5 && highestDensity !== 'high') {
                        highestDensity = 'medium';
                    }
                });

                let color = '#2b9348'; // Green (low traffic)
                if (highestDensity === 'high') color = '#d90429'; // Red (high traffic)
                else if (highestDensity === 'medium') color = '#ffb703'; // Yellow (medium traffic)

                const segment = L.polyline([[pt1[1], pt1[0]], [pt2[1], pt2[0]]], {
                    color: color,
                    weight: 6,
                    opacity: 1,
                    lineJoin: 'round'
                });
                predictionLayerGroup.addLayer(segment);
                bounds.push([pt1[1], pt1[0]]);
            }
            if (coords.length > 0) {
                const lastPt = coords[coords.length - 1];
                bounds.push([lastPt[1], lastPt[0]]);
            }
        });

        if (bounds.length > 0) {
            mapInstance.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
        }
    } catch (error) {
        console.error("Failed to fetch traffic prediction:", error);
    }
}
