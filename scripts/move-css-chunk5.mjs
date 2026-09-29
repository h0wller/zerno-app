// scripts/fix-web-seamless-auth.mjs
// Бесшовная авторизация в обычном браузере через Telegram без повторного ввода PIN
// Запуск из корня проекта: node scripts/fix-web-seamless-auth.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const AUTH_ROUTE = path.resolve('server/routes/auth.js');
const TG_ROUTE = path.resolve('server/routes/tg.js');
const AUTH_CLIENT = path.resolve('public/app/core/auth.js');
const DEEP_CLIENT = path.resolve('public/app/core/deeplink.js');
const SW_FILE = path.resolve('public/sw.js');

const BAK_AR = AUTH_ROUTE + '.bak-seamless-auth';
const BAK_TG = TG_ROUTE + '.bak-seamless-auth';
const BAK_AC = AUTH_CLIENT + '.bak-seamless-auth';
const BAK_DC = DEEP_CLIENT + '.bak-seamless-auth';
const BAK_SW = SW_FILE + '.bak-seamless-auth';

const MARKER = '// [tg-web-seamless-auth-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

const files = [AUTH_ROUTE, TG_ROUTE, AUTH_CLIENT, DEEP_CLIENT, SW_FILE];
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error('Файл не найден: ' + f);
    process.exit(1);
  }
}

const arData = readNorm(AUTH_ROUTE);
const tgData = readNorm(TG_ROUTE);
const acData = readNorm(AUTH_CLIENT);
const dcData = readNorm(DEEP_CLIENT);
const swData = readNorm(SW_FILE);

if (arData.content.indexOf(MARKER) !== -1) {
  console.log('Файлы уже пропатчены (' + MARKER + ').');
  process.exit(0);
}

// ── 1. Патч server/routes/auth.js ──
// Передаем name в otpStore при запросе tg и возвращаем token/customer в check-reg
const FROM_AR_REQ = [
  "  if (via === 'tg') {",
  "    const token = crypto.randomBytes(6).toString('hex');",
  "    otpStore.set('regtg:' + token, { phone: p, expires: Date.now() + 10 * 60 * 1000 });",
  "    otpStore.set('reg:' + p, { code: null, confirmed: false,expires: Date.now() + 10 * 60 * 1000 });",
  "    return res.json({ ok: true, tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${token}` });",
  "  }"
].join('\n');

const TO_AR_REQ = [
  "  if (via === 'tg') {",
  "    const token = crypto.randomBytes(6).toString('hex');",
  "    const reqName = String(req.body.name || '').trim();",
  "    otpStore.set('regtg:' + token, { phone: p, name: reqName, expires: Date.now() + 10 * 60 * 1000 });",
  "    otpStore.set('reg:' + p, { code: null, confirmed: false, expires: Date.now() + 10 * 60 * 1000 });",
  "    return res.json({ ok: true, tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${token}` });",
  "  }"
].join('\n');

if (arData.content.split(FROM_AR_REQ).length - 1 !== 1) {
  console.error('Якорь request-reg-otp не найден в server/routes/auth.js.');
  process.exit(1);
}

const FROM_AR_CHK = [
  "authRouter.get('/api/auth/check-reg', (req, res) => {",
  "  const p = fmtPhone(req.query.phone || '');",
  "  const st = otpStore.get('reg:' + p);",
  "  res.json({ confirmed: !!(st && st.confirmed && Date.now() < st.expires) });",
  "});"
].join('\n');

const TO_AR_CHK = [
  MARKER,
  "authRouter.get('/api/auth/check-reg', (req, res) => {",
  "  const p = fmtPhone(req.query.phone || '');",
  "  const st = otpStore.get('reg:' + p);",
  "  const isOk = !!(st && st.confirmed && Date.now() < st.expires);",
  "  if (isOk && st.token && st.customer) {",
  "    return res.json({ confirmed: true, token: st.token, customer: st.customer });",
  "  }",
  "  res.json({ confirmed: isOk });",
  "});"
].join('\n');

if (arData.content.split(FROM_AR_CHK).length - 1 !== 1) {
  console.error('Якорь check-reg не найден в server/routes/auth.js.');
  process.exit(1);
}

