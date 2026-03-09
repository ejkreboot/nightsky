# NightSky

A real-time interactive planetarium web app that renders the night sky above your location. Built with SvelteKit and HTML5 Canvas.

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Stars** — ~9,100 stars from the Hipparcos catalog with magnitude-based sizing, B-V color temperature rendering, glow halos, and diffraction spikes for the brightest stars
- **Constellations** — All 88 IAU constellation stick figures with optional labels
- **Planets** — Mercury, Venus, Mars, Jupiter, and Saturn computed from Keplerian orbital elements with perturbation corrections
- **Moon** — Textured disc with accurate phase/illumination calculations
- **Aurora overlay** — NOAA-driven aurora probability rendered directly on the main sky view for the current sky time
- **Aurora forecast map** — Dedicated polar forecast route with current and near-future aurora frames
- **Satellites** — Real-time tracking of ISS, space stations, Starlink, OneWeb, Hubble, and debris via TLE propagation (using satellite.js)
- **Live aircraft** — ADS-B positions from the Airlabs API with type-specific SVG icons (airliners, regional jets, turboprops, heavies, business jets, GA, helicopters)
- **Interactive controls** — Drag to pan, scroll to zoom, adjustable date/time/location, togglable display layers, configurable magnitude limit
- **Pinned aircraft tooltips** — Click any aircraft to track flight details (route, altitude, speed, registration)

## Tech Stack

- **SvelteKit** — full-stack framework with server-side API routes
- **TypeScript** — type-safe codebase
- **Vite** — dev server and build tooling
- **satellite.js** — SGP4/SDP4 orbital propagation for satellite positions
- **HTML5 Canvas** — hardware-accelerated 2D rendering

## Getting Started

### Prerequisites

- Node.js 18+

### Install

```sh
npm install
```

### Configure

Copy the example environment file and add your Airlabs API key:

```sh
mv .env.ex .env
```

Then set `AIRLABS_API_KEY=your_key_here` in `.env`.

### Develop

```sh
npm run dev
```

### Build

```sh
npm run build
npm run preview
```

## Deploy To Vercel

Install dependencies, then deploy the repo to Vercel as a SvelteKit project.

Set this environment variable in the Vercel project settings:

```sh
AIRLABS_API_KEY=your_key_here
```

The app uses `@sveltejs/adapter-vercel`, so no extra `vercel.json` is required for the current routes. If you change `AIRLABS_API_KEY`, redeploy so the server bundle picks up the new value.

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/aircraft` | GET | Fetches live ADS-B aircraft data near a given lat/lon/distance |
| `/api/aurora-forecast` | GET | Returns current and forecast aurora probability frames derived from NOAA OVATION, Kp, and solar wind data |

## Routes

| Route | Description |
|---|---|
| `/` | Main planetarium view with stars, planets, moon, satellites, aircraft, and an aurora overlay for the active sky time |
| `/aurora` | Polar aurora forecast globe with present and forecast frames |

## Project Structure

```
src/
├── lib/
│   ├── coordinates.ts      # Astronomical coordinate transforms (RA/Dec → Alt/Az, projection)
│   ├── stars.ts             # Star catalog, B-V color mapping, constellation data
│   ├── planets.ts           # Planetary ephemeris and moon phase calculations
│   ├── aurora.ts            # Aurora sampling and sky projection helpers
│   ├── satellites.ts        # TLE fetching, parsing, propagation, and rendering
│   ├── aircraft.ts          # Aircraft SVG catalog and ICAO type mapping
│   ├── flights.ts           # Flight metadata caching
│   ├── stars-data.json      # Hipparcos star catalog (~9,100 entries)
│   └── constellations-data.json  # IAU constellation line segments
├── routes/
│   ├── +page.svelte         # Main planetarium canvas, HUD, and aurora overlay
│   ├── aurora/+page.svelte  # Dedicated aurora forecast globe
│   └── api/
│       ├── aircraft/        # Server-side aircraft data proxy
│       └── aurora-forecast/ # Server-side aurora forecast proxy
└── app.html
```
