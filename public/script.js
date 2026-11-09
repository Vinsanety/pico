/* ===== DOM Elements ===== */
const addSummitForm = document.getElementById("add-summit-form");
const mySummitCount = document.getElementById("my-summit-count");
const dateInput = document.getElementById("summit-date");
const summitInput = document.getElementById("summit-input");
const peakSuggestions = document.getElementById("peak-suggestions");
const elevationInput = document.getElementById("summit-elevation");
const addSummitPreview = document.getElementById("add-summit-preview");
const entryTitleInput = document.getElementById("summit-entry-title");
const entryNotesInput = document.getElementById("summit-entry-notes");
const mapView = document.getElementById("map");
const mySummitsList = document.getElementById("recent-summits-list");
const logSheet = document.getElementById("log-sheet");
const logbookView = document.getElementById("logbook-view");
const peakInfoView = document.getElementById("peak-info-view");
const peakInfoTitle = document.getElementById("peak-info-title");
const peakInfoBody = document.getElementById("peak-info-body");
const peakInfoBackBtn = document.getElementById("peak-info-back-btn");
const closePeakInfoBtn = document.getElementById("close-peak-info-btn");
const sheetEl = document.getElementById("my-recent-summits-container");
const addSummitBtn = document.getElementById("add-summit-btn");
const cancelAddSummitBtn = document.getElementById("cancel-add-summit-btn");
const openLogbookBtn = document.getElementById("open-logbook-btn");
const closeLogbookBtn = document.getElementById("close-logbook-btn");
const logbookSearch = document.getElementById("logbook-search");
const logbookSort = document.getElementById("logbook-sort");
const logbookMeta = document.getElementById("logbook-meta");
const logbookLoadMore = document.getElementById("logbook-load-more");
const logbookDetail = document.getElementById("logbook-detail");
const logbookStack = document.getElementById("logbook-stack");
const logbookPageDetail = document.getElementById("logbook-page-detail");
const logbookBackBtn = document.getElementById("logbook-back-btn");
const closeLogbookDetailBtn = document.getElementById(
  "close-logbook-detail-btn"
);
const logbookSummitCount = document.getElementById("logbook-summit-count");
const mapSearchInput = document.getElementById("map-search");
const mapSearchResults = document.getElementById("map-search-results");
const demoInfoBtn = document.getElementById("demo-info-btn");
const homeBtn = document.getElementById("home-btn");
const editSubmissionModal = document.getElementById("edit-submission-modal");
const editSummitDate = document.getElementById("edit-summit-date");
const DEMO_ACK_KEY = "pico-demo-acknowledged";

/* ===== State ===== */
let peaks = JSON.parse(localStorage.getItem("peaks")) || [];
let map;
let userMarkersCluster;
let previewMarker = null;
let selectedPeakId = null;
let selectedSummitKey = null;
let currentInfoTarget = null;
let peakInfoSource = "search"; // "search" | "logbook" | "map"
const LOGBOOK_PAGE_SIZE = 50;
let logbookVisibleCount = LOGBOOK_PAGE_SIZE;
const PEAK_FOCUS_ZOOM = 15;
const PREVIEW_ZOOM = 15;

function getPeakKey(peak) {
  const name = formatPeakName(peak.name).toLowerCase().trim();
  if (peak.lat != null && peak.lon != null && peak.lat !== "" && peak.lon !== "") {
    return `${name}|${Number(peak.lat).toFixed(3)}|${Number(peak.lon).toFixed(3)}`;
  }
  return name;
}

function compareClimbDatesDesc(a, b) {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return new Date(b.date) - new Date(a.date);
}

function getClimbsForSummit(peak) {
  const key = getPeakKey(peak);
  return peaks
    .filter((entry) => getPeakKey(entry) === key)
    .sort(compareClimbDatesDesc);
}

function getSummitGroups(peakList = peaks) {
  const groups = new Map();
  peakList.forEach((peak) => {
    const key = getPeakKey(peak);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(peak);
  });
  return [...groups.entries()].map(([key, climbs]) => {
    const sorted = [...climbs].sort(compareClimbDatesDesc);
    return {
      key,
      latest: sorted[0],
      climbs: sorted,
      count: sorted.length,
    };
  });
}

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

function refreshLog() {
  renderClimbLog({ resetPage: true });
  renderMapMarkers();
}

/* ===== Panels: Add peak / interactive Logbook ===== */
function setRailActive(mode) {
  addSummitBtn.classList.toggle("is-active", mode === "compose");
  openLogbookBtn.classList.toggle("is-active", mode === "logbook");
  addSummitBtn.setAttribute(
    "aria-pressed",
    mode === "compose" ? "true" : "false",
  );
  openLogbookBtn.setAttribute(
    "aria-pressed",
    mode === "logbook" ? "true" : "false",
  );
}

function hideAllSheetPanels() {
  if (logSheet) logSheet.hidden = true;
  if (logbookView) logbookView.hidden = true;
  if (peakInfoView) peakInfoView.hidden = true;
}

function openSheet(mode) {
  sheetEl.hidden = false;
  sheetEl.classList.toggle("is-compose", mode === "compose");
  sheetEl.classList.toggle("is-logbook", mode === "logbook");
  sheetEl.classList.toggle("is-info", mode === "info");
  document.body.classList.add("sheet-open");
  document.body.classList.toggle("compose-open", mode === "compose");
  document.body.classList.toggle("logbook-open", mode === "logbook");
  document.body.classList.toggle("info-open", mode === "info");
  requestAnimationFrame(() => map?.invalidateSize());
}

function closeSheet() {
  sheetEl.hidden = true;
  sheetEl.classList.remove("is-compose", "is-logbook", "is-info");
  document.body.classList.remove(
    "sheet-open",
    "compose-open",
    "logbook-open",
    "info-open",
  );
  selectedPeakId = null;
  selectedSummitKey = null;
  currentInfoTarget = null;
  showLogbookListPage();
  if (logbookDetail) logbookDetail.replaceChildren();
  if (peakInfoBody) peakInfoBody.replaceChildren();
  hideAllSheetPanels();
  setRailActive(null);
  clearSuggestions();
  clearTimeout(debounceTimer);
  peakSuggestions.classList.remove("show");
  summitInput.blur();
  showAddPeakPreview(null);
  requestAnimationFrame(() => map?.invalidateSize());
}

function setLogSheetTitle(title = "Add a peak") {
  const titleEl = document.getElementById("log-sheet-title");
  if (titleEl) titleEl.textContent = title;
}

function showAddPeakView({ toggle = false } = {}) {
  if (toggle && !logSheet.hidden && !sheetEl.hidden) {
    closeSheet();
    return;
  }
  setLogSheetTitle("Add a peak");
  openSheet("compose");
  setRailActive("compose");
  hideAllSheetPanels();
  logSheet.hidden = false;
}

function beginLogAnotherClimb(peak) {
  if (!peak) return;

  const elev = getClimbElevation(peak, getClimbsForSummit(peak));
  const name = peak.name;
  const lat = peak.lat != null ? Number(peak.lat) : null;
  const lon = peak.lon != null ? Number(peak.lon) : null;

  setLogSheetTitle(`Add summit · ${formatPeakName(name)}`);
  openSheet("compose");
  setRailActive("compose");
  hideAllSheetPanels();
  logSheet.hidden = false;

  summitInput.value = name;
  summitInput.dataset.lat = lat != null ? String(lat) : "";
  summitInput.dataset.lon = lon != null ? String(lon) : "";
  summitInput.dataset.city = peak.city || "";
  summitInput.dataset.state = peak.state || "";
  summitInput.dataset.elevation = elev != null ? String(elev) : "";
  if (dateInput) dateInput.value = "";
  if (entryTitleInput) entryTitleInput.value = "";
  if (entryNotesInput) entryNotesInput.value = "";

  showAddPeakPreview({
    name,
    lat,
    lon,
    city: peak.city || "",
    state: peak.state || "",
    elevation: elev,
  });
}