// ── 2. Патч server/routes/tg.js ──
// Импорты issueToken, cust, createCustomer, nowISO
const FROM_TG_IMP = "import { grantWelcome } from '../domain/loyalty.js';";
const TO_TG_IMP = [
  "import { grantWelcome } from '../domain/loyalty.js';",
  "import { cust, addHist, issueToken } from '../domain/helpers.js';",
  "import { createCustomer } from '../domain/customers.js';",
  "import { nowISO } from '../utils/id-time.js';"
].join('\n');

if (tgData.content.split(FROM_TG_IMP).length - 1 !== 1) {
  console.error('Якорь импорта loyalty.js не найден в server/routes/tg.js.');
  process.exit(1);
}

// Запоминаем name в regchat
const FROM_TG_SEC1 = "otpStore.set('regchat:' + chatId, { token, phone: st.phone, expires: Date.now() + 10 * 60 * 1000 });";
const TO_TG_SEC1 = "otpStore.set('regchat:' + chatId, { token, phone: st.phone, name: st.name || '', expires: Date.now() + 10 * 60 * 1000 });";

if (tgData.content.split(FROM_TG_SEC1).length - 1 !== 1) {
  console.error('Якорь regchat не найден в server/routes/tg.js.');
  process.exit(1);
}

// Секция 7: моментальное создание / привязка профиля + ссылка с auth_token
const FROM_TG_SEC7 = [
  "    /* 7. Привязка через contact — сохранённый flow */",
  "    if (u.message.contact) {",
  "      const pend = otpStore.get('regchat:' + chatId);",
  "      if (pend && Date.now() < pend.expires) {",
  "        if (fmtPhone(u.message.contact.phone_number) === fmtPhone(pend.phone)) {",
  "          otpStore.set('reg:' + fmtPhone(pend.phone), { code: null, confirmed: true, tgChat: chatId, expires: Date.now() + 10 * 60 * 1000 });",
  "          otpStore.delete('regchat:' + chatId);",
  "          otpStore.delete('regtg:' + pend.token);",
  "          await tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁', { remove_keyboard: true });",
  "        } else {",
  "          tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');",
  "        }",
  "        return;",
  "      }",
  "    }"
].join('\n');

const TO_TG_SEC7 = [
  "    /* 7. Привязка через contact — сохранённый flow */",
  "    " + MARKER,
  "    if (u.message.contact) {",
  "      const pend = otpStore.get('regchat:' + chatId);",
  "      if (pend && Date.now() < pend.expires) {",
  "        const contactPhone = fmtPhone(u.message.contact.phone_number);",
  "        if (contactPhone === fmtPhone(pend.phone)) {",
  "          let targetCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);",
  "          if (targetCust) {",
  "            db.prepare('UPDATE customers SET tg=?, verified=1 WHERE id=?').run(chatId, targetCust.id);",
  "            if (!targetCust.welcome) grantWelcome(targetCust.id, 'Telegram');",
  "            addHist(targetCust.id, 'Вход через Telegram-подтверждение', 'Telegram');",
  "          } else {",
  "            const tgUserName = [u.message.from?.first_name, u.message.from?.last_name].filter(Boolean).join(' ');",
  "            const newName = pend.name || tgUserName || 'Гость';",
  "            const r = createCustomer(newName, contactPhone, '');",
  "            if (!r.err && r.customer) {",
  "              db.prepare('UPDATE customers SET tg=?, verified=1, consent=? WHERE id=?').run(chatId, nowISO() + ' v1', r.customer.id);",
  "              grantWelcome(r.customer.id, 'Telegram');",
  "              addHist(r.customer.id, 'Регистрация через Telegram', 'Telegram');",
  "            }",
  "          }",
  "",
  "          const finalCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);",
  "          const sessionToken = finalCust ? issueToken(finalCust.id) : null;",
  "          const custObj = finalCust ? cust(finalCust) : null;",
  "",
  "          otpStore.set('reg:' + contactPhone, {",
  "            code: null,",
  "            confirmed: true,",
  "            token: sessionToken,",
  "            customer: custObj,",
  "            tgChat: chatId,",
  "            expires: Date.now() + 10 * 60 * 1000",
  "          });",
  "          otpStore.delete('regchat:' + chatId);",
  "          otpStore.delete('regtg:' + pend.token);",
  "",
  "          await tgSend(chatId, '👍 Номер подтверждён', { remove_keyboard: true });",
  "          const baseSite = (typeof APP_URL !== 'undefined' && APP_URL) || 'https://friday.andcoffee.online';",
  "          const authLink = sessionToken ? (baseSite + '/?auth_token=' + sessionToken) : (baseSite + '/?src=tg');",
  "",
  "          await tgSend(chatId,",
  "            '🎉 <b>Профиль готов, ' + (custObj ? custObj.name : '') + '!</b>\\n\\n' +",
  "            'Ваши приветственные бонусы активированы:\\n' +",
  "            '☕ <b>+1 штамп</b> на кофе у моря\\n' +",
  "            '🍕 <b>Скидка 200 ₽</b> на доставку (промокод <b>ПРИВЕТ</b>)\\n\\n' +",
  "            'В браузере вход выполнился автоматически. Или откройте сайт кнопкой ниже 👇',",
  "            {",
  "              inline_keyboard: [[",
  "                { text: '🚀 Открыть сайт (вход выполнен)', url: authLink }",
  "              ]]",
  "            }",
  "          );",
  "        } else {",
  "          await tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');",
  "        }",
  "        return;",
  "      }",
  "    }"
].join('\n');

