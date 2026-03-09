import { json, type RequestHandler } from '@sveltejs/kit';
import { AIRLABS_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ url }) => {
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const dist = url.searchParams.get('dist') || '50';
  console.log(`Received aircraft request for lat=${lat}, lon=${lon}, dist=${dist}km`);
  if (!lat || !lon) {
    return json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const distKm = parseFloat(dist);

  if (isNaN(latNum) || isNaN(lonNum) || isNaN(distKm)) {
    return json({ error: 'Invalid numeric parameters' }, { status: 400 });
  }

  // Calculate bounding box from center + distance
  const deltaLat = distKm / 111.32;
  const deltaLon = distKm / (111.32 * Math.cos(latNum * Math.PI / 180));
  const bbox = `${latNum - deltaLat},${lonNum - deltaLon},${latNum + deltaLat},${lonNum + deltaLon}`;

  try {
    const upstream = new URL('https://airlabs.co/api/v9/flights');
    upstream.searchParams.set('api_key', AIRLABS_API_KEY);
    upstream.searchParams.set('bbox', bbox);

    const res = await fetch(upstream.toString());

    if (!res.ok) {
      return json({ error: 'Upstream API error' }, { status: res.status });
    }

    const data = await res.json();

    if (data.error) {
      console.error('Airlabs API error:', data.error);
      return json({ error: data.error.message || 'Airlabs API error' }, { status: 502 });
    }

    // Transform airlabs response to match existing AircraftData interface
    const aircraft = (data.response || []).map((f: Record<string, unknown>) => ({
      hex: f.hex,
      flight: f.flight_icao || f.flight_iata || undefined,
      lat: f.lat,
      lon: f.lng,
      // airlabs alt is meters, convert to feet for alt_baro
      alt_baro: typeof f.alt === 'number' ? Math.round(f.alt * 3.28084) : 0,
      // airlabs speed is km/h, convert to knots for gs
      gs: typeof f.speed === 'number' ? Math.round(f.speed / 1.852) : undefined,
      track: f.dir,
      // Pass through route/airline/aircraft info
      aircraft_icao: f.aircraft_icao || undefined,
      dep_icao: f.dep_icao || undefined,
      dep_iata: f.dep_iata || undefined,
      arr_icao: f.arr_icao || undefined,
      arr_iata: f.arr_iata || undefined,
      airline_icao: f.airline_icao || undefined,
      airline_iata: f.airline_iata || undefined,
      reg_number: f.reg_number || undefined,
      status: f.status || undefined,
    }));

    return json({ ac: aircraft }, {
      headers: { 'Cache-Control': 's-maxage=10' }
    });
  } catch (err) {
    console.error('Aircraft API proxy error:', err);
    return json({ error: 'Failed to fetch aircraft data' }, { status: 500 });
  }
};
