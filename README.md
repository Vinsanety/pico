# Pico Summit Log

A web app for tracking mountain summits, visualizing them on a map, and managing your climbing history.

## Live Demo
[View Pico Live](https://pico-summit-log.web.app/)

## Features
- Add summits with autocomplete search, elevation lookup, and optional title/notes per climb
- Map-first layout with a left nav rail, top map search, satellite default basemap, and street toggle
- Top search merges places and log climbs into one list
- Selecting a search result or map summit opens one peak pane: peak info, Add summit, last climbed, and repeats
- Add peak and Logbook both open as floating panels under the search bar
- Full-height logbook grouped by unique summit, with search, sort, load-more, and a subtle summit count
- Mobile: Pico brand banner above search, app-like bottom action bar
- First-visit demo notice explaining browser-only localStorage persistence
- Accessible edit/delete modals and toast feedback
- FE Demo project: data currently only persists via browser localStorage

## Design
The map is the default view. Desktop uses a left rail for brand and actions with search above floating panels. Mobile puts the Pico banner above search and keeps Add peak / Logbook in a bottom app bar. Both panels open under search and stay usable even with thousands of climbs.

## Tech Stack
- Vanilla JavaScript, HTML, CSS
- [Leaflet](https://leafletjs.com/) for maps + marker clustering
- [OpenStreetMap Nominatim](https://nominatim.org/) for geocoding
- [Overpass API](https://overpass-api.de/) for elevation data
- Firebase Hosting

## Future Improvements
- Sync with backend for multi-device support
- User authentication
- Export/import summit logs
