// Aurora Borealis data processing using NOAA OVATION Prime model
// Reference: https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2011SW000746

export interface OvationData {
  observationTime: string;
  forecastTime: string;
  coordinates: [number, number, number][]; // [longitude, latitude, aurora_probability]
}

export interface AuroraViewline {
  // For each longitude (0-359), the southernmost latitude where aurora is visible
  points: { lon: number; lat: number }[];
}

export interface KpForecast {
  time: string;
  kp: number;
}

/**
 * Compute the aurora "viewline" from OVATION grid data.
 * The viewline is the southernmost latitude at each longitude where aurora
 * probability exceeds a threshold. For the "view on horizon" line, we extend
 * approximately 6-8° further south (aurora visible at ~800km+ distance on horizon).
 */
export function computeViewline(
  coordinates: [number, number, number][],
  threshold: number = 3,
  horizonExtension: number = 7
): AuroraViewline {
  // Build a map: longitude -> lowest latitude with aurora above threshold
  const lonToMinLat = new Map<number, number>();

  for (const [lon, lat, aurora] of coordinates) {
    // Only consider Northern Hemisphere for northern viewline
    if (lat < 0) continue;
    if (aurora >= threshold) {
      const current = lonToMinLat.get(lon);
      if (current === undefined || lat < current) {
        lonToMinLat.set(lon, lat);
      }
    }
  }

  const points: { lon: number; lat: number }[] = [];
  for (let lon = 0; lon < 360; lon++) {
    const minLat = lonToMinLat.get(lon);
    if (minLat !== undefined) {
      // Extend south for horizon visibility
      points.push({ lon, lat: Math.max(0, minLat - horizonExtension) });
    }
  }

  return { points };
}

// Geomagnetic dipole pole (IGRF-13 epoch 2025)
const MAG_POLE_LAT = 80.7; // °N
const MAG_POLE_LON = -72.7; // °E (= 287.3°E)

/**
 * Convert geographic longitude + UT hour to approximate magnetic local time.
 * MLT ≈ UT + (geoLon − magPoleLon) / 15, wrapped to [0, 24).
 */
export function geoLonToMLT(geoLon: number, utHours: number): number {
  const mlt = utHours + (geoLon - MAG_POLE_LON) / 15;
  return ((mlt % 24) + 24) % 24;
}

/**
 * Equatorward boundary of the auroral oval as a function of Kp and MLT.
 * Uses Feldstein-Starkov statistical model:
 *   λ_eq(MLT) = λ_avg − A·cos((MLT − 0.5) · π/12)
 * where λ_avg = 64° − 2.5°·Kp is the mean equatorward boundary
 * and A = 4 + 0.6·Kp is the day-night asymmetry amplitude.
 * MLT=0 is magnetic midnight (oval dips lowest), MLT=12 is magnetic noon.
 * Subtracting 0.5h shifts the minimum slightly past midnight (empirical).
 */
export function equatorwardBoundary(kp: number, mlt: number): number {
  const avg = 64 - 2.5 * kp;
  const amp = 4 + 0.6 * kp; // stronger Kp → bigger day-night spread
  return avg - amp * Math.cos(((mlt - 0.5) * Math.PI) / 12);
}

/**
 * Poleward boundary of the auroral oval as a function of Kp and MLT.
 */
export function polewardBoundary(kp: number, mlt: number): number {
  const avg = Math.min(80, 67 + 0.5 * kp);
  const amp = 3 + 0.3 * kp;
  return avg - amp * Math.cos(((mlt - 0.5) * Math.PI) / 12);
}

/**
 * Estimate aurora viewline latitude (equatorward boundary minus horizon extension)
 * at a specific geographic longitude, accounting for MLT asymmetry.
 */
export function kpToViewlineLatitude(kp: number, mlt?: number): number {
  const eq = mlt !== undefined
    ? equatorwardBoundary(kp, mlt)
    : 64 - 2.5 * kp;
  const horizonViewable = eq - 7;
  return Math.max(20, Math.min(80, horizonViewable));
}

/**
 * Generate an MLT-aware elliptical viewline from Kp-based estimate.
 * The oval is offset toward magnetic midnight and displaced by the
 * geomagnetic pole's offset from the geographic pole.
 */
export function generateKpViewline(kp: number, utHours?: number): AuroraViewline {
  const ut = utHours ?? new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const points: { lon: number; lat: number }[] = [];

  for (let lon = 0; lon < 360; lon++) {
    const geoLon = lon > 180 ? lon - 360 : lon;
    const mlt = geoLonToMLT(geoLon, ut);
    const eqBound = equatorwardBoundary(kp, mlt);
    const viewLat = eqBound - 7; // horizon extension
    points.push({ lon, lat: Math.max(20, Math.min(80, viewLat)) });
  }

  return { points };
}