function showLogbookView({ toggle = false } = {}) {
  if (toggle && !logbookView.hidden && !sheetEl.hidden) {
    closeSheet();
    return;
  }
  openSheet("logbook");
  setRailActive("logbook");
  clearSuggestions();
  clearTimeout(debounceTimer);
  peakSuggestions.classList.remove("show");
  summitInput.blur();
  showAddPeakPreview(null);
  currentInfoTarget = null;

  hideAllSheetPanels();
  logbookView.hidden = false;
  renderClimbLog();

  if (!selectedSummitKey && selectedPeakId == null) showLogbookListPage();
}

function findLoggedPeakForTarget(target) {
  if (!target) return null;
  if (target.peak) return target.peak;

  const name = formatPeakName(target.name || target.displayName || "")
    .toLowerCase()
    .trim();
  if (!name) return null;

  const groups = getSummitGroups();
  const lat = target.lat != null ? Number(target.lat) : null;
  const lon = target.lon != null ? Number(target.lon) : null;

  return (
    groups.find((group) => {
      const latest = group.latest;
      const groupName = formatPeakName(latest.name).toLowerCase().trim();
      if (groupName !== name) return false;
      if (lat == null || lon == null || latest.lat == null || latest.lon == null) {
        return true;
      }
      return (
        Math.abs(Number(latest.lat) - lat) < 0.02 &&
        Math.abs(Number(latest.lon) - lon) < 0.02
      );
    })?.latest || null
  );
}

function peakTargetFromClimb(peak) {
  return {
    name: formatPeakName(peak.name),
    displayName: peak.name,
    lat: Number(peak.lat),
    lon: Number(peak.lon),
    city: peak.city || "",
    state: peak.state || "",
    elevation: getClimbElevation(peak, getClimbsForSummit(peak)),
    peak,
  };
}

function renderPeakInfoPane(target) {
  if (!peakInfoBody || !target) return;

  const loggedPeak = findLoggedPeakForTarget(target);
  const climbs = loggedPeak ? getClimbsForSummit(loggedPeak) : [];
  const latest = climbs[0] || loggedPeak || null;
  const repeats = climbs.slice(1);
  const elev =
    parseElevation(target.elevation) ??
    (latest ? getClimbElevation(latest, climbs) : null);
  const location =
    getSearchPlaceLocation(target) ||
    (latest ? getPeakLocation(latest) : "");
  const titleName = formatPeakName(target.name || target.displayName || "Peak");

  if (latest) {
    selectedSummitKey = getPeakKey(latest);
    selectedPeakId = latest.id;
  } else {
    selectedSummitKey = null;
    selectedPeakId = null;
  }

  if (peakInfoTitle) peakInfoTitle.textContent = titleName;
  updatePeakInfoChrome();

  peakInfoBody.replaceChildren();

  const hero = document.createElement("div");
  hero.className = "peak-info-hero";

  if (location) {
    const loc = document.createElement("p");
    loc.className = "peak-info-location";
    loc.textContent = location;
    hero.appendChild(loc);
  }

  const status = document.createElement("p");
  status.className = "peak-info-status";
  if (climbs.length > 0) {
    status.textContent = `${climbs.length.toLocaleString("en-US")} ${
      climbs.length === 1 ? "summit" : "summits"
    }`;
  } else {
    status.textContent = "No summits yet";
  }
  hero.appendChild(status);

  const facts = document.createElement("dl");
  facts.className = "logbook-info-list peak-info-facts";
  appendInfoRow(facts, "Elevation", formatElevationFt(elev) || "Unknown");
  if (target.lat != null && target.lon != null) {
    appendInfoRow(
      facts,
      "Coordinates",
      `${Number(target.lat).toFixed(4)}, ${Number(target.lon).toFixed(4)}`
    );
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "primary-btn logbook-add-summit-btn";
  addBtn.textContent = "Add summit";
  addBtn.setAttribute("aria-label", `Add a summit of ${titleName}`);
  addBtn.addEventListener("click", () => {
    const source = latest || {
      name: target.displayName || target.name || titleName,
      lat: target.lat,
      lon: target.lon,
      city: target.city || "",
      state: target.state || "",
      elevation: elev,
    };
    beginLogAnotherClimb(source);
  });

  peakInfoBody.append(hero, facts, addBtn);

  if (latest) {
    const lastSection = document.createElement("section");
    lastSection.className = "logbook-climb-section logbook-last-climbed-section";

    const lastHead = document.createElement("div");
    lastHead.className = "logbook-climb-section-head logbook-last-climbed-head";

    const lastTitle = document.createElement("h4");
    lastTitle.className = "logbook-last-climbed-title";
    lastTitle.textContent = "Last climbed";

    const lastActions = document.createElement("div");
    lastActions.className = "logbook-detail-actions";
    lastActions.append(createEditButton(latest), createDeleteButton(latest));

    lastHead.append(lastTitle, lastActions);
    lastSection.append(lastHead, buildClimbEntryList(latest));
    peakInfoBody.appendChild(lastSection);

    if (repeats.length) {
      const repeatsSection = document.createElement("section");
      repeatsSection.className = "logbook-climb-section logbook-repeats-section";

      const repeatsTitle = document.createElement("h4");
      repeatsTitle.className =
        "logbook-climb-section-title logbook-repeats-title";
      repeatsTitle.textContent = `Repeats · ${repeats.length.toLocaleString("en-US")}`;

      const repeatsList = document.createElement("div");
      repeatsList.className = "logbook-repeats-list";
      repeats.forEach((climb) => {
        repeatsList.appendChild(createRepeatRow(climb));
      });

      repeatsSection.append(repeatsTitle, repeatsList);
      peakInfoBody.appendChild(repeatsSection);
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "peak-info-empty";
    empty.textContent = "No climbs logged for this summit yet.";
    peakInfoBody.appendChild(empty);
  }
}

function focusLoggedMarker(peak) {
  if (!peak?.lat || !peak?.lon) return;
  const marker = markersById.get(getPeakKey(peak));
  if (!marker) {
    showSearchWaypoint(peakTargetFromClimb(peak));
    return;
  }

  clearMapSearchMarker();
  const { lat, lng } = marker.getLatLng();
  const zoom = Math.max(map.getZoom(), PEAK_FOCUS_ZOOM);
  const popup = marker.getPopup();
  if (popup) popup.options.autoPan = false;

  const finish = () => {
    focusMapPoint(lat, lng, { zoom, animate: false });
    marker.openPopup();
    requestAnimationFrame(() => {
      focusMapPoint(lat, lng, { zoom: map.getZoom(), animate: false });
    });
  };

  if (
    userMarkersCluster.getVisibleParent(marker) !== marker &&
    typeof userMarkersCluster.zoomToShowLayer === "function"
  ) {
    userMarkersCluster.zoomToShowLayer(marker, finish);
  } else {
    finish();
  }
}

function updatePeakInfoChrome() {
  const fromLogbook = peakInfoSource === "logbook";
  if (peakInfoBackBtn) peakInfoBackBtn.hidden = !fromLogbook;
  if (closePeakInfoBtn) closePeakInfoBtn.hidden = fromLogbook;
  if (peakInfoView) {
    peakInfoView.classList.toggle("has-back", fromLogbook);
  }
}

function openPeakInfoPane(target, { focusMap = true, source } = {}) {
  if (!target?.lat || !target?.lon) return;

  if (source) peakInfoSource = source;

  const loggedPeak = findLoggedPeakForTarget(target);
  currentInfoTarget = {
    ...target,
    name: formatPeakName(target.name || target.displayName || ""),
    peak: loggedPeak || null,
    elevation:
      parseElevation(target.elevation) ??
      (loggedPeak
        ? getClimbElevation(loggedPeak, getClimbsForSummit(loggedPeak))
        : null),
  };

  clearMapSearchResults();
  openSheet("info");
  setRailActive(null);
  hideAllSheetPanels();
  if (peakInfoView) peakInfoView.hidden = false;
  showLogbookListPage();
  renderPeakInfoPane(currentInfoTarget);

  document.querySelectorAll(".climb-item.is-active").forEach((el) => {
    el.classList.remove("is-active");
  });
  if (selectedSummitKey) {
    const row = [...mySummitsList.querySelectorAll(".climb-item")].find(
      (el) => el.dataset.summitKey === selectedSummitKey
    );
    if (row) row.classList.add("is-active");
  }

  if (!focusMap) return;

  if (loggedPeak) {
    requestAnimationFrame(() => requestAnimationFrame(() => focusLoggedMarker(loggedPeak)));
  } else {
    showSearchWaypoint(currentInfoTarget);
  }
}

function showForm() {
  showAddPeakView();
}

function showMySummits() {
  closeSheet();
}

function getPeakLocation(peak) {
  return (
    [peak.city, peak.state].filter(Boolean).join(", ") ||
    getLocationFromPeakName(peak.name)
  );
}

function setLogbookDetailInert(isInert) {
  if (!logbookPageDetail) return;
  logbookPageDetail.hidden = isInert;
  logbookPageDetail.setAttribute("aria-hidden", isInert ? "true" : "false");
  if (isInert) logbookPageDetail.setAttribute("inert", "");
  else logbookPageDetail.removeAttribute("inert");
}

function showLogbookListPage() {
  if (!logbookStack) return;
  const wasDetail = logbookStack.classList.contains("is-detail");
  logbookStack.classList.remove("is-detail");
  if (!logbookPageDetail) return;

  if (!wasDetail) {
    setLogbookDetailInert(true);
    return;
  }

  window.setTimeout(() => {
    if (!logbookStack.classList.contains("is-detail")) {
      setLogbookDetailInert(true);
    }
  }, 320);
}

function showLogbookDetailPage() {
  if (!logbookStack || !logbookPageDetail) return;
  setLogbookDetailInert(false);
  // Next frame so the enter transition runs from translateX(108%)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      logbookStack.classList.add("is-detail");
    });
  });
}

