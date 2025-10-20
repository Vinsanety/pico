/* ===== DOM Elements ===== */
const addSummitForm = document.getElementById("add-summit-form");
const mySummitCount = document.getElementById("my-summit-count");
const dateInput = document.getElementById("summit-date");
const summitInput = document.getElementById("summit-input");
const peakSuggestions = document.getElementById("peak-suggestions");
const elevationInput = document.getElementById("summit-elevation");
const addSummmitPreview = document.getElementById("add-summit-preview");
const previewModeBanner = document.getElementById("preview-mode-banner");
const mapView = document.getElementById("map");
const mySummitsTable = document.getElementById("my-summits-table");
const mySummitsList = document.getElementById("recent-summits-list");
const mapRadio = document.getElementById("map-view-radio");
const tableRadio = document.getElementById("table-view-radio");
const editSubmissionModal = document.getElementById("edit-submission-modal");
const editSummitDate = document.getElementById("edit-summit-date");

/* ===== State ===== */
let peaks = JSON.parse(localStorage.getItem("peaks")) || [];
let map;
let userMarkersCluster;
let previewMarker = null;
let showingTable = false;

/* ===== Helper Functions ===== */
// Takes peak.name and returns just the first part (i.e. "Longs Peak")
function formatPeakName(name) {
  return name.split(",")[0];
}

// Takes peak.name and returns location (i.e. "Boulder County, Colorado, United States")
function getLocationFromPeakName(fullName) {
  return fullName.split(", ").slice(1).join(", ");
}

// Formats dates from peak.date (i.e. "1/1/2025")
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

