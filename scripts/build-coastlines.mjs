// scripts/build-coastlines.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import shapefile from 'shapefile';

const INPUT = './data/ne_50m_coastline.shp';
const OUTPUT = './src/lib/coastlines.ts';

// Keep only points relevant to your northern aurora view.
// You can loosen this if needed.
const MIN_LAT = 15;

function roundCoord(x, digits = 3) {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function splitDateline(path) {
  if (path.length < 2) return [path];

  const out = [];
  let current = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dLon = Math.abs(b[0] - a[0]);

    // Break segments that jump across the dateline
    if (dLon > 180) {
      if (current.length > 1) out.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }

  if (current.length > 1) out.push(current);
  return out;
}

function filterAndRound(coords) {
  return coords
    .filter(([, lat]) => lat >= MIN_LAT)
    .map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)]);
}

const features = [];
const source = await shapefile.open(INPUT);

while (true) {
  const result = await source.read();
  if (result.done) break;
  features.push(result.value);
}

const paths = [];

for (const feature of features) {
  const geom = feature.geometry;
  if (!geom) continue;

  if (geom.type === 'LineString') {
    const filtered = filterAndRound(geom.coordinates);
    for (const seg of splitDateline(filtered)) {
      if (seg.length > 1) paths.push(seg);
    }
  } else if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates) {
      const filtered = filterAndRound(line);
      for (const seg of splitDateline(filtered)) {
        if (seg.length > 1) paths.push(seg);
      }
    }
  }
}

const file = `// Auto-generated from Natural Earth coastline data.
// Do not edit by hand.

export const COASTLINE_PATHS: [number, number][][] = ${JSON.stringify(paths, null, 2)};\n`;

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, file, 'utf8');

console.log(`Wrote ${paths.length} coastline paths to ${OUTPUT}`);