// ===== DOM Elements =====
const form = document.getElementById("peak-form");
const peaksList = document.getElementById("peaks");
const peakCount = document.getElementById("peak-count");
const peakInput = document.getElementById("peak-input");
const suggestions = document.getElementById("suggestions");
const totalPeaksEl = document.getElementById("total-peaks");
const dateInput = document.getElementById("peak-date");
const previewBox = document.getElementById("peak-preview");
const explorableToggle = document.getElementById("explorable-toggle");

// ===== State =====
let peaks = JSON.parse(localStorage.getItem("peaks")) || [];
let allPeaks = []; // dataset peaks
let map;
let userMarkersCluster;
let datasetMarkersCluster;
let previewMarker = null;

// ===== Custom Icons =====
const previewIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  shadowUrl: "https://unpkg.com/leaflet/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ===== Helpers =====
function metersToFeet(m) {
  return Math.round(m * 3.28084);
}

function savePeaks() {
  localStorage.setItem("peaks", JSON.stringify(peaks));
}

function renderPeaks() {
  peaksList.innerHTML = "";
  peaks.forEach((peak, index) => {
    const li = document.createElement("li");
    li.textContent = `${peak.name} - ${
      peak.height ? peak.height + " ft" : "unknown height"
    } - ${peak.date || "no date"} `;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "❌";
    delBtn.title = "Delete this peak";
    delBtn.style.marginLeft = "8px";
    delBtn.onclick = () => {
      if (confirm(`Delete ${peak.name}?`)) {
        peaks.splice(index, 1);
        savePeaks();
        renderPeaks();
        renderUserMarkers();
      }
    };

    li.appendChild(delBtn);
    peaksList.appendChild(li);
  });
  peakCount.textContent = peaks.length;
}

// ===== Map Setup =====
function initMap() {
  map = L.map("map", {
    center: [39.5, -98.35], // USA center
    zoom: 4.5,
    worldCopyJump: false,
    maxBounds: [
      [85, -180],
      [-85, 180],
    ],
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    noWrap: true,
  }).addTo(map);

  datasetMarkersCluster = L.markerClusterGroup();
  userMarkersCluster = L.markerClusterGroup();
  map.addLayer(userMarkersCluster);
}

function renderUserMarkers() {
  userMarkersCluster.clearLayers();
  peaks.forEach((peak) => {
    if (peak.lat && peak.lon) {
      const marker = L.marker([peak.lat, peak.lon]).bindPopup(
        `<strong>${peak.name}</strong><br>
             ${peak.height ? `Height: ${peak.height} ft<br>` : ""}
             ${peak.date ? `Date: ${peak.date}` : ""}`
      );
      userMarkersCluster.addLayer(marker);
    }
  });
}

function renderDatasetMarkers() {
  datasetMarkersCluster.clearLayers();
  allPeaks.forEach((p) => {
    if (p.lat && p.lon) {
      const marker = L.marker([p.lat, p.lon]).bindPopup(
        `<strong>${p.name}</strong><br>
             ${
               p.height
                 ? `Height: ${metersToFeet(p.height)} ft`
                 : "Height: unknown"
             }`
      );
      datasetMarkersCluster.addLayer(marker);
    }
  });
}

// ===== Live Preview =====
const mapContainer = document.getElementById("map");

const previewBanner = document.createElement("div");
previewBanner.id = "preview-banner";
previewBanner.textContent = "🔍 Preview Mode — Click to exit";
mapContainer.appendChild(previewBanner);

previewBanner.addEventListener("click", () => {
  showPreview(null);
});

function showPreview(peakData) {
  if (!peakData) {
    previewBanner.classList.remove("show");
    previewBox.innerHTML = "";

    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }

    map.setView([20, 0], 2);
    return;
  }

  previewBanner.classList.add("show");

  previewBox.innerHTML = `
        <strong>${peakData.name}</strong><br>
        ${peakData.height ? `Height: ${peakData.height} ft<br>` : ""}
        ${
          peakData.lat && peakData.lon
            ? `Lat: ${peakData.lat}, Lon: ${peakData.lon}`
            : ""
        }
      `;

  if (peakData.lat && peakData.lon) {
    map.setView([peakData.lat, peakData.lon], 8);

    if (previewMarker) {
      map.removeLayer(previewMarker);
    }

    previewMarker = L.marker([peakData.lat, peakData.lon], {
      icon: previewIcon,
    })
      .addTo(map)
      .bindPopup(`<strong>${peakData.name}</strong>`)
      .openPopup();
  }
}

