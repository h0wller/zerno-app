import crypto from 'node:crypto';
import { Router } from 'express';
import { userGuard } from '../middleware/auth.js';
import { stravaService } from '../services/strava.js';

export const STRAVA_CONSENT_VERSION = '2026-11-14-v1';


const STRAVA_STATE_COOKIE = '__Secure-zerno_strava_state';

function readCookie(req, name) {
  const header = String(req && req.headers && req.headers.cookie || '');
  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(entry.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

export function matchesStravaBrowserState(req, state) {
  const queryState = String(state || '');
  const cookieState = readCookie(req, STRAVA_STATE_COOKIE);
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(queryState) ||
      !cookieState || cookieState.length !== queryState.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookieState), Buffer.from(queryState));
}

function setStravaStateCookie(res, state) {
  res.setHeader(
    'Set-Cookie',
    STRAVA_STATE_COOKIE + '=' + encodeURIComponent(state) +
      '; Max-Age=600; Path=/api/fitness/strava/callback; HttpOnly; Secure; SameSite=Lax',
  );
}

function clearStravaStateCookie(res) {
  res.setHeader(
    'Set-Cookie',
    STRAVA_STATE_COOKIE + '=; Max-Age=0; Path=/api/fitness/strava/callback; HttpOnly; Secure; SameSite=Lax',
  );
}

const CONSENT_NOTICE = {
  version: STRAVA_CONSENT_VERSION,
  provider: 'Strava',
  data: [
    'Идентификатор аккаунта Strava.',
    'Для ваших последних тренировок: ID, название, тип, дистанция, время движения и общее время, дата начала и средняя скорость.',
    'OAuth access token и refresh token для поддержания подключения.',
  ],
  collection: 'Вы сами переходите на сайт Strava, входите в аккаунт и разрешаете Zerno App доступ только activity:read. Тренировки загружаются из Strava по вашему запросу.',
  purpose: 'Показывать список ваших тренировок только вам после входа в ваш профиль Zerno App. Данные Strava не используются для начисления наград, аналитики, рекламы или объединения с историей заказов.',
  storage: 'Токены хранятся в SQLite в зашифрованном AES-256-GCM виде. Список тренировок, маршруты и GPS-координаты не сохраняются и не кэшируются в Zerno App.',
  withdrawal: 'Отключить интеграцию можно в Zerno App через действие «Отключить Strava». Также разрешение можно отозвать в настройках приложений вашего аккаунта Strava.',
  deletion: 'После отключения Zerno App удаляет локальные токены и связь с аккаунтом и отправляет запрос на отзыв токена в Strava. При удалении профиля Zerno App локальная связь также удаляется.',
};

function redirectTarget(env, result) {
  const base = String(env.WEBAPP_URL || env.PUBLIC_URL || '').trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('strava', result);
    return url.toString();
  } catch {
    return null;
  }
}

function routeError(res, error) {
  const code = error && error.code;
  const status = {
    strava_not_configured: 503,
    strava_not_connected: 409,
    strava_reauthorization_required: 401,
    strava_invalid_pagination: 400,
    strava_invalid_state: 400,
    strava_required_scope_missing: 400,
    strava_athlete_already_linked: 409,
    strava_disconnect_previous_account_first: 409,
    strava_missing_authorization_code: 400,
  }[code] || 502;
  return res.status(status).json({
    error: code || 'strava_request_failed',
    message: status === 503
      ? 'Подключение Strava пока не настроено.'
      : status === 401
        ? 'Разрешение Strava отозвано или истекло. Подключите аккаунт заново.'
        : 'Не удалось выполнить запрос Strava. Попробуйте позже.',
  });
}

export function createStravaRouter({
  service = stravaService,
  env = process.env,
} = {}) {
  const router = Router();
  router.use('/api/fitness/strava', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  router.get('/api/fitness/strava/consent', userGuard, (req, res) => {
    res.json({
      enabled: service.getConfigurationStatus().ready,
      notice: CONSENT_NOTICE,
    });
  });

  router.get('/api/fitness/strava/status', userGuard, (req, res) => {
    res.json(service.getStatus(req.user.id));
  });

  router.post('/api/fitness/strava/connect', userGuard, (req, res) => {
    if (req.user.role !== 'guest' || req.user.verified !== 1) {
      return res.status(403).json({ error: 'verified_guest_required' });
    }
    if (req.body?.consent !== true || req.body?.consentVersion !== STRAVA_CONSENT_VERSION) {
      return res.status(400).json({
        error: 'explicit_strava_consent_required',
        consentVersion: STRAVA_CONSENT_VERSION,
      });
    }
    try {
      const authorization = service.createAuthorizationUrl(req.user.id);
      const state = new URL(authorization.url).searchParams.get('state');
      if (!state) return res.status(502).json({ error: 'strava_authorization_state_missing' });
      setStravaStateCookie(res, state);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        authorizationUrl: authorization.url,
        scope: 'activity:read',
        expiresInSeconds: 600,
      });
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.get('/api/fitness/strava/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const state = String(req.query.state || '');
    const browserBound = matchesStravaBrowserState(req, state);
    clearStravaStateCookie(res);
    if (!browserBound) {
      return res.status(400).send('Не удалось подтвердить браузер, начавший подключение Strava. Начните подключение заново.');
    }

    const denied = String(req.query.error || '') === 'access_denied';
    if (denied) {
      try { service.consumeOAuthState(state); } catch {}
      const target = redirectTarget(env, 'denied');
      return target ? res.redirect(303, target) : res.status(200).send('Доступ Strava не предоставлен. Окно можно закрыть.');
    }

    try {
      await service.completeAuthorization({
        state,
        code: req.query.code,
        grantedScope: req.query.scope,
      });
      const target = redirectTarget(env, 'connected');
      return target ? res.redirect(303, target) : res.status(200).send('Strava подключена. Окно можно закрыть.');
    } catch (error) {
      const target = redirectTarget(env, 'error');
      return target ? res.redirect(303, target) : res.status(400).send('Не удалось подключить Strava. Начните подключение заново.');
    }
  });

  router.get('/api/fitness/strava/activities', userGuard, async (req, res) => {
    try {
      const page = req.query.page === undefined ? 1 : Number(req.query.page);
      const perPage = req.query.per_page === undefined ? 10 : Number(req.query.per_page);
      const result = await service.listActivities(req.user.id, { page, perPage });
      return res.json(result);
    } catch (error) {
      return routeError(res, error);
    }
  });

  router.post('/api/fitness/strava/disconnect', userGuard, async (req, res) => {
    try {
      const result = await service.disconnect(req.user.id);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return routeError(res, error);
    }
  });

  // Strava callbacks are protected by a random path secret, then by the registered subscription ID.
  const webhookSecret = String(env.STRAVA_WEBHOOK_PATH_SECRET || '');
  if (/^[A-Za-z0-9_-]{32,128}$/.test(webhookSecret)) {
    const webhookPath = '/api/fitness/strava/webhook/' + webhookSecret;
    router.get(webhookPath, (req, res) => {
      const mode = String(req.query['hub.mode'] || '');
      const challenge = String(req.query['hub.challenge'] || '');
      const verifyToken = String(req.query['hub.verify_token'] || '');
      if (mode !== 'subscribe' || !challenge || !service.verifyWebhookToken(verifyToken)) {
        return res.sendStatus(403);
      }
      return res.json({ 'hub.challenge': challenge });
    });

    router.post(webhookPath, (req, res) => {
      service.handleWebhook(req.body || {});
      return res.sendStatus(200);
    });
  }

  return router;
}
