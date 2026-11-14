const EARTH_RADIUS_METERS = 6_371_008.8;
const DEFAULT_MAX_BYTES = 1_048_576;
const DEFAULT_MAX_POINTS = 20_000;

function fail(message) {
  throw new Error(message);
}

function attribute(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp('(?:^|\\s)' + escaped + '\\s*=\\s*(["\\'])(.*?)\\1', 'i'));
  return match ? match[2] : null;
}

function radians(value) {
  return value * Math.PI / 180;
}

function haversineMeters(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Parse the limited GPX track subset needed by the fitness pilot.
 * Raw coordinates are used only during parsing and are never returned or persisted.
 */
export function parseGpxActivity(xml, {
  maxBytes = DEFAULT_MAX_BYTES,
  maxPoints = DEFAULT_MAX_POINTS,
} = {}) {
  if (typeof xml !== 'string' || !xml.trim()) fail('Invalid GPX document');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
      Buffer.byteLength(xml, 'utf8') > maxBytes) {
    fail('GPX file is too large');
  }
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 10) {
    fail('Invalid track point limit');
  }
  if (/<!\\s*(?:DOCTYPE|ENTITY)\\b/i.test(xml)) {
    fail('Unsupported XML declaration');
  }
  if (!/<gpx\\b[^>]*>/i.test(xml) || !/<\\/gpx\\s*>/i.test(xml)) {
    fail('Invalid GPX document');
  }

  const segments = [...xml.matchAll(/<trkseg\\b[^>]*>([\\s\\S]*?)<\\/trkseg\\s*>/gi)];
  if (segments.length === 0) fail('No usable track points');

  let pointCount = 0;
  let distanceMeters = 0;
  let firstTimestamp = Infinity;
  let lastTimestamp = -Infinity;

  for (const segment of segments) {
    const body = segment[1];
    const points = [...body.matchAll(/<trkpt\\b([^>]*)>([\\s\\S]*?)<\\/trkpt\\s*>/gi)];
    const declaredPoints = (body.match(/<trkpt\\b/gi) || []).length;
    if (declaredPoints !== points.length) fail('Invalid track point');

    let previous = null;
    for (const match of points) {
      pointCount += 1;
      if (pointCount > maxPoints) fail('Too many track points');

      const latRaw = attribute(match[1], 'lat');
      const lonRaw = attribute(match[1], 'lon');
      const lat = Number(latRaw);
      const lon = Number(lonRaw);
      if (latRaw === null || lonRaw === null ||
          !Number.isFinite(lat) || !Number.isFinite(lon) ||
          lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        fail('Invalid track point');
      }

      const timeMatch = match[2].match(/<time\\b[^>]*>([\\s\\S]*?)<\\/time\\s*>/i);
      const timeText = timeMatch ? timeMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const timestamp = Date.parse(timeText);
      if (!timeText || !Number.isFinite(timestamp)) fail('Invalid track timestamps');

      const point = { lat, lon, timestamp };
      if (previous) {
        const deltaSeconds = (timestamp - previous.timestamp) / 1000;
        if (deltaSeconds <= 0) fail('Track timestamps must be strictly increasing');
        const legMeters = haversineMeters(previous, point);
        if (!Number.isFinite(legMeters) || legMeters / deltaSeconds > 20) {
          fail('Implausible GPS point interval');
        }
        distanceMeters += legMeters;
      }
      previous = point;
      firstTimestamp = Math.min(firstTimestamp, timestamp);
      lastTimestamp = Math.max(lastTimestamp, timestamp);
    }
  }

  if (pointCount < 10 || !Number.isFinite(distanceMeters) || distanceMeters <= 0 ||
      !Number.isFinite(firstTimestamp) || lastTimestamp <= firstTimestamp) {
    fail('No usable track points');
  }

  return {
    distanceMeters: Math.round(distanceMeters),
    elapsedSeconds: Math.round((lastTimestamp - firstTimestamp) / 1000),
    startedAt: new Date(firstTimestamp).toISOString(),
    pointCount,
  };
}
