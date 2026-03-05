# Night Sky

An interactive, browser-based night sky viewer built as a single-page app.

It renders stars, constellation lines, and major planets for your current location and time, with pan/zoom controls and object tooltips.

## Live Demo

https://ejkreboot.github.io/nightsky/

## Features

- Real-time sky rendering based on date/time and observer coordinates
- Geolocation prompt on load, with manual latitude/longitude fallback
- Interactive navigation:
	- Drag to pan (azimuth/altitude)
	- Scroll or pinch to zoom (field of view)
- Layer toggles:
	- Constellation lines
	- Star/planet labels
	- Constellation names
	- Planets
	- Milky Way band
	- Stellar temperature coloring
- Magnitude slider to filter visible stars by brightness
- Hover tooltips for stars and planets (mag, RA/Dec, alt/az, etc.)

## Project Structure

- `index.html` — Complete app (HTML, CSS, JS, data)
- `README.md` — Project documentation

## Run Locally

Because browser geolocation usually requires a secure context (`https://`) or `localhost`, run this with a local server instead of opening the file directly.

### Option 1: Python

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

### Option 2: VS Code Live Server

If you use the Live Server extension, open `index.html` with Live Server.

## Usage

1. Allow location access, or enter latitude/longitude manually.
2. Drag to look around the sky.
3. Scroll/pinch to change zoom.
4. Use bottom controls to toggle overlays and set star magnitude limit.
5. Hover objects to view details in the tooltip.

## Notes

- Default fallback location is Grand Rapids, MI (`42.96`, `-85.66`).
- Planet positions are computed from simplified orbital elements (good for visualization, not precision ephemeris work).
