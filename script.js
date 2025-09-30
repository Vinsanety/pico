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
    delBtn.textContent = "\u2715";
    delBtn.onclick = () => {
      if (confirm(`Are you sure you want to Delete ${peak.name}?`)) {
        peaks.splice(index, 1);
        savePeaks();
        renderPeaks();
        renderUserMarkers();
        showToast(`Removed ${peak.name}`, "destructive");
      }
    };

    li.appendChild(delBtn);
    peaksList.appendChild(li);
  });
  peakCount.textContent = peaks.length;
}

/* ===Date Input=== */
dateInput.addEventListener("input", () => {
  if (previewBox.classList.contains("show")) {
    // Grab the last peakData shown (you can store it globally when calling showPreview)
    const currentPeak = {
      name: peakInput.value,
      city: peakInput.dataset.city || "",
      state: peakInput.dataset.state || "",
      elevation: peakInput.dataset.elevation || "",
      lat: peakInput.dataset.lat || null,
      lon: peakInput.dataset.lon || null,
    };
    showPreview(currentPeak);
  }
});

function formatDateUS(isoDateStr) {
  if (!isoDateStr) return "";
  const [year, month, day] = isoDateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day); // local date
  return dateObj.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
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
    previewBox.classList.remove("show");

    if (peakInput) {
      peakInput.value = "";
    }

    if (dateInput) {
      dateInput.value = "";
    }

    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }
    map.setView([20, 0], 2);
    return;
  }

  previewBanner.classList.add("show");
  previewBox.classList.add("show");

  previewBox.innerHTML = `
  <h5 class="muted">Peak to add</h5>
    ${
      dateInput.value
        ? `<p class="preview-data">
            <span class="preview-label">Date:</span>
            <span class="preview-value">
              ${formatDateUS(dateInput.value)}
            </span>
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

// ===== Typeahead Autocomplete (OSM + Elevation) =====
let debounceTimer;

peakInput.addEventListener("input", () => {
  const query = peakInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    suggestions.innerHTML = "";
    suggestions.classList.remove("show"); // hide suggestions
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

      if (results.length > 0) {
        suggestions.classList.add("show"); // show suggestions
      } else {
        suggestions.classList.remove("show");
      }

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
          suggestions.classList.remove("show"); // hide after selection

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
      suggestions.classList.remove("show");
    }
  }, 300);
});

// Close suggestions if clicking outside
document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== peakInput) {
    suggestions.classList.remove("show");
  }
});

// ===== Toast Message =====
let toastIdCounter = 0;
const toastQueue = [];
let activeToasts = 0;
const maxVisible = 3;

function showToast(message, type = "success") {
  toastQueue.push({ message, type, id: ++toastIdCounter });
  processQueue();
}

function processQueue() {
  if (activeToasts >= maxVisible || toastQueue.length === 0) return;

  const { message, type, id } = toastQueue.shift();
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.dataset.id = id;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "success" ? "✅ " : "🗑️ ";

  const text = document.createElement("span");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.insertBefore(toast, container.firstChild);

  requestAnimationFrame(() => toast.classList.add("show"));

  activeToasts++;

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
      activeToasts--;
      processQueue();
    }, 250);
  }, 5000);
}

// ===== Form Submission =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  previewBox.classList.remove("show");
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
  showToast(`Added ${name}`, "success");
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

  // Ensure hidden by default on load
  suggestions.classList.remove("show");
  previewBox.classList.remove("show");
  // Optional: center map to a neutral view
  map.setView([39.5, -98.35], 4.5);
}

init();
