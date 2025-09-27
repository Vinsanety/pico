// ===== DOM Elements =====
const form = document.getElementById("peak-form");
const peaksList = document.getElementById("peaks");
const peakCount = document.getElementById("peak-count");
const peakInput = document.getElementById("peak-input");
const suggestions = document.getElementById("suggestions");
const dateInput = document.getElementById("peak-date");
const previewBox = document.getElementById("peak-preview");
const elevationInput = document.getElementById("peak-elevation");

// ===== State =====
let peaks = JSON.parse(localStorage.getItem("peaks")) || [];
let map;
let userMarkersCluster;
let previewMarker = null;

async function getElevationFromOSM(lat, lon) {
  // Overpass query: find nodes/ways with ele=* within ~100m of the point
  const query = `
    [out:json];
    (
      node(around:100,${lat},${lon})["ele"];
      way(around:100,${lat},${lon})["ele"];
    );
    out center 1;
  `;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    const data = await res.json();
    if (data.elements && data.elements.length > 0) {
      const eleTag = data.elements[0].tags.ele;
      if (eleTag) {
        // Try to parse as number
        const meters = parseFloat(eleTag);
        if (!isNaN(meters)) {
          return Math.round(meters * 3.28084); // feet
        }
      }
    }
  } catch (err) {
    console.error("Overpass elevation lookup failed:", err);
  }
  return null; // fallback if no ele tag
}

function savePeaks() {
  localStorage.setItem("peaks", JSON.stringify(peaks));
}

function renderPeaks() {
  peaksList.innerHTML = "";
  peaks.forEach((peak, index) => {
    const li = document.createElement("li");
    li.textContent = `${peak.name}${peak.city ? " - " + peak.city : ""}${
      peak.elevation ? " - " + peak.elevation + " ft" : ""
    }`;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "❌";
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
    center: [39.5, -98.35],
    zoom: 4.5,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  userMarkersCluster = L.markerClusterGroup();
  map.addLayer(userMarkersCluster);
}

function renderUserMarkers() {
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

// ===== Live Preview =====
const previewBanner = document.createElement("div");
previewBanner.id = "preview-banner";
previewBanner.textContent = "🔍 Preview Mode — Click to exit";
document.getElementById("map").appendChild(previewBanner);

previewBanner.addEventListener("click", () => showPreview(null));

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
    ${peakData.city ? peakData.city + ", " : ""}${peakData.state || ""}<br>
    ${peakData.elevation ? `Elevation: ${peakData.elevation} ft` : ""}
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

// ===== Typeahead Autocomplete (OSM + Elevation) =====
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

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          query
        )}`
      );
      const results = await res.json();

      for (const r of results.slice(0, 5)) {
        const li = document.createElement("li");
        li.textContent = r.display_name;
        li.addEventListener("click", async () => {
          const lat = parseFloat(r.lat);
          const lon = parseFloat(r.lon);
          const elev = await getElevationFromOSM(lat, lon);

          peakInput.value = r.display_name;
          peakInput.dataset.lat = lat;
          peakInput.dataset.lon = lon;
          peakInput.dataset.elevation = elev || "";
          peakInput.dataset.city =
            r.address.city || r.address.town || r.address.village || "";
          peakInput.dataset.state = r.address.state || "";
          suggestions.innerHTML = "";

          showPreview({
            name: r.display_name,
            elevation: elev,
            lat,
            lon,
            city: peakInput.dataset.city,
            state: peakInput.dataset.state,
          });
        });
        suggestions.appendChild(li);
      }
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
  }, 300);
});

// ===== Form Submission =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = peakInput.value.trim();
  const date = dateInput.value;
  let elevation = elevationInput.value
    ? parseInt(elevationInput.value, 10)
    : peakInput.dataset.elevation
    ? parseInt(peakInput.dataset.elevation, 10)
    : null;

  if (!name) {
    alert("Please enter a peak name.");
    return;
  }

  let lat = parseFloat(peakInput.dataset.lat) || null;
  let lon = parseFloat(peakInput.dataset.lon) || null;
  let city = peakInput.dataset.city || "";
  let state = peakInput.dataset.state || "";

  // If no coords yet, geocode
  if (!lat || !lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          name
        )}`
      );
      const results = await res.json();
      if (results.length > 0) {
        lat = parseFloat(results[0].lat);
        lon = parseFloat(results[0].lon);
        city =
          results[0].address.city ||
          results[0].address.town ||
          results[0].address.village ||
          "";
        state = results[0].address.state || "";
        if (!elevation) {
          elevation = await getElevationFromOSM(lat, lon);
        }
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  }

  const peakData = { name, elevation, lat, lon, date, city, state };
  peaks.push(peakData);
  savePeaks();
  renderPeaks();
  renderUserMarkers();
  form.reset();
  peakInput.dataset.lat = "";
  peakInput.dataset.lon = "";
  peakInput.dataset.elevation = "";
  peakInput.dataset.city = "";
  peakInput.dataset.state = "";
  showPreview(null);
});

// ===== Start App =====
function init() {
  initMap();
  renderPeaks();
  renderUserMarkers();
}

init();