function parseElevation(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatElevationFt(value) {
  const elev = parseElevation(value);
  return elev == null ? null : `${elev.toLocaleString("en-US")} ft`;
}

function getClimbElevation(climb, climbs = []) {
  const own = parseElevation(climb?.elevation);
  if (own != null) return own;
  for (const entry of climbs) {
    const elev = parseElevation(entry?.elevation);
    if (elev != null) return elev;
  }
  return null;
}

function appendInfoRow(list, label, value) {
  const row = document.createElement("div");
  row.className = "logbook-info-row";
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  row.append(dt, dd);
  list.appendChild(row);
}

function buildClimbEntryList(climb) {
  const info = document.createElement("dl");
  info.className = "logbook-info-list";

  appendInfoRow(
    info,
    "Date climbed",
    climb.date ? formatDateUS(climb.date) : "No date"
  );
  if (climb.title) {
    appendInfoRow(info, "Title", climb.title);
  }
  if (climb.notes) {
    appendInfoRow(info, "Notes", climb.notes);
  }

  return info;
}

function createRepeatRow(climb) {
  const row = document.createElement("div");
  row.className = "logbook-repeat-row";

  const copy = document.createElement("div");
  copy.className = "logbook-repeat-copy";

  if (climb.title) {
    const title = document.createElement("p");
    title.className = "logbook-repeat-title";
    title.textContent = climb.title;
    copy.appendChild(title);
  }

  const date = document.createElement("p");
  date.className = "logbook-repeat-date";
  date.textContent = climb.date ? formatDateUS(climb.date) : "No date";

  copy.appendChild(date);

  const elevLabel = formatElevationFt(climb.elevation);
  if (elevLabel) {
    const elev = document.createElement("p");
    elev.className = "logbook-repeat-meta";
    elev.textContent = elevLabel;
    copy.appendChild(elev);
  }

  if (climb.notes) {
    const notes = document.createElement("p");
    notes.className = "logbook-repeat-notes";
    notes.textContent = climb.notes;
    copy.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "logbook-detail-actions";
  actions.append(createEditButton(climb), createDeleteButton(climb));

  row.append(copy, actions);
  return row;
}

function renderLogbookDetail(peak) {
  // Peak viewing now uses the shared info pane
  if (!peak) {
    if (logbookDetail) logbookDetail.replaceChildren();
    showLogbookListPage();
    return;
  }
  openPeakInfoPane(peakTargetFromClimb(peak), { source: "logbook" });
}

function clearSelectedPeak({ keepPopup = false } = {}) {
  selectedPeakId = null;
  selectedSummitKey = null;
  currentInfoTarget = null;
  document.querySelectorAll(".climb-item.is-active").forEach((el) => {
    el.classList.remove("is-active");
  });
  if (peakInfoBody) peakInfoBody.replaceChildren();
  if (peakInfoView && !peakInfoView.hidden) {
    // Keep sheet mode decisions to the caller; just clear info content
  }
  showLogbookListPage();
  if (!keepPopup) map?.closePopup();
}

function resolveSelectedSummit() {
  if (selectedSummitKey) {
    const group = getSummitGroups().find(
      (entry) => entry.key === selectedSummitKey
    );
    if (group) {
      selectedPeakId = group.latest.id;
      return group.latest;
    }
  }

  if (selectedPeakId != null) {
    const peak = peaks.find((entry) => entry.id === selectedPeakId);
    if (peak) {
      selectedSummitKey = getPeakKey(peak);
      return peak;
    }
  }

  selectedPeakId = null;
  selectedSummitKey = null;
  return null;
}

function focusPeakOnMap(peak, { source = "map" } = {}) {
  if (!peak?.lat || !peak?.lon) return;
  openPeakInfoPane(peakTargetFromClimb(peak), { source });
}

addSummitBtn.addEventListener("click", () => showAddPeakView({ toggle: true }));
cancelAddSummitBtn.addEventListener("click", closeSheet);
if (closePeakInfoBtn) {
  closePeakInfoBtn.addEventListener("click", closeSheet);
}
if (peakInfoBackBtn) {
  peakInfoBackBtn.addEventListener("click", () => {
    currentInfoTarget = null;
    selectedPeakId = null;
    selectedSummitKey = null;
    document.querySelectorAll(".climb-item.is-active").forEach((el) => {
      el.classList.remove("is-active");
    });
    if (peakInfoBody) peakInfoBody.replaceChildren();
    map?.closePopup();
    clearMapSearchMarker();
    showLogbookView();
  });
}
openLogbookBtn.addEventListener("click", () =>
  showLogbookView({ toggle: true })
);
closeLogbookBtn.addEventListener("click", closeSheet);
if (closeLogbookDetailBtn) {
  closeLogbookDetailBtn.addEventListener("click", closeSheet);
}
if (logbookBackBtn) {
  logbookBackBtn.addEventListener("click", () => {
    clearSelectedPeak();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modalEl = document.getElementById("app-modal");
  if (modalEl && !modalEl.classList.contains("hidden")) return;
  if (mapSearchResults && !mapSearchResults.hidden) {
    clearMapSearchResults();
    mapSearchInput?.blur();
    return;
  }
  if (
    !sheetEl.hidden &&
    !logbookView.hidden &&
    logbookStack?.classList.contains("is-detail")
  ) {
    clearSelectedPeak();
    return;
  }
  if (!sheetEl.hidden) closeSheet();
});

/* ===== Top map search (places + logbook) ===== */
let mapSearchTimer = null;
let mapSearchMarker = null;

function clearMapSearchResults() {
  if (!mapSearchResults) return;
  mapSearchResults.replaceChildren();
  mapSearchResults.hidden = true;
}

function clearMapSearchMarker() {
  if (mapSearchMarker && map) {
    map.removeLayer(mapSearchMarker);
    mapSearchMarker = null;
  }
}

function appendSearchResult({ title, meta, summitCount, onSelect }) {
  const li = document.createElement("li");
  li.tabIndex = 0;

  const titleRow = document.createElement("div");
  titleRow.className = "result-title-row";

  const titleEl = document.createElement("span");
  titleEl.className = "result-title";
  titleEl.textContent = title;
  titleRow.appendChild(titleEl);

  if (summitCount != null && summitCount > 0) {
    const countEl = document.createElement("span");
    countEl.className = "result-summit-count";
    countEl.textContent = `Summits: ${summitCount.toLocaleString("en-US")}`;
    titleRow.appendChild(countEl);
  }

  li.append(titleRow);

  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "result-meta";
    metaEl.textContent = meta;
    li.append(metaEl);
  }

  const activate = () => {
    clearMapSearchResults();
    if (mapSearchInput) mapSearchInput.value = title;
    onSelect();
  };

  li.addEventListener("click", activate);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });

  mapSearchResults.appendChild(li);
}

