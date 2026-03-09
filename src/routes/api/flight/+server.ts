import { json, type RequestHandler } from '@sveltejs/kit';

// Flight route data is now provided inline by the /api/aircraft endpoint via Airlabs.
// This endpoint is kept as a stub for backward compatibility.
export const GET: RequestHandler = async () => {
  return json({ error: 'Flight data is now included in the /api/aircraft response' }, { status: 410 });
};
