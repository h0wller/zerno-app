import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesStravaBrowserState } from '../../server/routes/fitness-strava.js';

const STATE = 'a'.repeat(43);

test('Strava callback requires the same short-lived browser cookie that started OAuth', () => {
  const request = cookie => ({ headers: cookie ? { cookie } : {} });

  assert.equal(matchesStravaBrowserState(
    request('__Secure-zerno_strava_state=' + STATE),
    STATE,
  ), true);
  assert.equal(matchesStravaBrowserState(request(undefined), STATE), false);
  assert.equal(matchesStravaBrowserState(
    request('__Secure-zerno_strava_state=' + 'b'.repeat(43)),
    STATE,
  ), false);
  assert.equal(matchesStravaBrowserState(
    request('__Secure-zerno_strava_state=' + STATE),
    'invalid',
  ), false);
});

test('Strava browser-state cookie parser decodes values and ignores similarly named cookies', () => {
  const state = 'a'.repeat(32) + '_-';
  const cookie = 'other=value; __Secure-zerno_strava_state=' +
    encodeURIComponent(state) + '; another=entry';

  assert.equal(matchesStravaBrowserState({ headers: { cookie } }, state), true);
  assert.equal(matchesStravaBrowserState({
    headers: { cookie: '__Secure-zerno_strava_state=' + state + 'x' },
  }, state), false);
});
