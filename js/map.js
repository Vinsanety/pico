import { formatDateUS } from "../js/utils.js";

let map;
let userMarkersCluster;
let previewMarker = null;

export function initMap() {
  map = L.map("map", {
    center: [39.5, -98.35],
    zoom: 4.5,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  userMarkersCluster = L.markerClusterGroup();
  map.addLayer(userMarkersCluster);
}

export function renderUserMarkers(peaks) {
  if (!userMarkersCluster) return;
  userMarkersCluster.clearLayers();
  peaks.forEach((peak) => {
    if (peak.lat && peak.lon) {
      const marker = L.marker([peak.lat, peak.lon]).bindPopup(
        `<strong>${peak.name}</strong><br>
         ${peak.city ? peak.city + ", " : ""}${peak.state || ""}<br>
         ${peak.elevation ? `Elevation: ${peak.elevation} ft` : ""}`
      );
      userMarkersCluster.addLayer(marker);
    }
  });
}

export function showPreviewOnMap(peakData, dateValue) {
  const previewBox = document.getElementById("peak-preview");
  const previewBanner = document.getElementById("preview-banner");

  if (!peakData) {
    previewBanner.classList.remove("show");
    previewBox.innerHTML = "";
    previewBox.classList.remove("show");
    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }
    // map.setView([20, 0], 2);
    centerDefault();
    return;
  }

  previewBanner.classList.add("show");
  previewBox.classList.add("show");

  previewBox.innerHTML = `
  <h5 class="muted">Peak to add</h5>
    ${
      dateValue
        ? `<p class="preview-data">
            <span class="preview-label">Date:</span>
            <span class="preview-value">${formatDateUS(dateValue)}</span>
          </p>`
        : ""
    }
    <p class="preview-data">
      <span class="preview-label">Summit:</span>
      <span class="preview-value">${peakData.name}</span>
    </p>
    ${
      peakData.elevation
        ? `<p class="preview-data">
            <span class="preview-label">Elevation:</span>
            <span class="preview-value">${peakData.elevation} ft</span>
          </p>`
        : ""
    }
  `;

  if (peakData.lat && peakData.lon) {
    map.setView([peakData.lat, peakData.lon], 8);
    if (previewMarker) map.removeLayer(previewMarker);
    previewMarker = L.marker([peakData.lat, peakData.lon])
      .addTo(map)
      .bindPopup(`<strong>${peakData.name}</strong>`)
      .openPopup();
  }
}

export function centerDefault() {
  if (map) map.setView([39.5, -98.35], 4.5);
}