function getSearchPlaceLocation(place) {
  return (
    [place.city, place.state].filter(Boolean).join(", ") ||
    getLocationFromPeakName(place.displayName || place.name || "") ||
    ""
  );
}

function buildWaypointPopup(place) {
  const wrapper = document.createElement("div");
  wrapper.className = "peak-popup peak-popup-simple";

  const summitValue = document.createElement("span");
  summitValue.className = "peak-popup-value";
  summitValue.textContent = formatPeakName(place.name || place.displayName || "");
  wrapper.appendChild(summitValue);

  const location = getSearchPlaceLocation(place);
  if (location) {
    const loc = document.createElement("span");
    loc.className = "peak-popup-label";
    loc.textContent = location;
    wrapper.appendChild(loc);
  }

  return wrapper;
}

function showSearchWaypoint(place) {
  if (!map || !place?.lat || !place?.lon) return;

  clearMapSearchMarker();
  if (previewMarker) {
    map.removeLayer(previewMarker);
    previewMarker = null;
  }

  const latLng = L.latLng(place.lat, place.lon);
  mapSearchMarker = L.marker(latLng, {
    icon: createPeakIcon({ variant: "search" }),
  })
    .addTo(map)
    .bindPopup(buildWaypointPopup(place), {
      autoPan: false,
      maxWidth: 280,
    });

  const zoom = Math.max(map.getZoom(), PREVIEW_ZOOM);
  focusMapPoint(place.lat, place.lon, { zoom, animate: true });
  mapSearchMarker.openPopup();
  requestAnimationFrame(() => {
    focusMapPoint(place.lat, place.lon, {
      zoom: map.getZoom(),
      animate: false,
    });
  });
}

async function openAddPeakFromSearch(place) {
  clearMapSearchResults();
  showSearchWaypoint(place);

  const name = place.displayName || place.name;
  let elevation = parseElevation(place.elevation);

  setLogSheetTitle(`Add a peak · ${formatPeakName(name)}`);
  openSheet("compose");
  setRailActive("compose");
  hideAllSheetPanels();
  logSheet.hidden = false;

  summitInput.value = name;
  summitInput.dataset.lat = String(place.lat);
  summitInput.dataset.lon = String(place.lon);
  summitInput.dataset.city = place.city || "";
  summitInput.dataset.state = place.state || "";
  summitInput.dataset.elevation = elevation != null ? String(elevation) : "";
  if (dateInput) dateInput.value = "";
  if (entryTitleInput) entryTitleInput.value = "";
  if (entryNotesInput) entryNotesInput.value = "";

  if (elevation == null && place.lat && place.lon) {
    try {
      elevation = await getElevationFromOSM(place.lat, place.lon);
      if (elevation != null) {
        summitInput.dataset.elevation = String(elevation);
      }
    } catch (err) {
      console.error("Elevation lookup failed:", err);
    }
  }
}

async function beginLogFromPlace(place) {
  await openAddPeakFromSearch(place);
}

function searchTargetKey(target) {
  const name = formatPeakName(target.name || target.displayName || "")
    .toLowerCase()
    .trim();
  if (target.lat != null && target.lon != null) {
    return `${name}|${Number(target.lat).toFixed(2)}|${Number(target.lon).toFixed(2)}`;
  }
  return name;
}