/**
 * Build a 2D aurora probability grid from the OVATION coordinate array.
 * Returns a 360x181 grid (lon 0-359, lat -90 to +90) normalized to 0-1.
 */
export function buildAuroraGrid(
  coordinates: [number, number, number][]
): Float32Array {
  // Grid: 360 longitudes × 181 latitudes (−90 to +90)
  const grid = new Float32Array(360 * 181);
  let maxVal = 0;

  for (const [lon, lat, aurora] of coordinates) {
    if (lon < 0 || lon >= 360 || lat < -90 || lat > 90) continue;
    const idx = lon * 181 + (lat + 90);
    grid[idx] = aurora;
    if (aurora > maxVal) maxVal = aurora;
  }

  // Normalize to 0-1
  if (maxVal > 0) {
    for (let i = 0; i < grid.length; i++) {
      grid[i] /= maxVal;
    }
  }

  return grid;
}

// --- Solar wind & Newell coupling ---

export interface SolarWindData {
  speed: number;      // km/s
  bz: number;         // nT (GSM)
  by: number;         // nT (GSM)
  bt: number;         // nT (total transverse field)
  density: number;    // particles/cm³
  timestamp: string;
}

/**
 * Newell coupling function (Newell et al., 2007).
 * dΦ/dt = v^(4/3) · B_T^(2/3) · sin^(8/3)(θ_c / 2)
 * where θ_c = arccos(Bz / B_T) is the IMF clock angle in GSM.
 * This is the primary driver used by the OVATION Prime model.
 */
export function computeNewellCoupling(speed: number, bz: number, by: number): number {
  const bt = Math.sqrt(by * by + bz * bz);
  if (bt === 0 || speed <= 0) return 0;
  const thetaC = Math.acos(Math.max(-1, Math.min(1, bz / bt)));
  const sinHalfTheta = Math.sin(thetaC / 2);
  return Math.pow(speed, 4 / 3) * Math.pow(bt, 2 / 3) * Math.pow(sinHalfTheta, 8 / 3);
}

/**
 * Map Newell coupling value to an effective Kp index.
 * Empirical calibration: Kp ≈ 4.5 · log10(coupling / 500), clamped to [0, 9].
 */
export function couplingToKp(coupling: number): number {
  if (coupling <= 0) return 0;
  return Math.max(0, Math.min(9, 4.5 * Math.log10(coupling / 500)));
}

/**
 * Parse recent DSCOVR solar wind data (mag + plasma) and average the last ~30 minutes.
 * mag rows: [time, bx, by, bz, lon, lat, bt]
 * plasma rows: [time, density, speed, temperature]
 */
export function parseSolarWindData(magRows: any[][], plasmaRows: any[][]): SolarWindData | null {
  const magRecent = magRows.slice(-30);
  const plasmaRecent = plasmaRows.slice(-30);

  let sumBz = 0, sumBy = 0, sumBt = 0, magN = 0;
  for (const row of magRecent) {
    const by = parseFloat(row[2]);
    const bz = parseFloat(row[3]);
    const bt = parseFloat(row[6]);
    if (!isNaN(by) && !isNaN(bz) && !isNaN(bt)) {
      sumBy += by; sumBz += bz; sumBt += bt; magN++;
    }
  }

  let sumSpeed = 0, sumDensity = 0, plasmaN = 0;
  for (const row of plasmaRecent) {
    const density = parseFloat(row[1]);
    const speed = parseFloat(row[2]);
    if (!isNaN(density) && !isNaN(speed)) {
      sumDensity += density; sumSpeed += speed; plasmaN++;
    }
  }

  if (magN === 0 || plasmaN === 0) return null;

  return {
    bz: sumBz / magN,
    by: sumBy / magN,
    bt: sumBt / magN,
    speed: sumSpeed / plasmaN,
    density: sumDensity / plasmaN,
    timestamp: magRecent[magRecent.length - 1]?.[0] ?? ''
  };
}

/**
 * Blend solar-wind-derived Kp with a Kp forecast value.
 * Near-term forecasts weight solar wind heavily; longer forecasts fade to Kp.
 * Weight = exp(-hoursAhead / 18): ~0.51 at 12h, ~0.26 at 24h, ~0.07 at 48h, ~0.02 at 72h.
 */
export function adjustedForecastKp(
  forecastKp: number,
  solarWindKp: number,
  hoursAhead: number
): number {
  const swWeight = Math.exp(-hoursAhead / 18);
  return Math.max(0, Math.min(9, swWeight * solarWindKp + (1 - swWeight) * forecastKp));
}
