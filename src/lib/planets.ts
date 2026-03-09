import { dateToJD } from './coordinates';

export interface PlanetDef {
  name: string;
  symbol: string;
  color: string;
  a: number; e: number; I: number; L: number; wbar: number; Om: number;
  da: number; de: number; dI: number; dL: number; dwbar: number; dOm: number;
}

export interface PlanetPosition {
  name: string;
  symbol: string;
  color: string;
  ra: number;
  dec: number;
  dist: number;
  phaseName?: string;
  phase?: number;
  age?: number;
  illuminated?: number;
  waxing?: boolean;
}

export const PLANETS: PlanetDef[] = [
  { name: "Mercury", symbol: "☿", color: "#b8b0a0",
    a:0.387098, e:0.205630, I:7.005, L:252.251, wbar:77.458, Om:48.331,
    da:0, de:0.00002123, dI:-0.00590, dL:149472.674, dwbar:0.16047, dOm:-0.12534 },
  { name: "Venus", symbol: "♀", color: "#e8d8b0",
    a:0.723332, e:0.006772, I:3.3946, L:181.9797, wbar:131.5637, Om:76.6799,
    da:0, de:-0.00004938, dI:-0.00078, dL:58517.8155, dwbar:0.00268, dOm:-0.27769 },
  { name: "Mars", symbol: "♂", color: "#d08060",
    a:1.523679, e:0.093400, I:1.8497, L:-4.5535, wbar:-23.9437, Om:49.5581,
    da:0, de:0.00007882, dI:-0.00178, dL:19140.2993, dwbar:0.44441, dOm:-0.29257 },
  { name: "Jupiter", symbol: "♃", color: "#d8c890",
    a:5.2024, e:0.04849, I:1.3033, L:34.3515, wbar:14.7539, Om:100.4542,
    da:0, de:0.00018026, dI:-0.00183, dL:3034.9057, dwbar:0.21890, dOm:0.20469 },
  { name: "Saturn", symbol: "♄", color: "#d8c870",
    a:9.5371, e:0.05386, I:2.4889, L:50.0774, wbar:92.5986, Om:113.6634,
    da:0, de:-0.00050991, dI:0.00193, dL:1222.1138, dwbar:-0.41897, dOm:-0.28867 }
];

export const PLANET_TEXTURE_URLS: Record<string, string> = {
  Mercury: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Transparent_Mercury.png',
  Venus: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Venus_globe_-_transparent_background.png',
  Mars: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Transparent_Mercury.png',
  Jupiter: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Jupiter_%28transparent%29.png',
  Saturn: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Transparent_Saturn.png'
};

export const MOON_TEST_OVERRIDE = {
  enabled: false,
  ra: 18,
  dec: 71
};

function computePlanetHelio(planet: PlanetDef, jd: number) {
  const T = (jd - 2451545.0) / 36525.0;
  const a = planet.a + planet.da * T;
  const e = planet.e + planet.de * T;
  const I = (planet.I + planet.dI * T) * Math.PI / 180;
  const L = (planet.L + planet.dL * T) % 360;
  const wbar = (planet.wbar + planet.dwbar * T) % 360;
  const Om = (planet.Om + planet.dOm * T) % 360;
  const w = (wbar - Om) * Math.PI / 180;
  const M = ((L - wbar) % 360 + 360) % 360 * Math.PI / 180;

  let E = M;
  for (let i = 0; i < 20; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosOm = Math.cos(Om * Math.PI / 180), sinOm = Math.sin(Om * Math.PI / 180);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const x = (cosW * cosOm - sinW * sinOm * cosI) * xp + (-sinW * cosOm - cosW * sinOm * cosI) * yp;
  const y = (cosW * sinOm + sinW * cosOm * cosI) * xp + (-sinW * sinOm + cosW * cosOm * cosI) * yp;
  const z = (sinW * sinI) * xp + (cosW * sinI) * yp;

  return { x, y, z };
}

export function getPlanetPositions(date: Date): PlanetPosition[] {
  const jd = dateToJD(date);
  const T = (jd - 2451545.0) / 36525.0;

  const earth: PlanetDef = {
    name: 'Earth', symbol: '', color: '',
    a: 1.000002, e: 0.016709 - 0.00004204 * T,
    I: -0.00005, L: 100.4664 + 35999.3729 * T,
    wbar: 102.9373 + 0.32327 * T, Om: 0,
    da: 0, de: 0, dI: 0, dL: 0, dwbar: 0, dOm: 0
  };

  const earthPos = computePlanetHelio(earth, jd);
  const results: PlanetPosition[] = [];

  for (const p of PLANETS) {
    const pos = computePlanetHelio(p, jd);
    const dx = pos.x - earthPos.x;
    const dy = pos.y - earthPos.y;
    const dz = pos.z - earthPos.z;

    const eps = 23.4393 * Math.PI / 180;
    const xeq = dx;
    const yeq = dy * Math.cos(eps) - dz * Math.sin(eps);
    const zeq = dy * Math.sin(eps) + dz * Math.cos(eps);

    const ra = ((Math.atan2(yeq, xeq) * 180 / Math.PI) + 360) % 360 / 15;
    const dec = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq)) * 180 / Math.PI;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    results.push({ name: p.name, symbol: p.symbol, color: p.color, ra, dec, dist });
  }

  // Moon (simplified)
  const D = jd - 2451545.0;
  const moonL = (218.316 + 13.176396 * D) % 360 * Math.PI / 180;
  const moonM = (134.963 + 13.064993 * D) % 360 * Math.PI / 180;
  const moonF = (93.272 + 13.229350 * D) % 360 * Math.PI / 180;
  const moonLon = moonL + 6.289 * Math.PI / 180 * Math.sin(moonM);
  const moonLat = 5.128 * Math.PI / 180 * Math.sin(moonF);

  const eps2 = 23.4393 * Math.PI / 180;
  const moonX = Math.cos(moonLat) * Math.cos(moonLon);
  const moonY = Math.cos(eps2) * Math.cos(moonLat) * Math.sin(moonLon) - Math.sin(eps2) * Math.sin(moonLat);
  const moonZ = Math.sin(eps2) * Math.cos(moonLat) * Math.sin(moonLon) + Math.cos(eps2) * Math.sin(moonLat);

  const computedMoonRa = ((Math.atan2(moonY, moonX) * 180 / Math.PI) + 360) % 360 / 15;
  const computedMoonDec = Math.atan2(moonZ, Math.sqrt(moonX * moonX + moonY * moonY)) * 180 / Math.PI;
  const moonRa = MOON_TEST_OVERRIDE.enabled ? MOON_TEST_OVERRIDE.ra : computedMoonRa;
  const moonDec = MOON_TEST_OVERRIDE.enabled ? MOON_TEST_OVERRIDE.dec : computedMoonDec;
  const moonPhase = getMoonPhaseInfo(jd);

  results.push({
    name: "Moon", symbol: "☽", color: "#e8e4d8",
    ra: moonRa, dec: moonDec, dist: 0.00257,
    phaseName: moonPhase.phaseName, phase: moonPhase.phase,
    age: moonPhase.age, illuminated: moonPhase.illuminated, waxing: moonPhase.waxing
  });

  return results;
}