/* ===== My Summits / Add Summit Form Toggle ===== */
const myRecentSummitsContainer = document.getElementById(
  "my-recent-summits-container"
);
const addSummitBtn = document.getElementById("add-summit-btn");
const cancelAddSummitBtn = document.getElementById("cancel-add-summit-btn");
function showForm() {
  myRecentSummitsContainer.classList.remove("active");
  addSummitForm.classList.add("active");
}
function showMySummits() {
  addSummitForm.classList.remove("active");
  myRecentSummitsContainer.classList.add("active");
}
addSummitBtn.addEventListener("click", showForm);
cancelAddSummitBtn.addEventListener("click", showMySummits);

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

    const delBtn = createDeleteButton(peak);
    li.appendChild(delBtn);
    mySummitsList.appendChild(li);
  });
  mySummitCount.textContent = peaks.length;
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

  // Sort peaks by date (newest first)
  const sortedPeaks = [...peaks].sort((a, b) => {
    if (!a.date) return 1; // push undated to bottom
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  sortedPeaks.forEach((peak) => {
    const tr = document.createElement("tr");

    let dateCellContent = peak.date
      ? formatDateUS(peak.date)
      : `<span class="no-date-badge">No date</span>`;

    tr.innerHTML = `
      <td>${formatPeakName(peak.name)}</td>
      <td>${getLocationFromPeakName(peak.name)}</td>
      <td>
        ${
          peak.elevation
            ? peak.elevation.toLocaleString("en-US") + " ft"
            : " - "
        }
      </td>
      <td>${dateCellContent}</td>
    `;

    tr.innerHTML = `
      <td>${formatPeakName(peak.name)}</td>
      <td>${getLocationFromPeakName(peak.name)}</td>
      <td>${
        peak.elevation ? peak.elevation.toLocaleString("en-US") + " ft" : " - "
      }</td>
      <td>${dateCellContent}</td>
    `;

    const actionTd = document.createElement("td");
    actionTd.className = "actions-td";

    actionTd.appendChild(createEditButton(peak));
    actionTd.appendChild(createDeleteButton(peak));

    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  mySummitsTable.appendChild(table);
}

/* ===== Date Input ===== */
dateInput.addEventListener("input", () => {
  if (addSummmitPreview.classList.contains("show")) {
    // Grab the last peakData shown (you can store it globally when calling showAddPeakPreview)
    const currentPeak = {
      name: summitInput.value,
      city: summitInput.dataset.city || "",
      state: summitInput.dataset.state || "",
      elevation: summitInput.dataset.elevation || "",
      lat: summitInput.dataset.lat || null,
      lon: summitInput.dataset.lon || null,
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
    addSummmitPreview.innerHTML = "";
    addSummmitPreview.classList.remove("show");

    if (summitInput) {
      summitInput.value = "";
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
  addSummmitPreview.classList.add("show");

  addSummmitPreview.innerHTML = `
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

summitInput.addEventListener("input", () => {
  const query = summitInput.value.trim();
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

            summitInput.value = r.display_name;
            summitInput.dataset.lat = lat;
            summitInput.dataset.lon = lon;
            summitInput.dataset.elevation = elev || "";
            summitInput.dataset.city =
              r.address.city || r.address.town || r.address.village || "";
            summitInput.dataset.state = r.address.state || "";

            peakSuggestions.innerHTML = "";
            peakSuggestions.classList.remove("show");

            showAddPeakPreview({
              name: r.display_name,
              elevation: elev,
              lat,
              lon,
              city: summitInput.dataset.city,
              state: summitInput.dataset.state,
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
  if (!peakSuggestions.contains(e.target) && e.target !== summitInput) {
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

/* ===== Add Summit Form Submission ===== */
addSummitForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  addSummmitPreview.classList.remove("show");
  const name = summitInput.value.trim();
  const date = dateInput.value;
  let elevation = elevationInput.value
    ? parseInt(elevationInput.value, 10)
    : summitInput.dataset.elevation
    ? parseInt(summitInput.dataset.elevation, 10)
    : null;

  if (!name) {
    alert("Please enter a peak name.");
    return;
  }

  let lat = parseFloat(summitInput.dataset.lat) || null;
  let lon = parseFloat(summitInput.dataset.lon) || null;
  let city = summitInput.dataset.city || "";
  let state = summitInput.dataset.state || "";

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

  const peakData = {
    id: Date.now(),
    name,
    elevation,
    lat,
    lon,
    date,
    city,
    state,
  };
  peaks.push(peakData);
  savePeaks();
  showMySummits();
  renderRecentSummitsList();
  renderMySummitsTable();
  renderMapMarkers();
  showToast(`Added ${name}`, "success");
  addSummitForm.reset();
  summitInput.dataset.lat = "";
  summitInput.dataset.lon = "";
  summitInput.dataset.elevation = "";
  summitInput.dataset.city = "";
  summitInput.dataset.state = "";
  showAddPeakPreview(null);
});

/* ===== Modal (Edit & Delete) ===== */
const appModal = document.getElementById("app-modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalActions = document.getElementById("modal-actions");

let lastFocusedElement = null;
let trapFocusHandler = null;

function escHandler(e) {
  if (e.key === "Escape") {
    closeModal();
  }
}

function openModal({ title, body, actions }) {
  // Save the element that was focused before opening
  lastFocusedElement = document.activeElement;

  modalTitle.textContent = title;
  modalBody.replaceChildren(body);
  modalActions.replaceChildren(...actions);
  appModal.classList.remove("hidden");

  // Trap focus
  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  const focusableEls = appModal.querySelectorAll(focusableSelectors.join(","));
  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];

  if (firstEl) {
    firstEl.focus();
  } else {
    // fallback: focus modal container
    const modalContent = appModal.querySelector(".modal-content");
    modalContent.setAttribute("tabindex", "-1");
    modalContent.focus();
  }

  trapFocusHandler = function (e) {
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  };

  document.addEventListener("keydown", escHandler);
  document.addEventListener("keydown", trapFocusHandler);

  // Click outside to close
  appModal.addEventListener("click", backdropHandler);
}

function backdropHandler(e) {
  if (e.target === appModal) {
    closeModal();
  }
}

function closeModal() {
  appModal.classList.add("hidden");
  document.removeEventListener("keydown", escHandler);

  if (trapFocusHandler) {
    document.removeEventListener("keydown", trapFocusHandler);
    trapFocusHandler = null;
  }

  appModal.removeEventListener("click", backdropHandler);

  // Remove tabindex fallback if it was added
  const modalContent = appModal.querySelector(".modal-content");
  if (modalContent.hasAttribute("tabindex")) {
    modalContent.removeAttribute("tabindex");
  }

  // Restore focus to the element that opened the modal
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// Icon Button that opens Edit Modal
function createEditButton(peak) {
  const btn = document.createElement("button");
  btn.className = "edit-btn";
  btn.textContent = "✎";
  btn.setAttribute("aria-label", `Edit ${peak.name}`);
  btn.onclick = () => openEditModal(peak);
  return btn;
}

// Edit Modal
function openEditModal(peak) {
  const form = document.createElement("form");
  form.id = "edit-form";

  const field = document.createElement("div");
  field.className = "form-field";

  const label = document.createElement("label");
  label.htmlFor = "edit-peak-date";
  label.textContent = "Date climbed";

  const input = document.createElement("input");
  input.id = "edit-peak-date";
  input.type = "date";
  input.name = "date";
  input.value = peak.date || "";

  field.append(label, input);
  form.appendChild(field);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "secondary-btn";
  cancelBtn.onclick = closeModal;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button"; // handle manually
  saveBtn.textContent = "Save";
  saveBtn.className = "primary-btn";

  saveBtn.onclick = () => {
    const idx = peaks.findIndex((p) => p.id === peak.id);
    if (idx !== -1) {
      peaks[idx].date = input.value;
      savePeaks();
      renderMySummitsTable();
      renderRecentSummitsList();
      renderMapMarkers();
      showToast(`Updated date for ${peaks[idx].name}`, "success");
    }
    closeModal();
  };

  openModal({
    title: `Edit Summit - ${formatPeakName(peak.name)}`,
    body: form,
    actions: [cancelBtn, saveBtn],
  });
}

// Icon Button that opens Delete Modal
function createDeleteButton(peak) {
  const btn = document.createElement("button");
  btn.className = "delete-btn";
  btn.textContent = "✕";
  btn.setAttribute("aria-label", `Delete ${peak.name}`);
  btn.onclick = () => openDeleteModal(peak);
  return btn;
}

// Delete Modal
function openDeleteModal(peak) {
  const message = document.createElement("p");
  message.style.whiteSpace = "pre-line";
  message.textContent = `Are you sure you want to delete ${formatPeakName(
    peak.name
  )} on ${formatDateUS(peak.date)}?\n\nThis action cannot be undone.`;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "secondary-btn";
  cancelBtn.onclick = closeModal;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "btn-destructive";
  deleteBtn.onclick = () => {
    peaks = peaks.filter((p) => p.id !== peak.id);
    savePeaks();
    renderRecentSummitsList();
    renderMySummitsTable();
    renderMapMarkers();
    showToast(`Removed ${peak.name}`, "destructive");
    closeModal();
  };

  openModal({
    title: "Confirm Delete",
    body: message,
    actions: [cancelBtn, deleteBtn],
  });
}

/* ===== Start App ===== */
function init() {
  initMap();
  renderRecentSummitsList();
  renderMapMarkers();
  // Ensure hidden by default on load
  peakSuggestions.classList.remove("show");
  addSummmitPreview.classList.remove("show");
  map.fitBounds(usaBounds);
}

init();
