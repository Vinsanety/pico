// Get Elevation OSM API call
export async function getElevationFromOSM(lat, lon) {
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
  return null;
}

export function formatDateUS(isoDateStr) {
  if (!isoDateStr) return "";
  const [year, month, day] = isoDateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}
