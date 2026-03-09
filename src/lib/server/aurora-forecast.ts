// src/lib/server/aurora-forecast.ts

export type SolarWindData = {
  speed: number;   // km/s
  density: number; // cm^-3
  by: number;      // nT
  bz: number;      // nT
};

export type AuroraBin = {
  lon: number; // geographic lon
  lat: number; // geographic lat
  p: number;   // 0..100
};

export type ForecastFrame = {
  label: 'present' | '+24h' | '+48h';
  time: string;
  kp: number;
  bins: AuroraBin[];
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function gaussian(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function wrapLon(lon: number): number {
  let x = lon;
  while (x < -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

/**
 * Newell coupling proxy:
 * dPhi/dt ∝ V^(4/3) * BT^(2/3) * sin^(8/3)(theta/2)
 *
 * We normalize to a convenient ~0..1.5-ish range for this app.
 */
export function computeNewellCoupling(sw: SolarWindData | null): number {
  if (!sw) return 0;

  const by = sw.by;
  const bz = sw.bz;
  const v = Math.max(sw.speed, 0);

  const bt = Math.sqrt(by * by + bz * bz);
  if (bt <= 0 || v <= 0) return 0;

  // Clock angle in IMF Y-Z plane
  const theta = Math.atan2(Math.abs(by), bz); // 0..pi
  const sinTerm = Math.pow(Math.sin(theta / 2), 8 / 3);

  // Raw Newell-like quantity
  const raw = Math.pow(v, 4 / 3) * Math.pow(bt, 2 / 3) * sinTerm;

  // Empirical normalization for UI-friendly forecasting
  return clamp(raw / 900, 0, 2.0);
}

/**
 * Crude coupling-to-Kp mapping for future frames.
 * This is deliberately soft because we do not want real-time IMF to dominate +24/+48h.
 */
export function couplingToKp(coupling: number): number {
  return clamp(1.2 + 3.8 * Math.pow(coupling, 0.75), 0, 9);
}

/**
 * Approx magnetic coordinates using centered dipole style transform.
 * This is not AACGM, but it is much better than doing everything in geographic lat/lon.
 *
 * North magnetic pole is offset from geographic north, so we rotate the globe
 * into a magnetic frame before modeling the oval. OVATION itself is naturally
 * in magnetic latitude / magnetic local time. :contentReference[oaicite:1]{index=1}
 */
const MAG_POLE_LAT = 80.65;  // approximate north dip pole
const MAG_POLE_LON = -72.68; // approximate north dip pole

export function geoToMag(lat: number, lon: number): { mlat: number; mlon: number } {
  const phi = lat * DEG;
  const lam = lon * DEG;

  const polePhi = MAG_POLE_LAT * DEG;
  const poleLam = MAG_POLE_LON * DEG;

  const x = Math.cos(phi) * Math.cos(lam);
  const y = Math.cos(phi) * Math.sin(lam);
  const z = Math.sin(phi);

  // Rotate around Z by -poleLon
  const x1 = x * Math.cos(-poleLam) - y * Math.sin(-poleLam);
  const y1 = x * Math.sin(-poleLam) + y * Math.cos(-poleLam);
  const z1 = z;

  // Rotate around Y by (90 - poleLat)
  const beta = (Math.PI / 2) - polePhi;
  const x2 = x1 * Math.cos(beta) + z1 * Math.sin(beta);
  const y2 = y1;
  const z2 = -x1 * Math.sin(beta) + z1 * Math.cos(beta);

  const mlat = Math.asin(z2) * RAD;
  const mlon = Math.atan2(y2, x2) * RAD;

  return { mlat, mlon: wrapLon(mlon) };
}

export function magToGeo(mlat: number, mlon: number): { lat: number; lon: number } {
  const phi = mlat * DEG;
  const lam = mlon * DEG;

  const polePhi = MAG_POLE_LAT * DEG;
  const poleLam = MAG_POLE_LON * DEG;

  const x = Math.cos(phi) * Math.cos(lam);
  const y = Math.cos(phi) * Math.sin(lam);
  const z = Math.sin(phi);

  const beta = (Math.PI / 2) - polePhi;

  // Inverse Y rotation
  const x1 = x * Math.cos(-beta) + z * Math.sin(-beta);
  const y1 = y;
  const z1 = -x * Math.sin(-beta) + z * Math.cos(-beta);

  // Inverse Z rotation
  const x2 = x1 * Math.cos(poleLam) - y1 * Math.sin(poleLam);
  const y2 = x1 * Math.sin(poleLam) + y1 * Math.cos(poleLam);
  const z2 = z1;

  const lat = Math.asin(z2) * RAD;
  const lon = Math.atan2(y2, x2) * RAD;

  return { lat, lon: wrapLon(lon) };
}

export function magLonToMLT(mlon: number, time: Date): number {
  const ut = time.getUTCHours() + time.getUTCMinutes() / 60 + time.getUTCSeconds() / 3600;
  return ((mlon / 15) + ut) % 24 < 0
    ? ((mlon / 15) + ut) % 24 + 24
    : ((mlon / 15) + ut) % 24;
}

function circularHourDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 24 - d);
}

/**
 * Component 1: diffuse oval
 * Broad, fairly continuous background aurora.
 */
function diffuseComponent(
  mlat: number,
  mlt: number,
  kp: number,
  coupling: number
): number {
  const midnightBoost = gaussian(circularHourDistance(mlt, 0), 0, 4.2);
  const eq = 67 - 2.8 * (kp - 2) - 2.2 * coupling - 4.0 * midnightBoost;
  const width = 5.0 + 0.7 * kp + 1.4 * coupling;
  const center = eq + width / 2;

  return 0.75 * gaussian(mlat, center, width / 2.4);
}

/**
 * Component 2: nightside bulge / monoenergetic-like contribution
 * Stronger around evening-to-midnight sector.
 */
function nightsideBulgeComponent(
  mlat: number,
  mlt: number,
  kp: number,
  coupling: number,
  by: number
): number {
  const evening = gaussian(circularHourDistance(mlt, 21), 0, 2.4);
  const midnight = gaussian(circularHourDistance(mlt, 0), 0, 2.8);
  const sector = Math.max(evening, midnight);

  // By skews the bulge a bit toward dusk/dawn
  const byShift = clamp(by * 0.18, -1.8, 1.8);
  const center = 66 - 3.3 * (kp - 2) - 2.8 * coupling + byShift;
  const width = 3.2 + 0.5 * kp + 0.8 * coupling;

  return 1.15 * sector * gaussian(mlat, center, width);
}

/**
 * Component 3: cusp / dayside high-latitude component
 * Weak but helps break the "single oval band" look.
 */
function cuspComponent(
  mlat: number,
  mlt: number,
  coupling: number
): number {
  const noon = gaussian(circularHourDistance(mlt, 12), 0, 1.8);
  const latTerm = gaussian(mlat, 78 - 1.2 * coupling, 3.8);

  return 0.28 * noon * latTerm;
}

/**
 * Additional IMF By asymmetry for whole oval.
 */
function byAsymmetryGain(mlt: number, by: number): number {
  const dusk = gaussian(circularHourDistance(mlt, 18), 0, 3.0);
  const dawn = gaussian(circularHourDistance(mlt, 6), 0, 3.0);
  const skew = by >= 0 ? (1 + 0.16 * dusk - 0.10 * dawn) : (1 + 0.16 * dawn - 0.10 * dusk);
  return clamp(skew, 0.8, 1.22);
}

/**
 * Convert component sum to 0..100 probability-like field.
 */
export function forecastAuroraProbability(
  lat: number,
  lon: number,
  kp: number,
  sw: SolarWindData | null,
  time: Date
): number {
  const { mlat, mlon } = geoToMag(lat, lon);
  const mlt = magLonToMLT(mlon, time);

  const coupling = computeNewellCoupling(sw);
  const by = sw?.by ?? 0;

  const diffuse = diffuseComponent(mlat, mlt, kp, coupling);
  const bulge = nightsideBulgeComponent(mlat, mlt, kp, coupling, by);
  const cusp = cuspComponent(mlat, mlt, coupling);

  const total = (diffuse + bulge + cusp) * byAsymmetryGain(mlt, by);

  // Suppress low magnetic latitudes aggressively
  const lowLatMask = clamp((mlat - 42) / 12, 0, 1);

  // Compress into 0..100 range
  return 100 * clamp(total * lowLatMask, 0, 1);
}

/**
 * Blend current solar wind less aggressively as lead time increases.
 */
export function decaySolarWindForLead(
  sw: SolarWindData | null,
  hoursAhead: number
): SolarWindData | null {
  if (!sw) return null;

  let f = 1;
  if (hoursAhead >= 24) f = 0.45;
  if (hoursAhead >= 48) f = 0.25;

  return {
    speed: 350 + (sw.speed - 350) * f,
    density: 4 + (sw.density - 4) * f,
    by: sw.by * f,
    bz: sw.bz * f
  };
}

export function adjustedForecastKp(
  forecastKp: number,
  sw: SolarWindData | null,
  hoursAhead: number
): number {
  if (!sw) return forecastKp;

  const coupling = computeNewellCoupling(sw);
  const couplingKp = couplingToKp(coupling);

  // Mild present influence, fading with time
  const weight = hoursAhead === 0 ? 0.30 : hoursAhead === 24 ? 0.16 : 0.08;
  return clamp(forecastKp * (1 - weight) + couplingKp * weight, 0, 9);
}

export function makeForecastGrid(
  kp: number,
  sw: SolarWindData | null,
  time: Date,
  latStep = 1,
  lonStep = 2
): AuroraBin[] {
  const bins: AuroraBin[] = [];

  for (let lat = 35; lat <= 90; lat += latStep) {
    for (let lon = -180; lon < 180; lon += lonStep) {
      const p = forecastAuroraProbability(lat, lon, kp, sw, time);
      if (p >= 1) {
        bins.push({
          lat,
          lon,
          p: Math.round(p * 10) / 10
        });
      }
    }
  }

  return bins;
}