export function loadPeaks() {
  return JSON.parse(localStorage.getItem("peaks")) || [];
}

export function savePeaks(peaks) {
  localStorage.setItem("peaks", JSON.stringify(peaks));
}

export function renderPeaks(peaks, options = {}) {
  const {
    myPeaks = document.getElementById("my-peaks"),
    peakCount = document.getElementById("peak-count"),
    renderUserMarkers = () => {},
    showToast = () => {},
  } = options;

  if (!myPeaks || !peakCount) return;

  myPeaks.innerHTML = "";
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
        savePeaks(peaks);
        // re-render via the same options
        renderPeaks(peaks, options);
        renderUserMarkers(peaks);
        showToast(`Removed ${peak.name}`, "destructive");
      }
    };

    li.appendChild(delBtn);
    myPeaks.appendChild(li);
  });
  peakCount.textContent = peaks.length;
  renderUserMarkers(peaks);
}
