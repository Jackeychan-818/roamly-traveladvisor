import { env } from "cloudflare:workers";

type RouteStop = {
  id: number;
  latitude: number;
  longitude: number;
};

type OneMapRouteResponse = {
  status?: number;
  status_message?: string;
  route_geometry?: string;
  route_summary?: {
    total_time?: number;
    total_distance?: number;
  };
};

type RouteLeg = {
  fromId: number;
  toId: number;
  durationSeconds: number;
  distanceMeters: number;
  coordinates: [number, number][];
  source: "onemap" | "fallback";
};

type RuntimeEnv = {
  ONEMAP_API_TOKEN?: string;
  ONEMAP_API_EMAIL?: string;
  ONEMAP_API_PASSWORD?: string;
};

class OneMapRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let cachedToken:
  | { value: string; expiresAt: number }
  | undefined;
let tokenRequest: Promise<string> | undefined;

function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

function decodePolyline(
  encoded: string,
  precision = 5,
): [number, number][] {
  const coordinates: [number, number][] = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / factor, latitude / factor]);
  }

  return coordinates;
}

function isValidSingaporeStop(value: unknown): value is RouteStop {
  if (!value || typeof value !== "object") return false;
  const stop = value as Partial<RouteStop>;

  return (
    Number.isInteger(stop.id) &&
    typeof stop.latitude === "number" &&
    Number.isFinite(stop.latitude) &&
    stop.latitude >= 1.15 &&
    stop.latitude <= 1.5 &&
    typeof stop.longitude === "number" &&
    Number.isFinite(stop.longitude) &&
    stop.longitude >= 103.55 &&
    stop.longitude <= 104.15
  );
}

function approximateLeg(from: RouteStop, to: RouteStop): RouteLeg {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const straightDistance =
    2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  const estimatedWalkingDistance = Math.round(straightDistance * 1.25);

  return {
    fromId: from.id,
    toId: to.id,
    distanceMeters: estimatedWalkingDistance,
    durationSeconds: Math.round(estimatedWalkingDistance / 1.25),
    coordinates: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    source: "fallback",
  };
}

async function requestNewToken(): Promise<string> {
  const runtimeEnv = getRuntimeEnv();
  const email = runtimeEnv.ONEMAP_API_EMAIL?.trim();
  const password = runtimeEnv.ONEMAP_API_PASSWORD?.trim();

  if (!email || !password) {
    throw new OneMapRequestError("OneMap credentials are not configured", 503);
  }

  const response = await fetch(
    "https://www.onemap.gov.sg/api/auth/post/getToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  const payload = (await response.json()) as {
    access_token?: string;
    expiry_timestamp?: number;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new OneMapRequestError(
      payload.error || "Unable to authenticate with OneMap",
      response.status,
    );
  }

  const rawExpiry = payload.expiry_timestamp ?? Date.now() + 60 * 60 * 1000;
  const expiryMilliseconds =
    rawExpiry > 10_000_000_000 ? rawExpiry : rawExpiry * 1000;
  cachedToken = {
    value: payload.access_token,
    expiresAt: expiryMilliseconds,
  };

  return payload.access_token;
}

async function getOneMapToken(forceRefresh = false): Promise<string> {
  const runtimeEnv = getRuntimeEnv();
  const configuredToken = runtimeEnv.ONEMAP_API_TOKEN?.trim();

  if (configuredToken && !forceRefresh) return configuredToken;

  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAt > Date.now() + 5 * 60 * 1000
  ) {
    return cachedToken.value;
  }

  if (!tokenRequest) {
    tokenRequest = requestNewToken().finally(() => {
      tokenRequest = undefined;
    });
  }

  return tokenRequest;
}

async function fetchOneMapLeg(
  token: string,
  from: RouteStop,
  to: RouteStop,
): Promise<RouteLeg> {
  const params = new URLSearchParams({
    start: `${from.latitude},${from.longitude}`,
    end: `${to.latitude},${to.longitude}`,
    routeType: "walk",
  });
  const response = await fetch(
    `https://www.onemap.gov.sg/api/public/routingsvc/route?${params}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    },
  );
  const payload = (await response.json()) as OneMapRouteResponse;

  if (
    !response.ok ||
    payload.status !== 0 ||
    !payload.route_geometry ||
    !payload.route_summary
  ) {
    throw new OneMapRequestError(
      payload.status_message || "OneMap could not calculate this walking route",
      response.status,
    );
  }

  const coordinates = decodePolyline(payload.route_geometry);
  if (coordinates.length < 2) {
    throw new OneMapRequestError("OneMap returned an empty route", 502);
  }

  return {
    fromId: from.id,
    toId: to.id,
    durationSeconds: Math.round(payload.route_summary.total_time ?? 0),
    distanceMeters: Math.round(payload.route_summary.total_distance ?? 0),
    coordinates,
    source: "onemap",
  };
}

async function fetchLegs(
  token: string,
  stops: RouteStop[],
): Promise<PromiseSettledResult<RouteLeg>[]> {
  return Promise.allSettled(
    stops.slice(0, -1).map((stop, index) =>
      fetchOneMapLeg(token, stop, stops[index + 1]),
    ),
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { stops?: unknown[] };
    const stops = payload.stops;

    if (
      !Array.isArray(stops) ||
      stops.length < 2 ||
      stops.length > 10 ||
      !stops.every(isValidSingaporeStop)
    ) {
      return Response.json(
        {
          error:
            "Provide between 2 and 10 valid Singapore stops with id, latitude, and longitude.",
        },
        { status: 400 },
      );
    }

    let token = await getOneMapToken();
    let results = await fetchLegs(token, stops);
    const credentialsConfigured = Boolean(
      getRuntimeEnv().ONEMAP_API_EMAIL &&
        getRuntimeEnv().ONEMAP_API_PASSWORD,
    );
    const hasExpiredToken = results.some(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof OneMapRequestError &&
        result.reason.status === 401,
    );

    if (hasExpiredToken && credentialsConfigured) {
      cachedToken = undefined;
      token = await getOneMapToken(true);
      results = await fetchLegs(token, stops);
    }

    const legs = results.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : approximateLeg(stops[index], stops[index + 1]),
    );
    const liveLegCount = legs.filter((leg) => leg.source === "onemap").length;

    if (liveLegCount === 0) {
      return Response.json(
        {
          error: "OneMap could not calculate any of the requested routes.",
          code: "routing_unavailable",
        },
        { status: 502 },
      );
    }

    const coordinates = legs.flatMap((leg, index) =>
      index === 0 ? leg.coordinates : leg.coordinates.slice(1),
    );

    return Response.json({
      provider: "onemap",
      mode: "walk",
      hasFallback: liveLegCount !== legs.length,
      durationSeconds: legs.reduce(
        (total, leg) => total + leg.durationSeconds,
        0,
      ),
      distanceMeters: legs.reduce(
        (total, leg) => total + leg.distanceMeters,
        0,
      ),
      coordinates,
      legs,
    });
  } catch (error) {
    if (error instanceof OneMapRequestError) {
      return Response.json(
        {
          error: error.message,
          code:
            error.status === 503
              ? "routing_not_configured"
              : "routing_unavailable",
        },
        { status: error.status },
      );
    }

    return Response.json(
      { error: "Unable to calculate walking routes." },
      { status: 500 },
    );
  }
}