if (tgData.content.split(FROM_TG_SEC7).length - 1 !== 1) {
  console.error('Якорь секции 7 не найден в server/routes/tg.js.');
  process.exit(1);
}

// ── 3. Патч public/app/core/auth.js (передача name и моментальный вход по поллингу) ──
const FROM_AC_REG_TG = [
  "    var regTgBtn = document.getElementById('regTgBtn');",
  "    if (regTgBtn) {",
  "      regTgBtn.onclick = async function () {",
  "        var ph = (document.getElementById('regPhone') || {}).value;",
  "        if (ph10(ph).length < 10) return toast('Введите номер полностью', '📵');",
  "        try {",
  "          var r = await api('/auth/request-reg-otp', {",
  "            method: 'POST',",
  "            body: { phone: ph, via: 'tg' }",
  "          });",
  "          window.open(r.tgUrl, '_blank');",
  "          toast('Подтвердите номер в Telegram', '🤖');",
  "",
  "          if (regPoll) clearInterval(regPoll);",
  "          regPoll = setInterval(async function () {",
  "            try {",
  "              var c = await api('/auth/check-reg?phone=' + encodeURIComponent(ph));",
  "              if (c.confirmed) {",
  "                clearInterval(regPoll);",
  "                regPoll = null;",
  "                var row = document.getElementById('regTgRow');",
  "                if (row) row.hidden = false;",
  "                toast('Номер подтверждён через Telegram', '🎉');",
  "              }",
  "            } catch (_) {}",
  "          }, 3000);",
  "        } catch (e) {",
  "          toast(e.message, '⚠️');",
  "        }",
  "      };",
  "    }"
].join('\n');

const TO_AC_REG_TG = [
  "    var regTgBtn = document.getElementById('regTgBtn');",
  "    if (regTgBtn) {",
  "      regTgBtn.onclick = async function () {",
  "        var ph = (document.getElementById('regPhone') || {}).value;",
  "        var nm = ((document.getElementById('regName') || {}).value || '').trim();",
  "        if (ph10(ph).length < 10) return toast('Введите номер полностью', '📵');",
  "        try {",
  "          var r = await api('/auth/request-reg-otp', {",
  "            method: 'POST',",
  "            body: { phone: ph, name: nm, via: 'tg' }",
  "          });",
  "          window.open(r.tgUrl, '_blank');",
  "          toast('Подтвердите номер в Telegram', '🤖');",
  "",
  "          if (regPoll) clearInterval(regPoll);",
  "          regPoll = setInterval(async function () {",
  "            try {",
  "              var c = await api('/auth/check-reg?phone=' + encodeURIComponent(ph));",
  "              if (c && c.confirmed) {",
  "                clearInterval(regPoll);",
  "                regPoll = null;",
  "                if (c.token && c.customer) {",
  "                  setUser(c.token, c.customer);",
  "                  closeAuth();",
  "                  if (typeof renderAll === 'function') renderAll();",
  "                  toast('Добро пожаловать, ' + c.customer.name + '! Бонусы активированы 🎉', '🎁');",
  "                  return;",
  "                }",
  "                var row = document.getElementById('regTgRow');",
  "                if (row) row.hidden = false;",
  "                toast('Номер подтверждён через Telegram', '🎉');",
  "              }",
  "            } catch (_) {}",
  "          }, 2500);",
  "        } catch (e) {",
  "          toast(e.message, '⚠️');",
  "        }",
  "      };",
  "    }"
].join('\n');

