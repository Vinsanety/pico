/* ===== DOM Elements ===== */
const form = document.getElementById("peak-form");
const myPeakCount = document.getElementById("my-peak-count");
const dateInput = document.getElementById("peak-date");
const peakInput = document.getElementById("peak-input");
const peakSuggestions = document.getElementById("peak-suggestions");
const elevationInput = document.getElementById("peak-elevation");
const addPeakPreview = document.getElementById("add-peak-preview");
const previewModeBanner = document.getElementById("preview-mode-banner");
const mapView = document.getElementById("map");
const mySummitsTable = document.getElementById("my-summits-table");
const mySummitsList = document.getElementById("recent-summits-list");
const mapRadio = document.getElementById("map-view-radio");
const tableRadio = document.getElementById("table-view-radio");

/* ===== State ===== */
let peaks = JSON.parse(localStorage.getItem("peaks")) || [];
let map;
let userMarkersCluster;
let previewMarker = null;
let showingTable = false;

/* ===== Helper Functions ===== */
function formatPeakName(name) {
  return name.split(",")[0];
}

function getLocationFromPeakName(fullName) {
  return fullName.split(", ").slice(1).join(", ");
}

function formatDateUS(isoDateStr) {
  if (!isoDateStr) return "";
  const [year, month, day] = isoDateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

/* ===== Map/Table Toggle ===== */
mapRadio.addEventListener("change", () => {
  if (mapRadio.checked) {
    mySummitsTable.classList.remove("active");
    mapView.classList.add("active");
    renderMapMarkers();
    showingTable = false;
  }
});
tableRadio.addEventListener("change", () => {
  if (tableRadio.checked) {
    mapView.classList.remove("active");
    mySummitsTable.classList.add("active");
    renderMySummitsTable();
    showingTable = true;
  }
});

/* ===== OSM Elevation API Fetch  ===== */
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

/* ===== My Summits - List (last 5) ===== */
function renderRecentSummitsList() {
  mySummitsList.innerHTML = "";
  const recentPeaks = peaks.slice(-5).reverse();

  recentPeaks.forEach((peak) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <span>${formatPeakName(peak.name)}</span>
        <span class="muted">${
          peak.date ? " on " + formatDateUS(peak.date) : ""
        }</span>
      </div>
    `;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "\u2715";
    delBtn.onclick = () => {
      if (confirm(`Are you sure you want to Delete ${peak.name}?`)) {
        peaks = peaks.filter((p) => p.name !== peak.name);
        savePeaks();
        renderRecentSummitsList();
        renderMySummitsTable();
        renderMapMarkers();
        showToast(`Removed ${peak.name}`, "destructive");
      }
    };

    li.appendChild(delBtn);
    mySummitsList.appendChild(li);
  });
  myPeakCount.textContent = peaks.length;
}

/* ===== My Summits - Table ===== */
function renderMySummitsTable() {
  mySummitsTable.innerHTML = "";

  const table = document.createElement("table");
  table.className = "summits-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Location</th>
      <th>Elevation (ft)</th>
      <th>Date</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  peaks.forEach((peak) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatPeakName(peak.name)}</td>
      <td>${getLocationFromPeakName(peak.name)}</td>
      <td>${
        peak.elevation.toLocaleString("en-US") ? peak.elevation + " ft" : " - "
      }</td>
      <td>${peak.date ? formatDateUS(peak.date) : " - "}</td>
    `;

    const actionTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "\u2715";
    delBtn.onclick = () => {
      if (confirm(`Are you sure you want to delete ${peak.name}?`)) {
        peaks = peaks.filter((p) => p.name !== peak.name);
        savePeaks();
        renderRecentSummitsList();
        renderMySummitsTable();
        renderMapMarkers();
        showToast(`Removed ${peak.name}`, "destructive");
      }
    };
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  mySummitsTable.appendChild(table);
}

/* ===== Date Input ===== */
dateInput.addEventListener("input", () => {
  if (addPeakPreview.classList.contains("show")) {
    // Grab the last peakData shown (you can store it globally when calling showAddPeakPreview)
    const currentPeak = {
      name: peakInput.value,
      city: peakInput.dataset.city || "",
      state: peakInput.dataset.state || "",
      elevation: peakInput.dataset.elevation || "",
      lat: peakInput.dataset.lat || null,
      lon: peakInput.dataset.lon || null,
    };
    showAddPeakPreview(currentPeak);
  }
});

/* ===== Map Setup ===== */
var usaBounds = [
  [24.396308, -125.0],
  [49.384358, -66.93457],
];

function initMap() {
  map = L.map("map", {
    zoom: 4.5,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    noWrap: true,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
    minZoom: 2, // prevent zooming out too far
    maxZoom: 18, // prevent zooming in beyond tile availability
  }).addTo(map);

  // Lock panning to the world bounds
  map.setMaxBounds([
    [-90, -180],
    [90, 180],
  ]);

  // Refit to USA on resize
  window.addEventListener("resize", function () {
    map.invalidateSize();
    map.fitBounds(usaBounds);
  });

  userMarkersCluster = L.markerClusterGroup();
  map.addLayer(userMarkersCluster);
}

/* ===== Render Map Markers ===== */
function renderMapMarkers() {
  userMarkersCluster.clearLayers();
  peaks.forEach((peak) => {
    if (peak.lat && peak.lon) {
      const popupHtml = `
      <div class="peak-popup">
      <h5 class="peak-popup-heading">Logged Summit</h5>
      <p class="peak-popup-data">
          <span class="peak-popup-label">📍&nbsp;Summit</span>
          <span class="peak-popup-value">${formatPeakName(peak.name)}</span>
        </p>
        ${
          peak.elevation
            ? `<p class="peak-popup-data">
                <span class="peak-popup-label">↗️&nbsp;Elevation</span>
                <span class="peak-popup-value">${peak.elevation.toLocaleString(
                  "en-US"
                )} ft</span>
                </p>`
            : ""
        }
        ${
          peak.date
            ? `<p class="peak-popup-data">
                <span class="peak-popup-label">🗓&nbsp;Latest</span>
                <span class="peak-popup-value">${formatDateUS(peak.date)}</span>
              </p>`
            : ""
        }
        </div>
      `;

      const marker = L.marker([peak.lat, peak.lon], {
        icon: L.divIcon({
          className: "custom-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).bindPopup(popupHtml);

      userMarkersCluster.addLayer(marker);
    }
  });
}

/* ===== Shared Summit Filter ===== */
function filterSummits(results) {
  const summitTypes = [
    "peak",
    "volcano",
    "hill",
    "mountain",
    "ridge",
    "summit",
  ];

  return results.filter(
    (r) => r.class === "natural" && summitTypes.includes(r.type)
  );
}

/* ===== Map Live Preview ===== */
previewModeBanner.addEventListener("click", () => showAddPeakPreview(null));

function showAddPeakPreview(peakData) {
  if (!peakData) {
    previewModeBanner.classList.remove("show");
    addPeakPreview.innerHTML = "";
    addPeakPreview.classList.remove("show");

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
    map.fitBounds(usaBounds);
    return;
  }

  previewModeBanner.classList.add("show");
  addPeakPreview.classList.add("show");

  addPeakPreview.innerHTML = `
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
      .bindPopup(
        `<div class="peak-popup peak-popup-preview">
          <h5 class="peak-popup-heading">Peak to add</h5>
          <span class="peak-popup-preview-value">${peakData.name}</span>
        </div>`
      )
      .openPopup();
  }
}

/* ===== Shared Summit Filter ===== */
function filterSummits(results) {
  const summitTypes = [
    "peak",
    "volcano",
    "hill",
    "mountain",
    "ridge",
    "summit",
  ];

  return results.filter(
    (r) => r.class === "natural" && summitTypes.includes(r.type)
  );
}

/* ===== Typeahead Autocomplete (OSM + Elevation) ===== */
let debounceTimer;

peakInput.addEventListener("input", () => {
  const query = peakInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    peakSuggestions.innerHTML = "";
    peakSuggestions.classList.remove("show");
    return;
  }

  debounceTimer = setTimeout(async () => {
    peakSuggestions.innerHTML = "";
    // Show spinner while fetching
    const spinner = document.createElement("li");
    spinner.className = "spinner";
    spinner.textContent = "Loading...";
    peakSuggestions.appendChild(spinner);
    peakSuggestions.classList.add("show");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&q=${encodeURIComponent(
          query
        )}`
      );

      const results = await res.json();
      const peaksOnly = filterSummits(results);
      peakSuggestions.innerHTML = "";

      if (peaksOnly.length > 0) {
        peakSuggestions.classList.add("show");

        for (const r of peaksOnly.slice(0, 5)) {
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

            peakSuggestions.innerHTML = "";
            peakSuggestions.classList.remove("show");

            showAddPeakPreview({
              name: r.display_name,
              elevation: elev,
              lat,
              lon,
              city: peakInput.dataset.city,
              state: peakInput.dataset.state,
            });
          });
          peakSuggestions.appendChild(li);
        }
      } else {
        const noRes = document.createElement("li");
        noRes.className = "no-results";
        noRes.textContent = "No summit found";
        peakSuggestions.appendChild(noRes);
        peakSuggestions.classList.add("show");
      }
    } catch (err) {
      console.error("Autocomplete error:", err);
      peakSuggestions.innerHTML = "";
      peakSuggestions.classList.remove("show");
    }
  }, 300);
});
// Close peakSuggestions if clicking outside
document.addEventListener("click", (e) => {
  if (!peakSuggestions.contains(e.target) && e.target !== peakInput) {
    peakSuggestions.classList.remove("show");
  }
});

