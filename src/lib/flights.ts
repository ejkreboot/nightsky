export interface FlightData {
  origin: { iata?: string; icao?: string; name?: string };
  destination: { iata?: string; icao?: string; name?: string };
  aircraft?: { icaoType?: string };
  timestamp: number;
}

const flightDataCache: Record<string, FlightData> = {};
const CACHE_TTL = 300000; // 5 minutes

export function getCachedFlightData(hex: string): FlightData | undefined {
  const cached = flightDataCache[hex];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached;
  }
  return undefined;
}

export async function fetchFlightData(callsign: string, hex: string): Promise<FlightData | null> {
  // Check cache first
  const cached = getCachedFlightData(hex);
  if (cached) return cached;

  if (!callsign || !hex) return null;

  const url = `/api/flight?callsign=${encodeURIComponent(callsign.trim())}&hex=${encodeURIComponent(hex)}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data && data.origin && data.destination) {
      const flightData: FlightData = {
        origin: data.origin,
        destination: data.destination,
        aircraft: data.aircraft,
        timestamp: Date.now()
      };
      flightDataCache[hex] = flightData;
      return flightData;
    }
    return null;
  } catch (err) {
    console.error('Flight data fetch error:', err);
    return null;
  }
}
