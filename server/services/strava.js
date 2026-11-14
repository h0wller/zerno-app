import crypto from 'node:crypto';
import { db as defaultDb } from '../db/connection.js';

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const REVOKE_URL = 'https://www.strava.com/oauth/revoke';
const ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STATE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const REQUIRED_SCOPE = 'activity:read';
const ALLOWED_SCOPES = new Set(['read', REQUIRED_SCOPE]);

function makeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeScopes(value) {
  return new Set(String(value || '').replace(/,/g, ' ').split(/\s+/).filter(Boolean));
}

function hasApprovedScopes(scopes) {
  return scopes.has(REQUIRED_SCOPE) && [...scopes].every(scope => ALLOWED_SCOPES.has(scope));
}

function parseNow(clock) {
  const value = clock();
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('Strava clock must return a valid timestamp');
  return timestamp;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function toActivityView(activity) {
  const id = activity && activity.id;
  const distance = Number(activity && activity.distance);
  const movingTime = Number(activity && activity.moving_time);
  const elapsedTime = Number(activity && activity.elapsed_time);
  const averageSpeed = Number(activity && activity.average_speed);
  const startedAt = String(activity && activity.start_date || '');
  const activityId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    ? String(id)
    : typeof id === 'string' && /^\d{1,24}$/.test(id) && Number(id) > 0 ? id : null;
  if (!activityId ||
      !Number.isFinite(distance) || !Number.isFinite(movingTime) ||
      !Number.isFinite(elapsedTime) || !Number.isFinite(Date.parse(startedAt))) {
    return null;
  }
  return {
    id: activityId,
    name: String(activity.name || '').slice(0, 160),
    type: String(activity.type || ''),
    sportType: String(activity.sport_type || activity.type || ''),
    distanceMeters: distance,
    movingTimeSeconds: movingTime,
    elapsedTimeSeconds: elapsedTime,
    startedAt,
    averageSpeedMetersPerSecond: Number.isFinite(averageSpeed) ? averageSpeed : null,
  };
}

export function createStravaService({
  database = defaultDb,
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = () => new Date(),
  randomBytes = crypto.randomBytes,
} = {}) {
  function nowMs() {
    return parseNow(clock);
  }

  function getConfigurationStatus() {
    const redirect = safeHttpsUrl(env.STRAVA_REDIRECT_URI);
    const callbackPath = '/api/fitness/strava/callback';
    const encryptionKey = String(env.STRAVA_TOKEN_ENCRYPTION_KEY || '');
    const configured = /^\d+$/.test(String(env.STRAVA_CLIENT_ID || '')) &&
      String(env.STRAVA_CLIENT_SECRET || '').length >= 16 &&
      redirect !== null && redirect.pathname === callbackPath && !redirect.search && !redirect.hash &&
      /^[a-f0-9]{64}$/i.test(encryptionKey) &&
      String(env.STRAVA_WEBHOOK_VERIFY_TOKEN || '').length >= 16 &&
      /^[A-Za-z0-9_-]{32,128}$/.test(String(env.STRAVA_WEBHOOK_PATH_SECRET || '')) &&
      /^\d+$/.test(String(env.STRAVA_WEBHOOK_SUBSCRIPTION_ID || '')) &&
      Number(env.STRAVA_WEBHOOK_SUBSCRIPTION_ID) > 0;
    const enabled = env.STRAVA_ENABLED === 'true';
    return { enabled, configured, ready: enabled && configured };
  }

  function requireReady() {
    if (!getConfigurationStatus().ready) throw makeError('strava_not_configured');
  }

  function encryptionKey() {
    const hex = String(env.STRAVA_TOKEN_ENCRYPTION_KEY || '');
    if (!/^[a-f0-9]{64}$/i.test(hex)) throw makeError('strava_encryption_not_configured');
    return Buffer.from(hex, 'hex');
  }

  function encryptToken(value) {
    const iv = randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  function decryptToken(value) {
    const [version, ivText, tagText, bodyText, extra] = String(value || '').split('.');
    if (version !== 'v1' || !ivText || !tagText || !bodyText || extra !== undefined) {
      throw makeError('strava_token_corrupt');
    }
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey(),
        Buffer.from(ivText, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(bodyText, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw makeError('strava_token_decryption_failed');
    }
  }

  async function requestJson(url, options = {}) {
    if (typeof fetchImpl !== 'function') throw makeError('strava_fetch_unavailable');
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw makeError('strava_network_error');
    }
    let payload = null;
    try { payload = await response.json(); } catch {}
    return { response, payload };
  }

  function createAuthorizationUrl(customerId) {
    requireReady();
    const cid = String(customerId || '').trim();
    if (!cid) throw makeError('strava_customer_required');
    const now = nowMs();
    const state = randomBytes(32).toString('base64url');
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    database.transaction(() => {
      database.prepare('DELETE FROM strava_oauth_states WHERE expires_at <= ? OR cid = ?')
        .run(now, cid);
      database.prepare(
        'INSERT INTO strava_oauth_states(state_hash, cid, created_at, expires_at) VALUES(?, ?, ?, ?)',
      ).run(stateHash, cid, now, now + STATE_TTL_MS);
    }).immediate();

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', String(env.STRAVA_CLIENT_ID));
    url.searchParams.set('redirect_uri', String(env.STRAVA_REDIRECT_URI));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('approval_prompt', 'auto');
    url.searchParams.set('scope', REQUIRED_SCOPE);
    url.searchParams.set('state', state);
    return { url: url.toString(), expiresAt: new Date(now + STATE_TTL_MS).toISOString() };
  }

  function consumeOAuthState(state) {
    const rawState = String(state || '');
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(rawState)) throw makeError('strava_invalid_state');
    const digest = crypto.createHash('sha256').update(rawState).digest('hex');
    const now = nowMs();
    return database.transaction(() => {
      const row = database.prepare(
        'SELECT cid, expires_at FROM strava_oauth_states WHERE state_hash = ?',
      ).get(digest);
      database.prepare('DELETE FROM strava_oauth_states WHERE state_hash = ?').run(digest);
      if (!row || row.expires_at <= now) throw makeError('strava_invalid_state');
      return row.cid;
    }).immediate();
  }

  function saveConnection({ customerId, athleteId, accessToken, refreshToken, expiresAt, scopes }) {
    const cid = String(customerId);
    const athlete = String(athleteId);
    const existingAthlete = database.prepare(
      'SELECT cid FROM strava_connections WHERE athlete_id = ?',
    ).get(athlete);
    if (existingAthlete && existingAthlete.cid !== cid) {
      throw makeError('strava_athlete_already_linked');
    }
    const existingCustomer = database.prepare(
      'SELECT athlete_id FROM strava_connections WHERE cid = ?',
    ).get(cid);
    if (existingCustomer && existingCustomer.athlete_id !== athlete) {
      throw makeError('strava_disconnect_previous_account_first');
    }
    const now = new Date(nowMs()).toISOString();
    database.prepare(
      'INSERT INTO strava_connections(cid, athlete_id, access_token_enc, refresh_token_enc, expires_at, scopes, connected_at, updated_at) ' +
      'VALUES(?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(cid) DO UPDATE SET athlete_id=excluded.athlete_id, ' +
      'access_token_enc=excluded.access_token_enc, refresh_token_enc=excluded.refresh_token_enc, ' +
      'expires_at=excluded.expires_at, scopes=excluded.scopes, updated_at=excluded.updated_at',
    ).run(
      cid,
      athlete,
      encryptToken(accessToken),
      encryptToken(refreshToken),
      expiresAt,
      scopes,
      now,
      now,
    );
  }

  async function completeAuthorization({ state, code, grantedScope }) {
    requireReady();
    const customerId = consumeOAuthState(state);
    const authCode = String(code || '').trim();
    if (!authCode || authCode.length > 2048) throw makeError('strava_missing_authorization_code');
    const callbackScopes = normalizeScopes(grantedScope);
    if (!hasApprovedScopes(callbackScopes)) {
      throw makeError('strava_required_scope_missing');
    }

    const body = new URLSearchParams({
      client_id: String(env.STRAVA_CLIENT_ID),
      client_secret: String(env.STRAVA_CLIENT_SECRET),
      code: authCode,
      grant_type: 'authorization_code',
    });
    const { response, payload } = await requestJson(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok || !payload || !payload.access_token || !payload.refresh_token ||
        !payload.athlete || !Number.isSafeInteger(Number(payload.athlete.id)) ||
        Number(payload.athlete.id) <= 0 || !Number.isSafeInteger(Number(payload.expires_at))) {
      throw makeError('strava_token_exchange_failed');
    }
    const tokenScopes = normalizeScopes(payload.scope || grantedScope);
    if (!hasApprovedScopes(tokenScopes)) {
      throw makeError('strava_required_scope_missing');
    }
    saveConnection({
      customerId,
      athleteId: payload.athlete.id,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Number(payload.expires_at),
      scopes: [...tokenScopes].sort().join(' '),
    });
    return { connected: true };
  }

  async function getAccessToken(customerId) {
    const row = database.prepare('SELECT * FROM strava_connections WHERE cid = ?')
      .get(String(customerId || ''));
    if (!row) throw makeError('strava_not_connected');
    const nowSeconds = Math.floor(nowMs() / 1000);
    if (row.expires_at > nowSeconds + 3_600) return decryptToken(row.access_token_enc);

    const refreshToken = decryptToken(row.refresh_token_enc);
    const body = new URLSearchParams({
      client_id: String(env.STRAVA_CLIENT_ID),
      client_secret: String(env.STRAVA_CLIENT_SECRET),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const { response, payload } = await requestJson(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok || !payload || !payload.access_token || !payload.refresh_token ||
        !Number.isSafeInteger(Number(payload.expires_at))) {
      if (response.status === 400 || response.status === 401) {
        database.prepare('DELETE FROM strava_connections WHERE cid = ?').run(String(customerId));
        throw makeError('strava_reauthorization_required');
      }
      throw makeError('strava_token_refresh_failed');
    }
    const scopes = normalizeScopes(payload.scope || row.scopes);
    if (!hasApprovedScopes(scopes)) {
      database.prepare('DELETE FROM strava_connections WHERE cid = ?').run(String(customerId));
      throw makeError('strava_reauthorization_required');
    }
    const updatedAt = new Date(nowMs()).toISOString();
    database.prepare(
      'UPDATE strava_connections SET access_token_enc=?, refresh_token_enc=?, expires_at=?, scopes=?, updated_at=? WHERE cid=?',
    ).run(
      encryptToken(payload.access_token),
      encryptToken(payload.refresh_token),
      Number(payload.expires_at),
      [...scopes].sort().join(' '),
      updatedAt,
      String(customerId),
    );
    return payload.access_token;
  }

  async function listActivities(customerId, { page = 1, perPage = 10 } = {}) {
    requireReady();
    const pageNum = Number(page);
    const pageSize = Number(perPage);
    if (!Number.isSafeInteger(pageNum) || pageNum < 1 || pageNum > 5 ||
        !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 10) {
      throw makeError('strava_invalid_pagination');
    }
    const accessToken = await getAccessToken(customerId);
    const url = new URL(ACTIVITIES_URL);
    url.searchParams.set('page', String(pageNum));
    url.searchParams.set('per_page', String(pageSize));
    const { response, payload } = await requestJson(url, {
      headers: { authorization: 'Bearer ' + accessToken },
    });
    if (response.status === 401) {
      database.prepare('DELETE FROM strava_connections WHERE cid = ?').run(String(customerId));
      throw makeError('strava_reauthorization_required');
    }
    if (!response.ok || !Array.isArray(payload)) throw makeError('strava_activities_unavailable');
    return {
      page: pageNum,
      perPage: pageSize,
      activities: payload.map(toActivityView).filter(Boolean),
    };
  }

  function getStatus(customerId) {
    const { ready } = getConfigurationStatus();
    if (!ready) return { enabled: false, connected: false };
    const row = database.prepare(
      'SELECT scopes, connected_at FROM strava_connections WHERE cid = ?',
    ).get(String(customerId || ''));
    return {
      enabled: true,
      connected: !!row,
      connectedAt: row ? row.connected_at : null,
      scopes: row ? row.scopes.split(' ').filter(Boolean) : [],
    };
  }

  async function disconnect(customerId) {
    const cid = String(customerId || '').trim();
    if (!cid) throw makeError('strava_customer_required');
    const row = database.prepare(
      'SELECT refresh_token_enc FROM strava_connections WHERE cid = ?',
    ).get(cid);
    database.transaction(() => {
      database.prepare('DELETE FROM strava_connections WHERE cid = ?').run(cid);
      database.prepare('DELETE FROM strava_oauth_states WHERE cid = ?').run(cid);
    }).immediate();
    if (!row) return { disconnected: false, revoked: false };

    let refreshToken = null;
    try { refreshToken = decryptToken(row.refresh_token_enc); } catch {}
    if (!refreshToken || !String(env.STRAVA_CLIENT_ID || '') || !String(env.STRAVA_CLIENT_SECRET || '')) {
      return { disconnected: true, revoked: false };
    }
    const authorization = 'Basic ' + Buffer.from(
      String(env.STRAVA_CLIENT_ID) + ':' + String(env.STRAVA_CLIENT_SECRET),
    ).toString('base64');
    try {
      const body = new URLSearchParams({ token: refreshToken, token_type_hint: 'refresh_token' });
      const response = await fetchImpl(REVOKE_URL, {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { disconnected: true, revoked: response.ok };
    } catch {
      return { disconnected: true, revoked: false };
    }
  }

  function handleWebhook(event) {
    const expectedSubscription = Number(env.STRAVA_WEBHOOK_SUBSCRIPTION_ID);
    if (!Number.isSafeInteger(expectedSubscription) || expectedSubscription <= 0 ||
        Number(event && event.subscription_id) !== expectedSubscription) return false;
    if (event.object_type !== 'athlete' || event.aspect_type !== 'update' ||
        !(event.updates && (event.updates.authorized === false || event.updates.authorized === 'false'))) {
      return false;
    }
    const athleteId = Number(event.object_id);
    if (!Number.isSafeInteger(athleteId) || athleteId <= 0) return false;
    return database.prepare('DELETE FROM strava_connections WHERE athlete_id = ?')
      .run(String(athleteId)).changes > 0;
  }

  function verifyWebhookToken(candidate) {
    const expected = String(env.STRAVA_WEBHOOK_VERIFY_TOKEN || '');
    const supplied = String(candidate || '');
    if (expected.length < 16 || supplied.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  }

  return {
    getConfigurationStatus,
    createAuthorizationUrl,
    consumeOAuthState,
    completeAuthorization,
    listActivities,
    getStatus,
    disconnect,
    handleWebhook,
    verifyWebhookToken,
  };
}

export const stravaService = createStravaService();