/* ===== Toast Message ===== */
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

/* ===== Form Submission ===== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  addPeakPreview.classList.remove("show");
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
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&q=${encodeURIComponent(
          name
        )}`
      );
      const results = await res.json();

      const peaksOnly = filterSummits(results);

      if (peaksOnly.length === 0) {
        alert(
          "That doesn't look like a summit. Please pick a peak, volcano, or hill."
        );
        return;
      }

      const best = peaksOnly[0];
      lat = parseFloat(best.lat);
      lon = parseFloat(best.lon);
      city =
        best.address.city ||
        best.address.town ||
        best.address.village ||
        best.address.county ||
        "";
      state = best.address.state || best.address.region || "";

      if (!elevation) {
        elevation = await getElevationFromOSM(lat, lon);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  }

  const peakData = { name, elevation, lat, lon, date, city, state };
  peaks.push(peakData);
  savePeaks();
  renderRecentSummitsList();
  renderMySummitsTable();
  renderMapMarkers();
  showToast(`Added ${name}`, "success");
  form.reset();
  peakInput.dataset.lat = "";
  peakInput.dataset.lon = "";
  peakInput.dataset.elevation = "";
  peakInput.dataset.city = "";
  peakInput.dataset.state = "";
  showAddPeakPreview(null);
});

/* ===== Start App ===== */
function init() {
  initMap();
  renderRecentSummitsList();
  renderMapMarkers();
  // Ensure hidden by default on load
  peakSuggestions.classList.remove("show");
  addPeakPreview.classList.remove("show");
  map.fitBounds(usaBounds);
}

init();
