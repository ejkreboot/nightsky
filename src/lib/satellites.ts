import * as satellite from 'satellite.js';
import { DEG } from './coordinates';

export interface SatRecord {
  name: string;
  satrec: satellite.SatRec;
}

export interface SatPosition {
  alt: number;
  az: number;
  rangeSat: number;
  satAltKm: number;
  name: string | null;
}

export function classifySatellite(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('ISS') || n === 'ZARYA') return 'iss';
  if (n.includes('TIANHE') || n.includes('TIANGONG') || n.includes('CSS') || n.includes('MENGTIAN') || n.includes('WENTIAN')) return 'station';
  if (n.includes('STARLINK')) return 'starlink';
  if (n.includes('ONEWEB')) return 'oneweb';
  if (n.includes('HST') || n.includes('HUBBLE')) return 'hubble';
  if (n.includes('IRIDIUM')) return 'iridium';
  if (/ R\/B| DEB/i.test(n) || n.includes('ROCKET') || n.includes('DEBRIS')) return 'debris';
  return 'generic';
}

export const SAT_TYPE_LABELS: Record<string, string> = {
  iss: 'Space Station (ISS)',
  station: 'Space Station',
  starlink: 'Starlink',
  oneweb: 'OneWeb',
  hubble: 'Hubble Space Telescope',
  iridium: 'Iridium',
  debris: 'Rocket Body / Debris',
  generic: 'Satellite'
};

export function getSatelliteAltAz(satrec: satellite.SatRec, date: Date, lat: number, lon: number): SatPosition | null {
  const posVel = satellite.propagate(satrec, date);
  if (!posVel.position || typeof posVel.position === 'boolean') return null;
  const gmst_val = satellite.gstime(date);
  const eci = posVel.position;

  const geo = satellite.eciToGeodetic(eci, gmst_val);
  const satAltKm = geo.height;

  const obsGeo = {
    longitude: lon * DEG,
    latitude: lat * DEG,
    height: 0.2
  };

  const satEcf = satellite.eciToEcf(eci, gmst_val);
  const lookAngles = satellite.ecfToLookAngles(obsGeo, satEcf);

  const azDeg = lookAngles.azimuth * 180 / Math.PI;
  const elDeg = lookAngles.elevation * 180 / Math.PI;
  const rangeSat = lookAngles.rangeSat;

  return { alt: elDeg, az: (azDeg + 360) % 360, rangeSat, satAltKm, name: null };
}

export function parseTLEData(text: string): SatRecord[] {
  const lines = text.trim().split('\n');
  const data: SatRecord[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const tleLine1 = lines[i + 1].trim();
    const tleLine2 = lines[i + 2].trim();
    try {
      const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
      data.push({ name, satrec });
    } catch (_) { /* skip bad TLEs */ }
  }
  return data;
}

const CACHE_KEY = 'nightsky_tle_data';
const CACHE_TIMESTAMP_KEY = 'nightsky_tle_timestamp';
const CACHE_DURATION = 2 * 60 * 60 * 1000;

export async function fetchSatelliteTLEs(): Promise<SatRecord[]> {
  // Check cache
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp, 10);
      if (age < CACHE_DURATION) {
        return parseTLEData(cachedData);
      }
    }
  } catch (e) {
    console.warn('Error reading TLE cache:', e);
  }

  try {
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle');
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    const text = await r.text();

    try {
      localStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('Failed to cache TLE data:', e);
    }

    return parseTLEData(text);
  } catch (err) {
    console.error('Failed to fetch TLE data:', err);
    // Fallback to stale cache
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) return parseTLEData(cachedData);
    } catch (e) {
      console.warn('Could not load fallback TLE data:', e);
    }
    return [];
  }
}

export function drawSatelliteVector(ctx: CanvasRenderingContext2D, type: string, scale = 1) {
  ctx.strokeStyle = 'rgba(255, 220, 140, 0.9)';
  ctx.lineWidth = 1.0 * scale;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawSatSilhouette(ctx, type, scale);
}

