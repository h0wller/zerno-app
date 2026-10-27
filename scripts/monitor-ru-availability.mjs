// scripts/monitor-ru-availability.mjs
// Проверка доступности friday.andcoffee.online из РФ через Check-Host.
// Если все российские ноды не получили 200, шлёт алерт в Telegram админу.
// Запуск: node --env-file=/var/www/app/.env scripts/monitor-ru-availability.mjs
// Переменные: TG_BOT_TOKEN или TELEGRAM_BOT_TOKEN, TG_ADMIN_CHAT_ID.
// Подробности и cron: docs/network-incident-runbook.md

const TARGET_URL = 'https://friday.andcoffee.online';
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TG_ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID;

async function sendTelegramAlert(text) {
  if (!TG_BOT_TOKEN || !TG_ADMIN_CHAT_ID) {
    console.error('[MONITOR] Токен бота или TG_ADMIN_CHAT_ID не заданы в окружении');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_ADMIN_CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[MONITOR] Ошибка отправки в Telegram:', err.message);
  }
}

async function checkViaCheckHost() {
  console.log(`[MONITOR] Проверка доступности из РФ: ${TARGET_URL}`);
  try {
    const initRes = await fetch(
      `https://check-host.net/check-http?host=${encodeURIComponent(TARGET_URL)}&max_nodes=4`,
      { headers: { Accept: 'application/json' } }
    );
    const { request_id: requestId } = await initRes.json();
    if (!requestId) {
      console.error('[MONITOR] Не удалось получить request_id от Check-Host');
      return;
    }

    // Даём распределённым нодам время выполнить проверку.
    await new Promise((r) => setTimeout(r, 12000));

    const resRes = await fetch(`https://check-host.net/check-result/${requestId}`, {
      headers: { Accept: 'application/json' },
    });
    const results = await resRes.json();

    let ruNodesChecked = 0;
    let ruFailures = 0;
    const failureDetails = [];

    for (const [node, checks] of Object.entries(results)) {
      if (!node.startsWith('ru') || !Array.isArray(checks) || checks.length === 0) continue;
      ruNodesChecked++;
      const check = checks[0]; // [ok, time, message, code, address]
      const isOk = check[0] === 1 && check[3] === '200';
      if (!isOk) {
        ruFailures++;
        failureDetails.push(`Нода ${node}: статус=${check[3] || 'ERR'}, сообщение=${check[2] || 'RST/Timeout'}`);
      }
    }

    console.log(`[MONITOR] Проверено нод в РФ: ${ruNodesChecked}, сбоев: ${ruFailures}`);

    if (ruNodesChecked > 0 && ruFailures >= ruNodesChecked) {
      const alertMsg =
        `🚨 <b>ВНИМАНИЕ: Сбой доступности friday.andcoffee.online из РФ!</b>\n\n` +
        `Все проверенные российские ноды (${ruNodesChecked}) зафиксировали ошибку соединения.\n` +
        `Возможна блокировка подсети ТСПУ!\n\n` +
        `<b>Детали:</b>\n${failureDetails.join('\n')}\n\n` +
        `<i>Инструкция: docs/network-incident-runbook.md</i>`;
      console.warn('[MONITOR] Сбой в РФ, отправляю уведомление');
      await sendTelegramAlert(alertMsg);
    } else {
      console.log('[MONITOR] Доступность из РФ в норме');
    }
  } catch (err) {
    console.error('[MONITOR] Ошибка при вызове API Check-Host:', err.message);
  }
}

checkViaCheckHost();
