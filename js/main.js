import { getElevationFromOSM } from "../js/utils.js";
import {
  initMap,
  renderUserMarkers,
  showPreviewOnMap,
  centerDefault,
} from "../js/map.js";
import { loadPeaks, savePeaks, renderPeaks } from "../js/storage.js";
import { showToast } from "../js/toast.js";

// ===== DOM Elements =====
const form = document.getElementById("peak-form");
const myPeaks = document.getElementById("my-peaks");
const peakCount = document.getElementById("peak-count");
const peakInput = document.getElementById("peak-input");
const suggestions = document.getElementById("suggestions");
const dateInput = document.getElementById("peak-date");
const previewBox = document.getElementById("peak-preview");
const elevationInput = document.getElementById("peak-elevation");
const previewBanner = document.getElementById("preview-banner");

function clearPeakInputData(inputEl) {
  inputEl.dataset.lat = "";
  inputEl.dataset.lon = "";
  inputEl.dataset.elevation = "";
  inputEl.dataset.city = "";
  inputEl.dataset.state = "";
}

// ===== State =====
let peaks = loadPeaks();

// ===== Preview Banner click handler =====
if (previewBanner) {
  previewBanner.addEventListener("click", () => showPreviewOnMap(null));
}

// Date input updates preview
dateInput.addEventListener("input", () => {
  if (previewBox.classList.contains("show")) {
    const currentPeak = {
      name: peakInput.value,
      city: peakInput.dataset.city || "",
      state: peakInput.dataset.state || "",
      elevation: peakInput.dataset.elevation || "",
      lat: peakInput.dataset.lat || null,
      lon: peakInput.dataset.lon || null,
    };
    showPreviewOnMap(currentPeak, dateInput.value);
  }
});

// ===== Typeahead Autocomplete (OSM + Elevation) =====
let debounceTimer;

peakInput.addEventListener("input", () => {
  const query = peakInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    suggestions.innerHTML = "";
    suggestions.classList.remove("show");
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
        suggestions.classList.add("show");
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
          suggestions.classList.remove("show");

          showPreviewOnMap(
            {
              name: r.display_name,
              elevation: elev,
              lat,
              lon,
              city: peakInput.dataset.city,
              state: peakInput.dataset.state,
            },
            dateInput.value
          );
        });
        suggestions.appendChild(li);
      }
    } catch (err) {
      console.error("Autocomplete error:", err);
      suggestions.classList.remove("show");
      showToast("Could not fetch location suggestions", "destructive");
    }
  }, 300);
});

// Close suggestions if clicking outside
document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== peakInput) {
    suggestions.classList.remove("show");
  }
});

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
      showToast("Could not fetch coordinates for that peak", "destructive");
    }
  }

  const peakData = { name, elevation, lat, lon, date, city, state };
  peaks = [...peaks, peakData];
  savePeaks(peaks);
  renderPeaks(peaks, {
    myPeaks,
    peakCount,
    renderUserMarkers,
    showToast,
  });
  renderUserMarkers(peaks);
  showToast(`Added ${name}`, "success");
  form.reset();
  clearPeakInputData(peakInput);
  showPreviewOnMap(null);
});

// ===== Start App =====
function init() {
  initMap();
  renderPeaks(peaks, {
    myPeaks,
    peakCount,
    renderUserMarkers,
    showToast,
  });

  suggestions.classList.remove("show");
  previewBox.classList.remove("show");
  centerDefault();
}

init();
