import { json } from '@sveltejs/kit';
import {
  adjustedForecastKp,
  decaySolarWindForLead,
  makeForecastGrid,
  type SolarWindData
} from '$lib/server/aurora-forecast';

const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const SOLAR_WIND_MAG_URL = 'https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json';
const SOLAR_WIND_PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json';

type OvationPoint = [number, number, number];

type Frame = {
  label: string;
  time: string;
  kp: number;
  bins: { lon: number; lat: number; p: number }[];
};

function parseOvation(data: any) {
  return {
    observationTime: data['Observation Time'] ?? '',
    forecastTime: data['Forecast Time'] ?? '',
    coordinates: (data.coordinates ?? []) as OvationPoint[]
  };
}

function parseKpForecast(rows: any[]): { time: string; kp: number }[] {
  const out: { time: string; kp: number }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 2) continue;

    const kp = Number(row[1]);
    if (!Number.isFinite(kp)) continue;

    out.push({
      time: String(row[0]),
      kp
    });
  }

  return out;
}

function nearestForecastKp(
  forecasts: { time: string; kp: number }[],
  target: Date
): { time: string; kp: number } {
  let best = forecasts[0] ?? { time: target.toISOString(), kp: 2 };
  let bestDt = Infinity;

  for (const fc of forecasts) {
    const dt = Math.abs(new Date(fc.time).getTime() - target.getTime());
    if (dt < bestDt) {
      best = fc;
      bestDt = dt;
    }
  }

  return best;
}

function parseSolarWindData(magRows: any[], plasmaRows: any[]): SolarWindData | null {
  const mag = magRows
    .slice(1)
    .reverse()
    .find(
      (r: any[]) =>
        Array.isArray(r) &&
        Number.isFinite(Number(r[2])) &&
        Number.isFinite(Number(r[3]))
    );

  const plasma = plasmaRows
    .slice(1)
    .reverse()
    .find(
      (r: any[]) =>
        Array.isArray(r) &&
        Number.isFinite(Number(r[1])) &&
        Number.isFinite(Number(r[2]))
    );

  if (!mag || !plasma) return null;

  return {
    density: Number(plasma[1]),
    speed: Number(plasma[2]),
    by: Number(mag[2]),
    bz: Number(mag[3])
  };
}

function resampleCurrentOvation(points: OvationPoint[]) {
  return points
    .map(([lon, lat, aurora]) => ({
      lon,
      lat,
      p: Math.max(0, Math.min(100, Number(aurora)))
    }))
    .filter((b) => b.p > 0);
}

function parseRequestedTimes(url: URL): Date[] {
  const time = url.searchParams.get('time');
  const times = url.searchParams.get('times');

  const parsed: Date[] = [];

  if (time) {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) parsed.push(d);
  }

  if (times) {
    for (const raw of times.split(',')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) parsed.push(d);
    }
  }

  // Deduplicate by ms timestamp
  const unique = new Map<number, Date>();
  for (const d of parsed) unique.set(d.getTime(), d);

  return [...unique.values()].sort((a, b) => a.getTime() - b.getTime());
}

function buildLabel(target: Date, now: Date): string {
  const hoursAhead = (target.getTime() - now.getTime()) / 3_600_000;

  if (Math.abs(hoursAhead) < 1) return 'present';
  if (hoursAhead > 0) return `+${Math.round(hoursAhead)}h`;
  return `${Math.round(hoursAhead)}h`;
}

function buildFrameForTime(args: {
  target: Date;
  now: Date;
  ovation: ReturnType<typeof parseOvation>;
  kpForecasts: { time: string; kp: number }[];
  solarWind: SolarWindData | null;
}): Frame {
  const { target, now, ovation, kpForecasts, solarWind } = args;

  const hoursAhead = (target.getTime() - now.getTime()) / 3_600_000;
  const nearestKp = nearestForecastKp(kpForecasts, target);

  // Use NOAA OVATION only when user is asking for essentially "now".
  if (Math.abs(hoursAhead) < 1) {
    return {
      label: 'present',
      time: ovation.forecastTime || target.toISOString(),
      kp: nearestKp.kp,
      bins: resampleCurrentOvation(ovation.coordinates)
    };
  }

  const adjustedKp = adjustedForecastKp(
    nearestKp.kp,
    solarWind,
    Math.max(0, hoursAhead)
  );

  const decayedSolarWind = decaySolarWindForLead(
    solarWind,
    Math.max(0, hoursAhead)
  );

  return {
    label: buildLabel(target, now),
    time: target.toISOString(),
    kp: adjustedKp,
    bins: makeForecastGrid(adjustedKp, decayedSolarWind, target)
  };
}

export async function GET({ url }) {
  try {
    const requestedTimes = parseRequestedTimes(url);
    const now = new Date();

    const [ovationRes, kpRes, magRes, plasmaRes] = await Promise.all([
      fetch(OVATION_URL),
      fetch(KP_FORECAST_URL),
      fetch(SOLAR_WIND_MAG_URL),
      fetch(SOLAR_WIND_PLASMA_URL)
    ]);

    if (!ovationRes.ok || !kpRes.ok || !magRes.ok || !plasmaRes.ok) {
      return json(
        { error: 'Failed to fetch NOAA upstream data.' },
        { status: 502 }
      );
    }

    const [ovationRaw, kpRaw, magRaw, plasmaRaw] = await Promise.all([
      ovationRes.json(),
      kpRes.json(),
      magRes.json(),
      plasmaRes.json()
    ]);

    const ovation = parseOvation(ovationRaw);
    const kpForecasts = parseKpForecast(kpRaw);
    const solarWind = parseSolarWindData(magRaw, plasmaRaw);

    // Backward-compatible default if no explicit times were requested.
    const defaultTimes =
      requestedTimes.length > 0
        ? requestedTimes
        : [
            now,
            new Date(now.getTime() + 24 * 3_600_000),
            new Date(now.getTime() + 48 * 3_600_000)
          ];

    const frames = defaultTimes.map((target) =>
      buildFrameForTime({
        target,
        now,
        ovation,
        kpForecasts,
        solarWind
      })
    );

    return json({
      model: 'ovation-lite-js-v3',
      createdAt: now.toISOString(),
      requestedTimes: defaultTimes.map((d) => d.toISOString()),
      frames
    });
  } catch (err) {
    return json(
      {
        error: `Aurora forecast failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      },
      { status: 500 }
    );
  }
}