async function runMapSearch(query) {
  clearMapSearchResults();
  if (!query || query.length < 2) return;

  const spinner = document.createElement("li");
  spinner.className = "spinner";
  spinner.textContent = "Searching…";
  mapSearchResults.appendChild(spinner);
  mapSearchResults.hidden = false;

  const q = query.toLowerCase();
  const logMatches = getSummitGroups(
    peaks.filter((peak) => getPeakSearchText(peak).includes(q))
  )
    .slice(0, 8)
    .map((group) => group.latest);

  let placeMatches = [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&limit=8&q=${encodeURIComponent(
        query,
      )}`,
    );
    placeMatches = filterSummits(await res.json());
  } catch (err) {
    console.error("Map search error:", err);
  }

  const unified = new Map();

  logMatches.forEach((peak) => {
    const target = {
      name: formatPeakName(peak.name),
      displayName: peak.name,
      lat: Number(peak.lat),
      lon: Number(peak.lon),
      city: peak.city || "",
      state: peak.state || "",
      elevation: getClimbElevation(peak, getClimbsForSummit(peak)),
      peak,
    };
    unified.set(searchTargetKey(target), target);
  });

  placeMatches.forEach((place) => {
    const title = place.display_name.split(",")[0];
    let elevation = null;
    const eleTag = place.extratags?.ele;
    if (eleTag) {
      const meters = parseFloat(eleTag);
      if (Number.isFinite(meters)) {
        elevation = Math.round(meters * 3.28084);
      }
    }
    const target = {
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon),
      name: title,
      displayName: place.display_name,
      city:
        place.address?.city ||
        place.address?.town ||
        place.address?.village ||
        "",
      state: place.address?.state || "",
      elevation,
    };
    const key = searchTargetKey(target);
    if (unified.has(key)) {
      const existing = unified.get(key);
      unified.set(key, {
        ...target,
        ...existing,
        elevation: existing.elevation ?? target.elevation,
        city: existing.city || target.city,
        state: existing.state || target.state,
      });
      return;
    }
    const logged = findLoggedPeakForTarget(target);
    if (logged) {
      target.peak = logged;
      target.elevation =
        target.elevation ??
        getClimbElevation(logged, getClimbsForSummit(logged));
    }
    unified.set(key, target);
  });

  clearMapSearchResults();
  mapSearchResults.hidden = false;

  const results = [...unified.values()].slice(0, 10);
  results.forEach((target) => {
    const location =
      getSearchPlaceLocation(target) ||
      target.displayName ||
      undefined;
    const summitCount = target.peak
      ? getClimbsForSummit(target.peak).length
      : 0;
    appendSearchResult({
      title: formatPeakName(target.name || target.displayName || ""),
      meta: location,
      summitCount,
      onSelect: () => openPeakInfoPane(target, { source: "search" }),
    });
  });

  if (results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "no-results";
    empty.textContent = "No matches found";
    mapSearchResults.appendChild(empty);
  }
}

if (mapSearchInput) {
  const scheduleMapSearch = (immediate = false) => {
    clearTimeout(mapSearchTimer);
    const query = mapSearchInput.value.trim();
    if (query.length < 2) {
      clearMapSearchResults();
      return;
    }
    if (immediate) {
      runMapSearch(query);
      return;
    }
    mapSearchTimer = setTimeout(() => {
      runMapSearch(query);
    }, 250);
  };

  mapSearchInput.addEventListener("input", () => {
    scheduleMapSearch(false);
  });

  mapSearchInput.addEventListener("focus", () => {
    scheduleMapSearch(true);
  });

  mapSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearMapSearchResults();
      mapSearchInput.blur();
    }
  });
}

document.addEventListener("click", (e) => {
  if (
    mapSearchResults &&
    !mapSearchResults.hidden &&
    !mapSearchResults.contains(e.target) &&
    e.target !== mapSearchInput &&
    !mapSearchInput?.contains(e.target)
  ) {
    clearMapSearchResults();
  }
});

/* ===== Create Button Helper Functions ===== */
function createDeleteButton(peak) {
  const btn = document.createElement("button");
  btn.className = "delete-btn";
  btn.textContent = "✕";
  btn.setAttribute("aria-label", `Delete ${peak.name}`);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openDeleteModal(peak);
  });
  return btn;
}

function createEditButton(peak) {
  const btn = document.createElement("button");
  btn.className = "edit-btn";
  btn.textContent = "✎";
  btn.setAttribute("aria-label", `Edit ${peak.name}`);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openEditModal(peak);
  });
  return btn;
}

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

/* ===== Climb log (searchable + paginated for large logs) ===== */
function getPeakSearchText(peak) {
  return [
    peak.name,
    peak.city,
    peak.state,
    peak.date,
    peak.elevation,
    getLocationFromPeakName(peak.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFilteredSortedSummitGroups() {
  const query = (logbookSearch?.value || "").trim().toLowerCase();
  const sort = logbookSort?.value || "date-desc";

  let list = peaks;
  if (query) {
    list = peaks.filter((peak) => getPeakSearchText(peak).includes(query));
  }

  return getSummitGroups(list).sort((a, b) => {
    const left = a.latest;
    const right = b.latest;
    if (sort === "name") {
      return formatPeakName(left.name).localeCompare(formatPeakName(right.name));
    }
    if (sort === "elevation-desc") {
      return (Number(right.elevation) || 0) - (Number(left.elevation) || 0);
    }
    if (sort === "date-asc") {
      if (!left.date && !right.date) return 0;
      if (!left.date) return 1;
      if (!right.date) return -1;
      return new Date(left.date) - new Date(right.date);
    }
    return compareClimbDatesDesc(left, right);
  });
}

function createClimbItem(group) {
  const peak = group.latest;
  const li = document.createElement("li");
  li.className = "climb-item";
  li.dataset.peakId = String(peak.id);
  li.dataset.summitKey = group.key;
  if (selectedSummitKey === group.key) li.classList.add("is-active");
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.setAttribute(
    "aria-label",
    `Open details for ${formatPeakName(peak.name)}`
  );

  const top = document.createElement("div");
  top.className = "climb-top";

  const meta = document.createElement("div");
  meta.className = "climb-meta";

  const nameRow = document.createElement("div");
  nameRow.className = "climb-name-row";

  const nameSpan = document.createElement("span");
  nameSpan.className = "climb-name";
  nameSpan.textContent = formatPeakName(peak.name);
  nameRow.appendChild(nameSpan);

  if (group.count > 1) {
    const countBadge = document.createElement("span");
    countBadge.className = "climb-count-badge";
    countBadge.textContent = `×${group.count}`;
    countBadge.setAttribute(
      "aria-label",
      `${group.count} summits`
    );
    nameRow.appendChild(countBadge);
  }

  const location = getPeakLocation(peak);
  meta.appendChild(nameRow);

  if (location) {
    const locSpan = document.createElement("span");
    locSpan.className = "climb-location";
    locSpan.textContent = location;
    meta.appendChild(locSpan);
  }

  const submeta = document.createElement("div");
  submeta.className = "climb-submeta";
  const bits = [];
  if (peak.date) bits.push(formatDateUS(peak.date));
  const elevLabel = formatElevationFt(
    getClimbElevation(peak, group.climbs || [])
  );
  if (elevLabel) bits.push(elevLabel);
  if (bits.length) {
    bits.forEach((bit, index) => {
      const span = document.createElement("span");
      span.textContent = bit;
      submeta.appendChild(span);
      if (index < bits.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = "·";
        sep.setAttribute("aria-hidden", "true");
        submeta.appendChild(sep);
      }
    });
    meta.appendChild(submeta);
  }

  top.appendChild(meta);

  const chevron = document.createElement("span");
  chevron.className = "climb-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "›";

  const selectPeak = () => focusPeakOnMap(peak, { source: "logbook" });
  li.addEventListener("click", selectPeak);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectPeak();
    }
  });

  li.append(top, chevron);
  return li;
}

function renderClimbLog({ resetPage = false } = {}) {
  const allGroups = getSummitGroups();
  const summitTotal = allGroups.length;
  mySummitCount.textContent = summitTotal.toLocaleString("en-US");
  if (logbookSummitCount) {
    logbookSummitCount.textContent =
      summitTotal === 0
        ? ""
        : `${summitTotal.toLocaleString("en-US")} ${
            summitTotal === 1 ? "summit" : "summits"
          }`;
  }
  if (resetPage) logbookVisibleCount = LOGBOOK_PAGE_SIZE;

  mySummitsList.innerHTML = "";

  if (peaks.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No climbs yet. Use Add peak to start your log.";
    li.classList.add("muted");
    mySummitsList.appendChild(li);
    if (logbookMeta) logbookMeta.textContent = "";
    if (logbookLoadMore) logbookLoadMore.hidden = true;
    if (selectedSummitKey || selectedPeakId != null) {
      renderLogbookDetail(null);
    }
    return;
  }

  const filtered = getFilteredSortedSummitGroups();
  const visible = filtered.slice(0, logbookVisibleCount);

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No climbs match your search.";
    li.classList.add("muted");
    mySummitsList.appendChild(li);
  } else {
    visible.forEach((group) => {
      mySummitsList.appendChild(createClimbItem(group));
    });
  }

  if (logbookMeta) {
    logbookMeta.textContent =
      filtered.length === summitTotal
        ? `Showing ${visible.length.toLocaleString("en-US")} of ${summitTotal.toLocaleString("en-US")}`
        : `Showing ${visible.length.toLocaleString("en-US")} of ${filtered.length.toLocaleString("en-US")} matches (${summitTotal.toLocaleString("en-US")} summits)`;
  }

  if (logbookLoadMore) {
    const hasMore = visible.length < filtered.length;
    logbookLoadMore.hidden = !hasMore;
    logbookLoadMore.textContent = `Load more (${(
      filtered.length - visible.length
    ).toLocaleString("en-US")} remaining)`;
  }

  const selectedPeak = resolveSelectedSummit();
  if (peakInfoView && !peakInfoView.hidden) {
    if (selectedPeak) {
      openPeakInfoPane(peakTargetFromClimb(selectedPeak), { focusMap: false });
    } else if (currentInfoTarget) {
      openPeakInfoPane(
        { ...currentInfoTarget, peak: null },
        { focusMap: false }
      );
    }
  }
}

let logbookSearchTimer = null;
if (logbookSearch) {
  logbookSearch.addEventListener("input", () => {
    clearTimeout(logbookSearchTimer);
    logbookSearchTimer = setTimeout(() => {
      renderClimbLog({ resetPage: true });
    }, 150);
  });
}
if (logbookSort) {
  logbookSort.addEventListener("change", () => {
    renderClimbLog({ resetPage: true });
  });
}
if (logbookLoadMore) {
  logbookLoadMore.addEventListener("click", () => {
    logbookVisibleCount += LOGBOOK_PAGE_SIZE;
    renderClimbLog();
  });
}

// Back-compat aliases used by older call sites
function renderRecentSummitsList() {
  renderClimbLog();
}

function renderMySummitsTable() {
  renderClimbLog();
}

/* ===== Date Input ===== */

/* ===== Map Setup ===== */
var usaBounds = [
  [24.396308, -125.0],
  [49.384358, -66.93457],
];

let streetLayer;
let satelliteLayer;
let activeBasemap = "satellite";
let basemapToggleBtn = null;
let attributionBtn = null;
let attributionPanel = null;
const BASEMAP_KEY = "pico-basemap";
const STREET_ATTRIBUTION = "&copy; OpenStreetMap contributors";
const SATELLITE_ATTRIBUTION =
  "Tiles &copy; Esri. Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

function createBasemapLayers() {
  const shared = {
    noWrap: true,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
    minZoom: 2,
    maxZoom: 18,
  };

  streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      ...shared,
      attribution: "&copy; OpenStreetMap contributors",
    },
  );

  satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      ...shared,
      attribution:
        "Tiles &copy; Esri. Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  );
}

function setBasemap(mode) {
  if (!map || !streetLayer || !satelliteLayer) return;
  const next = mode === "satellite" ? "satellite" : "street";

  if (next === "satellite") {
    if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
  } else {
    if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
  }

  activeBasemap = next;
  localStorage.setItem(BASEMAP_KEY, next);
  updateAttributionPanel();

  if (basemapToggleBtn) {
    const isSatellite = next === "satellite";
    basemapToggleBtn.classList.toggle("is-active", isSatellite);
    basemapToggleBtn.setAttribute(
      "aria-pressed",
      isSatellite ? "true" : "false",
    );
    basemapToggleBtn.title = isSatellite
      ? "Switch to street map"
      : "Switch to satellite";
    basemapToggleBtn.setAttribute(
      "aria-label",
      isSatellite ? "Switch to street map" : "Switch to satellite",
    );
  }
}

function addBasemapToggleControl() {
  const BasemapToggle = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar pico-basemap-control",
      );
      const btn = L.DomUtil.create("button", "pico-basemap-btn", container);
      btn.type = "button";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.7"/>
          <path d="M4.8 10.2h14.4M4.8 13.8h14.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M12 3.8c2.4 2.6 3.6 5.4 3.6 8.2S14.4 17.6 12 20.2C9.6 17.6 8.4 14.8 8.4 12S9.6 6.4 12 3.8Z" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      `;

      basemapToggleBtn = btn;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(btn, "click", (e) => {
        L.DomEvent.stop(e);
        setBasemap(activeBasemap === "satellite" ? "street" : "satellite");
      });

      return container;
    },
  });

  map.addControl(new BasemapToggle());
}

