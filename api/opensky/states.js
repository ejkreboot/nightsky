const OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all";

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers.origin;

  if (allowedOrigin) {
    if (requestOrigin && requestOrigin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseBounds(query) {
  const lamin = Number(query.lamin);
  const lomin = Number(query.lomin);
  const lamax = Number(query.lamax);
  const lomax = Number(query.lomax);

  if ([lamin, lomin, lamax, lomax].some(Number.isNaN)) {
    return null;
  }

  return { lamin, lomin, lamax, lomax };
}

async function fetchOpenSkyAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Token response missing access_token");
  }

  return data.access_token;
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Missing OpenSky credentials in environment variables" });
    return;
  }

  const bounds = parseBounds(req.query);
  if (!bounds) {
    res.status(400).json({
      error: "Missing or invalid bbox query parameters",
      expected: ["lamin", "lomin", "lamax", "lomax"],
    });
    return;
  }

  try {
    const accessToken = await fetchOpenSkyAccessToken(clientId, clientSecret);
    const params = new URLSearchParams({
      lamin: String(bounds.lamin),
      lomin: String(bounds.lomin),
      lamax: String(bounds.lamax),
      lomax: String(bounds.lomax),
    });

    const upstreamResponse = await fetch(`${OPENSKY_STATES_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text();
      throw new Error(`OpenSky states request failed (${upstreamResponse.status}): ${text}`);
    }

    const statesPayload = await upstreamResponse.json();

    // Short cache to reduce token churn and upstream pressure.
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
    res.status(200).json(statesPayload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch OpenSky data",
      details: error.message,
    });
  }
};
