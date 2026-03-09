export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function dateToJD(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  let yy = y, mm = m;
  if (mm <= 2) { yy--; mm += 12; }
  const A = Math.floor(yy / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5;
}

export function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let s = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0;
  return ((s % 360) + 360) % 360;
}

export function raDecToAltAz(ra: number, dec: number, lat: number, lon: number, lst: number): { alt: number; az: number } {
  const ha = (lst - ra * 15 + 360) % 360 * DEG;
  const decR = dec * DEG;
  const latR = lat * DEG;

  const sinAlt = Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(ha);
  const alt = Math.asin(sinAlt);

  const cosAz = (Math.sin(decR) - Math.sin(alt) * Math.sin(latR)) / (Math.cos(alt) * Math.cos(latR));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

  return { alt: alt * RAD, az: az * RAD };
}

export function galacticToRaDec(lDeg: number, bDeg = 0): { ra: number; dec: number } {
  const raNGP = 192.85948 * DEG;
  const decNGP = 27.12825 * DEG;
  const lOmega = 32.93192 * DEG;
  const l = lDeg * DEG;
  const b = bDeg * DEG;

  const sinDec = Math.sin(b) * Math.sin(decNGP) + Math.cos(b) * Math.cos(decNGP) * Math.sin(l - lOmega);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = Math.cos(b) * Math.cos(l - lOmega);
  const x = Math.sin(b) * Math.cos(decNGP) - Math.cos(b) * Math.sin(decNGP) * Math.sin(l - lOmega);
  const ra = (Math.atan2(y, x) + raNGP + Math.PI * 2) % (Math.PI * 2);

  return { ra: ra * RAD / 15, dec: dec * RAD };
}

export function project(alt: number, az: number, centerAz: number, centerAlt: number, fov: number, cx: number, cy: number, radius: number): { x: number; y: number } | null {
  const a1 = az * DEG, e1 = alt * DEG;
  const a0 = centerAz * DEG, e0 = centerAlt * DEG;

  const x1 = Math.cos(e1) * Math.sin(a1);
  const y1 = Math.cos(e1) * Math.cos(a1);
  const z1 = Math.sin(e1);

  const cosA = Math.cos(-a0), sinA = Math.sin(-a0);
  const rx = x1 * cosA - y1 * sinA;
  const ry = x1 * sinA + y1 * cosA;
  const rz = z1;

  const cosE = Math.cos(Math.PI / 2 - e0), sinE = Math.sin(Math.PI / 2 - e0);
  const fx = rx;
  const fy = ry * cosE - rz * sinE;
  const fz = ry * sinE + rz * cosE;

  if (fz < -0.01) return null;

  const scale = radius / Math.tan(fov * DEG / 2);
  const d = 1.0 + fz;
  if (d < 0.001) return null;

  const sx = cx + (fx / d) * scale;
  const sy = cy + (fy / d) * scale;

  return { x: sx, y: sy };
}

export function hash01(x: number): number {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

export function galacticCoreDistance(lDeg: number): number {
  const a = ((lDeg % 360) + 360) % 360;
  return Math.min(a, 360 - a);
}

export function seededRand(seedObj: { v: number }): number {
  seedObj.v = (1664525 * seedObj.v + 1013904223) >>> 0;
  return seedObj.v / 4294967296;
}

export function aircraftToAltAz(aircraftLat: number, aircraftLon: number, aircraftAltMeters: number, observerLat: number, observerLon: number) {
  const R = 6371000;

  const lat1 = observerLat * DEG;
  const lon1 = observerLon * DEG;
  const lat2 = aircraftLat * DEG;
  const lon2 = aircraftLon * DEG;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const groundDist = R * c;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const azimuth = (Math.atan2(y, x) * RAD + 360) % 360;

  const altitude = Math.atan2(aircraftAltMeters, groundDist) * RAD;
  const slantRange = Math.sqrt(groundDist * groundDist + aircraftAltMeters * aircraftAltMeters);

  return {
    alt: altitude,
    az: azimuth,
    groundDist: groundDist / 1000,
    slantRange: slantRange / 1000
  };
}