function updateAttributionPanel() {
  if (!attributionPanel) return;
  attributionPanel.innerHTML =
    activeBasemap === "satellite" ? SATELLITE_ATTRIBUTION : STREET_ATTRIBUTION;
}

function addAttributionControl() {
  const AttrControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd() {
      const container = L.DomUtil.create("div", "pico-attr-control");
      const btn = L.DomUtil.create("button", "pico-attr-btn", container);
      btn.type = "button";
      btn.setAttribute("aria-label", "Show map credits");
      btn.setAttribute("aria-expanded", "false");
      btn.title = "Map credits";
      btn.innerHTML = `
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 7.2v3.2M8 5.2h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      `;

      const panel = L.DomUtil.create("div", "pico-attr-panel", container);
      panel.hidden = true;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Map credits");

      attributionBtn = btn;
      attributionPanel = panel;
      updateAttributionPanel();

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(btn, "click", (e) => {
        L.DomEvent.stop(e);
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          open ? "Hide map credits" : "Show map credits",
        );
      });

      return container;
    },
  });

  map.addControl(new AttrControl());
}

function initMap() {
  map = L.map("map", {
    zoom: 4.5,
    zoomControl: false,
    attributionControl: false,
  });
  L.control.zoom({ position: "topright" }).addTo(map);

  createBasemapLayers();
  const savedBasemap = localStorage.getItem(BASEMAP_KEY);
  setBasemap(savedBasemap === "street" ? "street" : "satellite");
  addBasemapToggleControl();
  addAttributionControl();
  setBasemap(activeBasemap);

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

/* ===== Map markers ===== */
function createPeakIcon({ variant = "logged" } = {}) {
  const isPreview = variant === "preview" || variant === "search";
  const fill = isPreview ? "#0d9488" : "#0f766e";
  const ring = isPreview ? "#5eead4" : "#f59e0b";
  const accent = isPreview ? "#99f6e4" : "#fde68a";
  const html = `
    <div class="pico-marker__pin" aria-hidden="true">
      <svg viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 41c0 0-13-12.4-13-22.2C4 10.4 9.8 4.5 17 4.5s13 5.9 13 14.3C30 28.6 17 41 17 41z" fill="${fill}" stroke="${ring}" stroke-width="1.6"/>
        <circle cx="17" cy="17.5" r="8.2" fill="#0b1220"/>
        <circle cx="17" cy="17.5" r="8.2" fill="none" stroke="${ring}" stroke-width="1.4"/>
        <path d="M11.2 20.6l3.4-5.4 2.2 3.1 2.1-2.6 4 4.9H11.2z" fill="${accent}"/>
        <path d="M14.4 15.4l1.1-1.7 1.1 1.5" fill="none" stroke="#fff7ed" stroke-width="1.15" stroke-linecap="round"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    className: `pico-marker pico-marker--${variant}`,
    html,
    iconSize: [34, 42],
    iconAnchor: [17, 41],
    popupAnchor: [0, -36],
  });
}

function buildPopup(peak) {
  const wrapper = document.createElement("div");
  wrapper.className = "peak-popup peak-popup-simple";

  const summitValue = document.createElement("span");
  summitValue.className = "peak-popup-value";
  summitValue.textContent = formatPeakName(peak.name);
  wrapper.appendChild(summitValue);

  const location = getPeakLocation(peak);
  if (location) {
    const loc = document.createElement("span");
    loc.className = "peak-popup-label";
    loc.textContent = location;
    wrapper.appendChild(loc);
  }

  return wrapper;
}

const markersById = new Map();

function renderMapMarkers() {
  userMarkersCluster.clearLayers();
  markersById.clear();

  getSummitGroups().forEach((group) => {
    const peak = group.latest;
    if (!peak.lat || !peak.lon) return;

    // Positioning is handled by focusPeakOnMap so the peak stays right of the pane
    const popup = L.popup({
      autoPan: false,
      maxWidth: 280,
    }).setContent(buildPopup(peak));

    const marker = L.marker([peak.lat, peak.lon], {
      icon: createPeakIcon({ variant: "logged" }),
    }).bindPopup(popup);

    // Keep logbook open as detail pane when a logged summit marker is selected
    marker.on("click", () => {
      focusPeakOnMap(peak);
    });

    markersById.set(group.key, marker);
    userMarkersCluster.addLayer(marker);
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
    (r) => r.class === "natural" && summitTypes.includes(r.type),
  );
}

/* ===== Map Live Preview ===== */
function getPanelMapOffset() {
  if (
    !map ||
    !sheetEl ||
    sheetEl.hidden ||
    (!sheetEl.classList.contains("is-compose") &&
      !sheetEl.classList.contains("is-logbook") &&
      !sheetEl.classList.contains("is-info"))
  ) {
    return { x: 0, y: 0 };
  }

  const panelRect = sheetEl.getBoundingClientRect();
  const mapRect = map.getContainer().getBoundingClientRect();
  const isMobile = window.matchMedia("(max-width: 800px)").matches;

  if (isMobile) {
    // Center the peak behind the open pane
    const panelCenterX =
      (panelRect.left + panelRect.right) / 2 - mapRect.left;
    const panelCenterY =
      (panelRect.top + panelRect.bottom) / 2 - mapRect.top;
    const centerX = mapRect.width / 2;
    const centerY = mapRect.height / 2;
    return {
      x: Math.round(panelCenterX - centerX),
      y: Math.round(panelCenterY - centerY),
    };
  }

  // Place the peak just to the right of the open panel (clear of popup width too)
  const panelRight = Math.max(0, panelRect.right - mapRect.left);
  const targetX = panelRight + 200;
  const centerX = mapRect.width / 2;
  // Positive x puts the peak right of center in Leaflet project/setView math
  return { x: Math.round(targetX - centerX), y: 16 };
}

function focusMapPoint(lat, lon, { zoom = PREVIEW_ZOOM, animate = true } = {}) {
  if (!map || lat == null || lon == null) return;

  const latLng = L.latLng(lat, lon);
  const { x, y } = getPanelMapOffset();

  if (x || y) {
    const targetPoint = map.project(latLng, zoom).subtract([x, y]);
    const targetLatLng = map.unproject(targetPoint, zoom);
    map.setView(targetLatLng, zoom, { animate });
  } else {
    map.setView(latLng, zoom, { animate });
  }
}

function clearEntryFields() {
  if (summitInput) summitInput.value = "";
  if (dateInput) dateInput.value = "";
  if (entryTitleInput) entryTitleInput.value = "";
  if (entryNotesInput) entryNotesInput.value = "";
  if (summitInput) {
    summitInput.dataset.lat = "";
    summitInput.dataset.lon = "";
    summitInput.dataset.elevation = "";
    summitInput.dataset.city = "";
    summitInput.dataset.state = "";
  }
}

function showAddPeakPreview(peakData, { mapPin = true } = {}) {
  if (!peakData) {
    if (addSummitPreview) {
      addSummitPreview.replaceChildren();
      addSummitPreview.classList.remove("show");
    }

    clearEntryFields();

    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }
    clearMapSearchMarker();
    return;
  }

  if (!mapPin || !peakData.lat || !peakData.lon) return;

  clearMapSearchMarker();
  if (previewMarker) map.removeLayer(previewMarker);

  previewMarker = L.marker([peakData.lat, peakData.lon], {
    icon: createPeakIcon({ variant: "preview" }),
  })
    .bindPopup(
      buildWaypointPopup({
        name: peakData.name,
        city: peakData.city || "",
        state: peakData.state || "",
        displayName: peakData.name,
      }),
      { autoPan: false, maxWidth: 280 }
    )
    .addTo(map);

  requestAnimationFrame(() => {
    focusMapPoint(peakData.lat, peakData.lon, { zoom: PREVIEW_ZOOM });
    previewMarker.openPopup();
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
    (r) => r.class === "natural" && summitTypes.includes(r.type),
  );
}

/* ===== Typeahead Autocomplete (OSM + Elevation) ===== */
let debounceTimer;

// Utility to clear suggestions
function clearSuggestions() {
  peakSuggestions.replaceChildren(); // clear old content
  peakSuggestions.classList.remove("show");
}

function showPreviewSpinner() {
  // Map pin preview no longer uses an in-form status box
}

function hidePreviewSpinner() {
  // no-op
}

summitInput.addEventListener("input", () => {
  const query = summitInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    clearSuggestions();
    return;
  }

  debounceTimer = setTimeout(async () => {
    clearSuggestions();

    // Show spinner while fetching
    const spinner = document.createElement("li");
    spinner.className = "spinner";
    spinner.textContent = "Loading...";
    peakSuggestions.appendChild(spinner);
    peakSuggestions.classList.add("show");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&q=${encodeURIComponent(
          query,
        )}`,
      );

      const results = await res.json();
      const peaksOnly = filterSummits(results);

      clearSuggestions();

      if (peaksOnly.length > 0) {
        peakSuggestions.classList.add("show");

        for (const r of peaksOnly.slice(0, 5)) {
          const li = document.createElement("li");
          li.textContent = r.display_name;

          li.addEventListener("click", async () => {
            // 1. Clear the suggestion list immediately
            clearSuggestions();

            // 2. Show spinner in preview area
            showPreviewSpinner();

            try {
              const lat = parseFloat(r.lat);
              const lon = parseFloat(r.lon);
              let elev = null;
              const eleTag = r.extratags?.ele;
              if (eleTag) {
                const meters = parseFloat(eleTag);
                if (Number.isFinite(meters)) {
                  elev = Math.round(meters * 3.28084);
                }
              }
              if (elev == null) {
                elev = await getElevationFromOSM(lat, lon);
              }

              summitInput.value = r.display_name;
              summitInput.dataset.lat = lat;
              summitInput.dataset.lon = lon;
              summitInput.dataset.elevation =
                elev != null ? String(elev) : "";
              summitInput.dataset.city =
                r.address.city || r.address.town || r.address.village || "";
              summitInput.dataset.state = r.address.state || "";

              // 3. Hide spinner and show preview
              hidePreviewSpinner();
              showAddPeakPreview({
                name: r.display_name,
                elevation: elev,
                lat,
                lon,
                city: summitInput.dataset.city,
                state: summitInput.dataset.state,
              });
            } catch (err) {
              console.error("Suggestion click error:", err);
              hidePreviewSpinner();
            }
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
      clearSuggestions();
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
  toast.textContent = message;
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

  const name = summitInput.value.trim();
  const date = dateInput.value;
  const title = entryTitleInput?.value.trim() || "";
  const notes = entryNotesInput?.value.trim() || "";
  let elevation = parseElevation(summitInput.dataset.elevation);

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
          name,
        )}`,
      );
      const results = await res.json();

      const peaksOnly = filterSummits(results);

      if (peaksOnly.length === 0) {
        alert(
          "That doesn't look like a summit. Please pick a peak, volcano, or hill.",
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

      const eleTag = best.extratags?.ele;
      if (!elevation && eleTag) {
        const meters = parseFloat(eleTag);
        if (Number.isFinite(meters)) {
          elevation = Math.round(meters * 3.28084);
        }
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    }
  }

  if (!elevation && lat && lon) {
    elevation = await getElevationFromOSM(lat, lon);
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
    title: title || null,
    notes: notes || null,
  };
  peaks.push(peakData);
  savePeaks();
  refreshLog();
  showToast(
    `Added ${formatPeakName(name)}${
      date ? " on " + formatDateUS(date) : " (no date added)"
    }`,
    "success",
  );

  addSummitForm.reset();
  setLogSheetTitle("Add a peak");
  showAddPeakPreview(null);

  if (peakData.lat && peakData.lon) {
    focusPeakOnMap(peakData);
  } else {
    showLogbookView();
  }
});

/* ===== Modal (Edit & Delete) ===== */
const appModal = document.getElementById("app-modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalActions = document.getElementById("modal-actions");

let lastFocusedElement = null;
let trapFocusHandler = null;

let modalDismissible = true;

function escHandler(e) {
  if (e.key === "Escape" && modalDismissible) {
    closeModal();
  }
}

function openModal({ title, body, actions, dismissible = true }) {
  // Save the element that was focused before opening
  lastFocusedElement = document.activeElement;
  modalDismissible = dismissible;

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

  // Click outside to close when dismissible
  appModal.addEventListener("click", backdropHandler);
}

function backdropHandler(e) {
  if (e.target === appModal && modalDismissible) {
    closeModal();
  }
}

function openDemoDisclaimer({ force = false } = {}) {
  const alreadyAcked = localStorage.getItem(DEMO_ACK_KEY) === "1";
  if (!force && alreadyAcked) return;

  const body = document.createElement("div");
  body.className = "demo-disclaimer";

  const p1 = document.createElement("p");
  p1.textContent =
    "Pico is a front-end demo. Climbs you add are saved only in this browser via localStorage.";

  const p2 = document.createElement("p");
  p2.textContent =
    "Your log stays on this device until you clear site data. Nothing is synced to an account or a backend.";

  body.append(p1, p2);

  const actions = [];

  if (!alreadyAcked) {
    const ack = document.createElement("div");
    ack.className = "demo-ack";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "demo-ack-checkbox";

    const label = document.createElement("label");
    label.htmlFor = "demo-ack-checkbox";
    label.textContent =
      "I understand my summit log is stored only in this browser.";

    ack.append(checkbox, label);
    body.appendChild(ack);

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "ghost-btn";
    dismissBtn.textContent = "Not now";
    dismissBtn.addEventListener("click", () => {
      closeModal();
    });

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "primary-btn";
    acceptBtn.textContent = "Accept";
    acceptBtn.disabled = true;

    checkbox.addEventListener("change", () => {
      acceptBtn.disabled = !checkbox.checked;
    });

    acceptBtn.addEventListener("click", () => {
      if (!checkbox.checked) return;
      localStorage.setItem(DEMO_ACK_KEY, "1");
      closeModal();
    });

    actions.push(dismissBtn, acceptBtn);
  } else {
    const gotItBtn = document.createElement("button");
    gotItBtn.type = "button";
    gotItBtn.className = "primary-btn";
    gotItBtn.textContent = "Got it";
    gotItBtn.addEventListener("click", () => closeModal());
    actions.push(gotItBtn);
  }

  openModal({
    title: "Demo notice",
    body,
    actions,
    dismissible: true,
  });
}

function goHome() {
  closeSheet();
  clearMapSearchResults();
  clearMapSearchMarker();
  if (mapSearchInput) {
    mapSearchInput.value = "";
    mapSearchInput.blur();
  }
  clearSelectedPeak();
  clearSuggestions();
  showAddPeakPreview(null);
  if (map && typeof usaBounds !== "undefined") {
    map.fitBounds(usaBounds);
  }
}

if (homeBtn) {
  homeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    goHome();
  });
}

if (demoInfoBtn) {
  demoInfoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openDemoDisclaimer({ force: true });
  });
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

// Edit Modal
function openEditModal(peak) {
  const form = document.createElement("form");
  form.id = "edit-form";

  const dateField = document.createElement("div");
  dateField.className = "form-field";
  const dateLabel = document.createElement("label");
  dateLabel.htmlFor = "edit-peak-date";
  dateLabel.textContent = "Date climbed";
  const dateFieldInput = document.createElement("input");
  dateFieldInput.id = "edit-peak-date";
  dateFieldInput.type = "date";
  dateFieldInput.name = "date";
  dateFieldInput.value = peak.date || "";
  dateField.append(dateLabel, dateFieldInput);

  const titleField = document.createElement("div");
  titleField.className = "form-field";
  const titleLabel = document.createElement("label");
  titleLabel.htmlFor = "edit-peak-title";
  titleLabel.textContent = "Title";
  const titleFieldInput = document.createElement("input");
  titleFieldInput.id = "edit-peak-title";
  titleFieldInput.type = "text";
  titleFieldInput.name = "title";
  titleFieldInput.value = peak.title || "";
  titleFieldInput.placeholder = "Optional title for this climb";
  titleField.append(titleLabel, titleFieldInput);

  const notesField = document.createElement("div");
  notesField.className = "form-field";
  const notesLabel = document.createElement("label");
  notesLabel.htmlFor = "edit-peak-notes";
  notesLabel.textContent = "Notes";
  const notesFieldInput = document.createElement("textarea");
  notesFieldInput.id = "edit-peak-notes";
  notesFieldInput.name = "notes";
  notesFieldInput.rows = 4;
  notesFieldInput.value = peak.notes || "";
  notesFieldInput.placeholder = "Conditions, route notes, partners…";
  notesField.append(notesLabel, notesFieldInput);

  form.append(dateField, titleField, notesField);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "secondary-btn";
  cancelBtn.onclick = closeModal;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.className = "primary-btn";

  saveBtn.onclick = () => {
    const idx = peaks.findIndex((p) => p.id === peak.id);
    if (idx !== -1) {
      peaks[idx].date = dateFieldInput.value;
      peaks[idx].title = titleFieldInput.value.trim() || null;
      peaks[idx].notes = notesFieldInput.value.trim() || null;
      savePeaks();
      refreshLog();
      showToast(
        `Updated ${formatPeakName(peaks[idx].name)}${
          peaks[idx].date ? " on " + formatDateUS(peaks[idx].date) : ""
        }`,
        "success",
      );
    }
    closeModal();
  };

  openModal({
    title: `Edit Summit - ${formatPeakName(peak.name)}`,
    body: form,
    actions: [cancelBtn, saveBtn],
  });
}

// Delete Modal
function openDeleteModal(peak) {
  const message = document.createElement("p");
  message.style.whiteSpace = "pre-line";
  message.textContent = `Are you sure you want to delete ${formatPeakName(
    peak.name,
  )} on ${
    peak.date ? formatDateUS(peak.date) : "(no date added)"
  }?\n\nThis action cannot be undone.`;

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
    refreshLog();
    showToast(
      `Removed ${formatPeakName(peak.name)}${
        peak.date ? " on " + formatDateUS(peak.date) : ""
      }`,
      "destructive",
    );

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
  refreshLog();
  peakSuggestions.classList.remove("show");
  if (addSummitPreview) addSummitPreview.classList.remove("show");
  map.fitBounds(usaBounds);
  openDemoDisclaimer();
}

init();

/* ===== 404 Message ===== */
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  // Allowed routes (home only)
  const allowed = ["/"];

  if (!allowed.includes(path)) {
    // Hide the app and show 404
    document.getElementById("app").style.display = "none";
    document.getElementById("route-not-found").classList.remove("display-none");
  }
});
