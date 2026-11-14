import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGpxActivity } from '../../server/utils/gpx-activity.js';

function makeGpx(points, extra = '') {
  const trackPoints = points.map(({ lat, lon, time }) =>
    `<trkpt lat="${lat}" lon="${lon}"><time>${time}</time></trkpt>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Zerno test">
      <metadata>${extra}</metadata>
      <trk><trkseg>${trackPoints}</trkseg></trk>
    </gpx>`;
}

function pointsAlongNorth(distancePoints = 60, startTime = '2026-11-14T09:00:00Z') {
  const start = Date.parse(startTime);
  return Array.from({ length: distancePoints }, (_, index) => ({
    lat: 54 + index * 0.001,
    lon: 20,
    time: new Date(start + index * 60_000).toISOString(),
  }));
}

test('parses a timestamped GPX track and returns aggregate metrics without route coordinates', () => {
  const result = parseGpxActivity(makeGpx(pointsAlongNorth()));

  assert.ok(result.distanceMeters > 6_000 && result.distanceMeters < 6_700);
  assert.equal(result.elapsedSeconds, 59 * 60);
  assert.equal(result.pointCount, 60);
  assert.equal(result.startedAt, '2026-11-14T09:00:00.000Z');
  assert.equal('points' in result, false);
  assert.equal('route' in result, false);
});

test('sums track segments without inventing distance across a segment break', () => {
  const start = Date.parse('2026-11-14T09:00:00Z');
  const first = Array.from({ length: 10 }, (_, index) => ({
    lat: 54 + index * 0.001, lon: 20,
    time: new Date(start + index * 60_000).toISOString(),
  }));
  const second = Array.from({ length: 10 }, (_, index) => ({
    lat: 55 + index * 0.001, lon: 21,
    time: new Date(start + (index + 10) * 60_000).toISOString(),
  }));
  const xml = `<gpx><trk>
    <trkseg>${first.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${p.time}</time></trkpt>`).join('')}</trkseg>
    <trkseg>${second.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${p.time}</time></trkpt>`).join('')}</trkseg>
  </trk></gpx>`;

  const result = parseGpxActivity(xml);
  assert.ok(result.distanceMeters < 2_200);
  assert.equal(result.pointCount, 20);
});

test('rejects XML with a DTD or entity declaration before parsing', () => {
  const xml = '<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx></gpx>';
  assert.throws(() => parseGpxActivity(xml), /unsupported XML declaration/i);
});

test('rejects GPX with an invalid coordinate instead of silently skipping the point', () => {
  const xml = makeGpx([
    { lat: 54, lon: 20, time: '2026-11-14T09:00:00Z' },
    { lat: 95, lon: 20, time: '2026-11-14T09:01:00Z' },
  ]);
  assert.throws(() => parseGpxActivity(xml), /invalid track point/i);
});

test('rejects a track with missing or non-increasing timestamps', () => {
  const xml = makeGpx([
    { lat: 54, lon: 20, time: '2026-11-14T09:00:00Z' },
    { lat: 54.001, lon: 20, time: '2026-11-14T09:00:00Z' },
  ]);
  assert.throws(() => parseGpxActivity(xml), /timestamps/i);
});

test('rejects files that exceed the configured byte or point limits', () => {
  assert.throws(() => parseGpxActivity('<gpx>' + 'x'.repeat(100) + '</gpx>', { maxBytes: 20 }), /file is too large/i);
  assert.throws(() => parseGpxActivity(makeGpx(pointsAlongNorth(12)), { maxPoints: 10 }), /too many track points/i);
});

test('rejects XML that is not a GPX document or has no usable track points', () => {
  assert.throws(() => parseGpxActivity('<not-gpx></not-gpx>'), /invalid GPX document/i);
  assert.throws(() => parseGpxActivity('<gpx><trk><trkseg></trkseg></trk></gpx>'), /no usable track points/i);
});