function drawSatSilhouette(g: CanvasRenderingContext2D, type: string, scale = 1) {
  const s = scale;
  const savedStroke = g.strokeStyle;
  switch (type) {
    case 'iss': {
      g.beginPath();
      g.moveTo(-16 * s, 0); g.lineTo(16 * s, 0);
      g.stroke();
      g.strokeRect(-1.5 * s, -2.5 * s, 3 * s, 5 * s);
      for (const xOff of [-12, -6, 6, 12]) {
        g.strokeRect((xOff - 2.5) * s, -8 * s, 5 * s, 5.5 * s);
        g.strokeRect((xOff - 2.5) * s, 2.5 * s, 5 * s, 5.5 * s);
      }
      break;
    }
    case 'station': {
      g.strokeRect(-4 * s, -2.5 * s, 8 * s, 5 * s);
      g.strokeRect(-15 * s, -7 * s, 9 * s, 14 * s);
      g.strokeRect(6 * s, -7 * s, 9 * s, 14 * s);
      g.strokeStyle = 'rgba(255, 220, 140, 0.3)';
      g.beginPath();
      g.moveTo(-10.5 * s, -7 * s); g.lineTo(-10.5 * s, 7 * s);
      g.moveTo(10.5 * s, -7 * s); g.lineTo(10.5 * s, 7 * s);
      g.moveTo(-15 * s, 0); g.lineTo(-6 * s, 0);
      g.moveTo(6 * s, 0); g.lineTo(15 * s, 0);
      g.stroke();
      g.strokeStyle = savedStroke;
      break;
    }
    case 'starlink': {
      g.strokeRect(-3 * s, -2 * s, 6 * s, 4 * s);
      g.strokeRect(4 * s, -7 * s, 12 * s, 14 * s);
      g.strokeStyle = 'rgba(255, 220, 140, 0.25)';
      g.beginPath();
      for (let y = -7; y <= 7; y += 3.5) { g.moveTo(4 * s, y * s); g.lineTo(16 * s, y * s); }
      for (let x = 4; x <= 16; x += 4) { g.moveTo(x * s, -7 * s); g.lineTo(x * s, 7 * s); }
      g.stroke();
      g.strokeStyle = savedStroke;
      break;
    }
    case 'oneweb': {
      g.beginPath();
      g.arc(0, 0, 3 * s, 0, Math.PI * 2);
      g.stroke();
      g.strokeRect(-14 * s, -4 * s, 9 * s, 8 * s);
      g.strokeRect(5 * s, -4 * s, 9 * s, 8 * s);
      g.strokeStyle = 'rgba(255, 220, 140, 0.25)';
      g.beginPath();
      g.moveTo(-9.5 * s, -4 * s); g.lineTo(-9.5 * s, 4 * s);
      g.moveTo(9.5 * s, -4 * s); g.lineTo(9.5 * s, 4 * s);
      g.stroke();
      g.strokeStyle = savedStroke;
      break;
    }
    case 'hubble': {
      g.strokeRect(-2.5 * s, -8 * s, 5 * s, 16 * s);
      g.beginPath();
      g.arc(0, -8 * s, 2.5 * s, Math.PI, 0);
      g.stroke();
      g.strokeRect(-14 * s, -3 * s, 10 * s, 6 * s);
      g.strokeRect(4 * s, -3 * s, 10 * s, 6 * s);
      g.strokeStyle = 'rgba(255, 220, 140, 0.25)';
      g.beginPath();
      g.moveTo(-9 * s, -3 * s); g.lineTo(-9 * s, 3 * s);
      g.moveTo(9 * s, -3 * s); g.lineTo(9 * s, 3 * s);
      g.stroke();
      g.strokeStyle = savedStroke;
      break;
    }
    case 'iridium': {
      g.strokeRect(-2 * s, -6 * s, 4 * s, 12 * s);
      for (let a = 0; a < 3; a++) {
        g.save();
        g.rotate(a * Math.PI * 2 / 3 - Math.PI / 2);
        g.strokeRect(2 * s, -1.5 * s, 9 * s, 3 * s);
        g.restore();
      }
      break;
    }
    case 'debris': {
      g.strokeRect(-3, -6, 6, 12);
      g.strokeStyle = 'rgba(255, 220, 140, 0.3)';
      g.setLineDash([2, 2]);
      g.beginPath();
      g.moveTo(-3, -2); g.lineTo(3, -2);
      g.moveTo(-3, 2); g.lineTo(3, 2);
      g.moveTo(0, -6); g.lineTo(0, 6);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = savedStroke;
      break;
    }
    default: {
      g.strokeRect(-3, -3, 6, 6);
      g.strokeRect(-14, -4.5, 9, 9);
      g.strokeRect(5, -4.5, 9, 9);
      g.strokeStyle = 'rgba(255, 220, 140, 0.25)';
      g.beginPath();
      g.moveTo(-9.5, -4.5); g.lineTo(-9.5, 4.5);
      g.moveTo(9.5, -4.5); g.lineTo(9.5, 4.5);
      g.stroke();
      g.strokeStyle = savedStroke;
      break;
    }
  }
}