export function getMoonPhaseInfo(jd: number) {
  const synodicMonth = 29.530588853;
  const referenceNewMoon = 2451550.1;
  const age = ((jd - referenceNewMoon) % synodicMonth + synodicMonth) % synodicMonth;
  const phase = age / synodicMonth;
  const illuminated = 0.5 * (1 - Math.cos(phase * Math.PI * 2));
  return {
    phase, age, illuminated,
    waxing: phase < 0.5,
    phaseName: getMoonPhaseName(phase)
  };
}

function getMoonPhaseName(phase: number): string {
  if (phase < 0.03 || phase >= 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

export function createPlanetSprite(planet: PlanetDef): HTMLCanvasElement {
  const isSaturn = planet.name === 'Saturn';
  const size = isSaturn ? 48 : 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = isSaturn ? 18 : 24;

  if (isSaturn) {
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.35);
    const ring = c.createLinearGradient(-r * 2.4, 0, r * 2.4, 0);
    ring.addColorStop(0, 'rgba(210, 195, 145, 0.0)');
    ring.addColorStop(0.25, 'rgba(210, 195, 145, 0.45)');
    ring.addColorStop(0.5, 'rgba(255, 240, 190, 0.75)');
    ring.addColorStop(0.75, 'rgba(210, 195, 145, 0.45)');
    ring.addColorStop(1, 'rgba(210, 195, 145, 0.0)');
    c.fillStyle = ring;
    c.beginPath();
    c.ellipse(0, 0, r * 2.3, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    c.clearRect(-r * 1.2, -r * 0.48, r * 2.4, r * 0.96);
    c.restore();
  }

  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.clip();

  const base = c.createRadialGradient(cx - r * 0.38, cy - r * 0.38, r * 0.18, cx, cy, r * 1.05);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.3, planet.color);
  base.addColorStop(1, 'rgba(35, 35, 35, 1)');
  c.fillStyle = base;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);

  if (planet.name === 'Mercury') {
    c.fillStyle = 'rgba(70, 70, 70, 0.25)';
    for (let i = 0; i < 10; i++) {
      const px = cx - r * 0.65 + i * (r * 0.15);
      const py = cy + Math.sin(i * 1.7) * r * 0.45;
      c.beginPath();
      c.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
      c.fill();
    }
  } else if (planet.name === 'Venus') {
    c.strokeStyle = 'rgba(255, 245, 210, 0.22)';
    c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(cx - r, cy + i * 6);
      c.bezierCurveTo(cx - r * 0.25, cy + i * 5, cx + r * 0.2, cy + i * 7, cx + r, cy + i * 4);
      c.stroke();
    }
  } else if (planet.name === 'Mars') {
    c.fillStyle = 'rgba(80, 30, 20, 0.35)';
    c.beginPath();
    c.ellipse(cx - r * 0.2, cy + r * 0.1, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(245, 245, 245, 0.5)';
    c.beginPath();
    c.arc(cx + r * 0.15, cy - r * 0.72, r * 0.2, 0, Math.PI * 2);
    c.fill();
  } else if (planet.name === 'Jupiter') {
    c.fillStyle = 'rgba(120, 85, 45, 0.28)';
    for (let i = -3; i <= 3; i++) {
      c.fillRect(cx - r, cy + i * 6 - 1, r * 2, 3);
    }
    c.fillStyle = 'rgba(210, 120, 90, 0.45)';
    c.beginPath();
    c.ellipse(cx + r * 0.35, cy + r * 0.15, r * 0.2, r * 0.12, 0.15, 0, Math.PI * 2);
    c.fill();
  } else if (planet.name === 'Saturn') {
    c.fillStyle = 'rgba(145, 120, 75, 0.22)';
    for (let i = -2; i <= 2; i++) {
      c.fillRect(cx - r, cy + i * 4 - 1, r * 2, 2);
    }
  }

  const shade = c.createLinearGradient(cx - r, cy, cx + r, cy);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  c.fillStyle = shade;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.restore();

  c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();

  return canvas;
}