if (acData.content.split(FROM_AC_REG_TG).length - 1 !== 1) {
  console.error('Якорь regTgBtn не найден в public/app/core/auth.js.');
  process.exit(1);
}

// ── 4. Патч public/app/core/deeplink.js (авто-логин по ?auth_token=...) ──
const FROM_DC_START = "var QS = new URLSearchParams(location.search);";
const TO_DC_START = [
  "var QS = new URLSearchParams(location.search);",
  "",
  "  " + MARKER,
  "  (function initAuthTokenLogin() {",
  "    var at = QS.get('auth_token');",
  "    if (!at) return;",
  "    var t0 = Date.now(), iv = setInterval(function() {",
  "      if (typeof api === 'function' && typeof setUser === 'function') {",
  "        clearInterval(iv);",
  "        api('/me', { headers: { Authorization: 'Bearer ' + at } })",
  "          .then(function(res) {",
  "            if (res && res.customer) {",
  "              setUser(at, res.customer);",
  "              if (typeof renderAll === 'function') renderAll();",
  "              if (typeof toast === 'function') toast('Вход выполнен! С возвращением, ' + res.customer.name, '👋');",
  "            }",
  "          })",
  "          .catch(function() {});",
  "      }",
  "      if (Date.now() - t0 > 4000) clearInterval(iv);",
  "    }, 150);",
  "  })();"
].join('\n');

if (dcData.content.split(FROM_DC_START).length - 1 !== 1) {
  console.error('Якорь QS не найден в public/app/core/deeplink.js.');
  process.exit(1);
}

// ── 5. Инкремент STATIC_CACHE в public/sw.js ──
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (!swMatch) {
  console.error('Не найден токен STATIC_CACHE в public/sw.js.');
  process.exit(1);
}
const oldVer = swMatch[0];
const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
const patchedSw = swData.content.replace(oldVer, newVer);

// ── Применение замен и бэкапы ──
fs.writeFileSync(BAK_AR, arData.raw, 'utf8');
let patchedAr = arData.content.split(FROM_AR_REQ).join(TO_AR_REQ);
patchedAr = patchedAr.split(FROM_AR_CHK).join(TO_AR_CHK);
writeNorm(AUTH_ROUTE, patchedAr, arData.isCRLF);

fs.writeFileSync(BAK_TG, tgData.raw, 'utf8');
let patchedTg = tgData.content.split(FROM_TG_IMP).join(TO_TG_IMP);
patchedTg = patchedTg.split(FROM_TG_SEC1).join(TO_TG_SEC1);
patchedTg = patchedTg.split(FROM_TG_SEC7).join(TO_TG_SEC7);
writeNorm(TG_ROUTE, patchedTg, tgData.isCRLF);

fs.writeFileSync(BAK_AC, acData.raw, 'utf8');
const patchedAc = acData.content.split(FROM_AC_REG_TG).join(TO_AC_REG_TG);
writeNorm(AUTH_CLIENT, patchedAc, acData.isCRLF);

fs.writeFileSync(BAK_DC, dcData.raw, 'utf8');
const patchedDc = dcData.content.split(FROM_DC_START).join(TO_DC_START);
writeNorm(DEEP_CLIENT, patchedDc, dcData.isCRLF);

fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
writeNorm(SW_FILE, patchedSw, swData.isCRLF);

// ── Проверка синтаксиса всех затронутых файлов ──
try {
  execSync('node --check ' + AUTH_ROUTE, { stdio: 'pipe' });
  execSync('node --check ' + TG_ROUTE, { stdio: 'pipe' });
  execSync('node --check ' + AUTH_CLIENT, { stdio: 'pipe' });
  execSync('node --check ' + DEEP_CLIENT, { stdio: 'pipe' });
  execSync('node --check ' + SW_FILE, { stdio: 'pipe' });
  console.log('Синтаксис всех файлов корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(AUTH_ROUTE, arData.raw, 'utf8');
  fs.writeFileSync(TG_ROUTE, tgData.raw, 'utf8');
  fs.writeFileSync(AUTH_CLIENT, acData.raw, 'utf8');
  fs.writeFileSync(DEEP_CLIENT, dcData.raw, 'utf8');
  fs.writeFileSync(SW_FILE, swData.raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: бесшовный вход через Telegram внедрён.');
console.log('SW кэш обновлён: ' + oldVer + ' → ' + newVer);