// ===== Explorable Toggle =====
function applyExplorableToggle() {
  if (!explorableToggle) return;

  // Initial state
  if (explorableToggle.checked) {
    map.addLayer(datasetMarkersCluster);
  } else if (map.hasLayer(datasetMarkersCluster)) {
    map.removeLayer(datasetMarkersCluster);
  }

  explorableToggle.addEventListener("change", () => {
    if (explorableToggle.checked) {
      map.addLayer(datasetMarkersCluster);
    } else if (map.hasLayer(datasetMarkersCluster)) {
      map.removeLayer(datasetMarkersCluster);
    }
  });
}

// ===== Fetch Open Peaks Data =====
async function init() {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/open-peaks/data/master/_index.geojson"
    );
    const data = await res.json();

    allPeaks = data.features.map((f) => ({
      name: f.properties.name,
      height: f.properties.meters,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));

    totalPeaksEl.textContent = allPeaks.length.toLocaleString();
    initMap();
    renderDatasetMarkers(); // prepare dataset markers
    renderPeaks();
    renderUserMarkers();
    applyExplorableToggle();
  } catch (err) {
    console.error("Error fetching peaks:", err);
    totalPeaksEl.textContent = "Error loading";
  }
}

// ===== Typeahead Autocomplete =====
let debounceTimer;

peakInput.addEventListener("input", () => {
  const query = peakInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    suggestions.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(async () => {
    suggestions.innerHTML = "";

    // 1. Match against Open Peaks dataset first
    const matches = allPeaks.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    matches.slice(0, 5).forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.name} (${metersToFeet(p.height)} ft)`;
      li.addEventListener("click", () => {
        peakInput.value = p.name;
        peakInput.dataset.lat = p.lat;
        peakInput.dataset.lon = p.lon;
        peakInput.dataset.height = metersToFeet(p.height);
        suggestions.innerHTML = "";

        showPreview({
          name: p.name,
          height: metersToFeet(p.height),
          lat: p.lat,
          lon: p.lon,
        });
      });
      suggestions.appendChild(li);
    });

    // 2. If no dataset matches, fallback to Nominatim
    if (matches.length === 0) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}`
        );
        const results = await res.json();

        results.slice(0, 5).forEach((r) => {
          const li = document.createElement("li");
          li.textContent = r.display_name;
          li.addEventListener("click", () => {
            peakInput.value = r.display_name;
            peakInput.dataset.lat = r.lat;
            peakInput.dataset.lon = r.lon;
            peakInput.dataset.height = "";
            suggestions.innerHTML = "";

            showPreview({
              name: r.display_name,
              height: null,
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon),
            });
          });
          suggestions.appendChild(li);
        });
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }
  }, 300);
});

// ===== Form Submission =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = peakInput.value.trim();
  const date = dateInput.value;

  if (!name) {
    alert("Please enter a peak name.");
    return;
  }

  let lat = parseFloat(peakInput.dataset.lat) || null;
  let lon = parseFloat(peakInput.dataset.lon) || null;
  let height = peakInput.dataset.height
    ? parseInt(peakInput.dataset.height, 10)
    : null;

  // If no dataset info, fallback geocode
  if (!lat || !lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          name
        )}`
      );
      const results = await res.json();
      if (results.length > 0) {
        lat = parseFloat(results[0].lat);
        lon = parseFloat(results[0].lon);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  }

  const peakData = {
    name,
    height,
    lat,
    lon,
    date,
  };

  peaks.push(peakData);
  savePeaks();
  renderPeaks();
  renderUserMarkers();
  form.reset();
  peakInput.dataset.lat = "";
  peakInput.dataset.lon = "";
  peakInput.dataset.height = "";
  showPreview(null);
});

// ===== Start App =====
init();
