
# Runbook & Post-Mortem: Восстановление доступности friday.andcoffee.online при блокировках ТСПУ

**Дата инцидента:** 9 октября 2026 г.  
**Сервис:** PWA и витрина «Пятница × …и кофе» (`friday.andcoffee.online`)  
**Статус:** Решено (замена публичного IPv4 + прямое DNS-делегирование)

---

## 1. Что произошло (Анатомия сбоя)

Пользователи мобильного интернета в РФ (МТС, Tele2, Мегафон) не могли открыть сервис: браузер выдавал `ERR_CONNECTION_RESET` / `curl (56) Recv failure: Connection was reset`. Через VPN ресурс открывался штатно.

### Коренная причина (Root Cause)
1. **Блокировка зарубежной подсети:** Европейский пул дата-центра Timeweb в Амстердаме (`129.101.120.0/24`), где размещался VPS, попал под веерную фильтрацию ТСПУ в РФ. Соединение принудительно разрывалось пакетом `TCP RST` в момент передачи первого L7-пакета (HTTP-запрос / TLS ClientHello).
2. **Неработоспособность промежуточного CDN:** Московский Anycast-узел Gcore (`92.223.84.84`), через который настраивалось резервирование, на момент инцидента также фильтровался ТСПУ мобильных операторов.

### Опровергнутые гипотезы
* **Telegram WebApp SDK и внешние ссылки:** Фильтр сбрасывал голый IP до передачи HTML-разметки. Библиотеки и ссылки на соцсети не являлись причиной блокировки.
* **Сбой Nginx / SSL:** Nginx и сертификаты Let's Encrypt работали штатно. Ошибка происходила на транспортном уровне провайдера.
* **Кэш Service Worker:** Ошибки кэша в Safari были вторичными — следствием отсутствия сетевых ответов от заблокированного узла.

---

## 2. Экспресс-диагностика за 30 секунд

Тестирование выполняется с компьютера/терминала **строго БЕЗ VPN**:

1. **Проверка IP-адреса хостинга напрямую:**
   ```bash
   curl -4 -Iv http://ТЕКУЩИЙ_IP_СЕРВЕРА

 * Норма: Ответ 301 Moved Permanently или заголовки Nginx.
 * Блокировка ТСПУ: Established connection, затем сразу Recv failure: Connection was reset. Требуется немедленная смена IP.
 * Проверка домена и TLS-хэндшейка:
   curl -4 -Iv [https://friday.andcoffee.online](https://friday.andcoffee.online)

   * Норма: Ответ HTTP/2 200 с валидным SSL.
   * Сбой при чистом IP: Зависший DNS-кэш у оператора или блокировка по SNI.
 * Проверка резолвинга через Check-Host:
   Открыть https://check-host.net/check-dns?host=friday.andcoffee.online — российские узлы должны возвращать актуальный A-IP сервера.
3. Регламент действий при повторении блокировки
Шаг 1. Замена публичного IP в панели Timeweb Cloud (2 минуты)
 * Открыть панель Timeweb → сервер fridayAndCofee → раздел «Сеть».
 * В строке текущего IPv4 нажать на меню ... → выбрать «Отвязать».
 * Обязательно отметить чекбокс: «Удалить IP-адрес с аккаунта после отвязки» и подтвердить действие.
 * Нажать кнопку «Добавить» → выбрать публичный IPv4. Сервер автоматически получит новый случайный IP из пула Амстердама.
Шаг 2. Экспресс-тест нового IP
В терминале без VPN:
curl -Iv http://НОВЫЙ_IP

Убедиться в отсутствии сброса Connection was reset.
Шаг 3. Обновление DNS в Cloudflare
 * Открыть панель Cloudflare → зона andcoffee.online → вкладка DNS.
 * Отредактировать запись friday:
   * Type: A
   * Name: friday
   * IPv4 address: НОВЫЙ_IP
   * Proxy status: DNS Only (серое облако) — обязательное требование для стабильной работы в РФ.
   * TTL: Auto
 * Сохранить.
Шаг 4. Сброс DNS-кэша на клиентах
Мобильные операторы РФ могут кэшировать DNS до 30–60 минут.
 * Для мгновенной проверки работоспособности: открыть https://НОВЫЙ_IP напрямую.
 * На iOS-устройствах для сброса демона mDNSResponder: выполнить полную перезагрузку устройства (выключить и включить питание).
4. Долгосрочное решение
При регулярном попадании пулов Амстердама под фильтры ТСПУ — выполнить миграцию VPS в российскую зону Timeweb (Санкт-Петербург SPB-3 или Москва MSK-1):
 * Внутрироссийский трафик не пересекает границу РФ и не фильтруется ТСПУ.
 * Доступ из-под VPN сохраняется при выключенной опции «Геоблокировка» в панели хостинга.

---

### 2. Скрипт автоматического мониторинга из РФ: `scripts/monitor-ru-availability.mjs`

Скрипт, запущенный локально на сервере в Амстердаме, **не может проверить блокировку ТСПУ через обычный `fetch`**, потому что сам сервер всегда имеет доступ к себе. 

Скрипт ниже использует бесплатный публичный API сервиса **Check-Host**: он каждые N минут запускает проверку сайта через реальные серверы в **Москве и Санкт-Петербурге** и при сбросе TCP-сессии или падении сайта мгновенно присылает сообщение в Telegram.

Создай файл `scripts/monitor-ru-availability.mjs`:

```javascript
import { config } from 'dotenv';
config();

const TARGET_URL = 'https://friday.andcoffee.online';
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TG_ADMIN_CHAT_ID = process.env.TG_ADMIN_CHAT_ID; // Твой Telegram ID

async function sendTelegramAlert(text) {
  if (!TG_BOT_TOKEN || !TG_ADMIN_CHAT_ID) {
    console.error('[MONITOR] Токен бота или Chat ID не заданы в .env');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_ADMIN_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('[MONITOR] Ошибка отправки в Telegram:', err.message);
  }
}

async function checkViaCheckHost() {
  console.log(`[MONITOR] Запуск проверки доступности из РФ для ${TARGET_URL}...`);
  try {
    // 1. Инициируем HTTP-проверку на Check-Host
    const initRes = await fetch(
      `https://check-host.net/check-http?host=${encodeURIComponent(TARGET_URL)}&max_nodes=4`,
      { headers: { Accept: 'application/json' } }
    );
    const initData = await initRes.json();
    const requestId = initData.request_id;

    if (!requestId) {
      console.error('[MONITOR] Не удалось получить request_id от Check-Host');
      return;
    }

    // 2. Ждем 12 секунд выполнения проверок распределенными нодами
    await new Promise((r) => setTimeout(r, 12000));

    // 3. Забираем результаты
    const resRes = await fetch(`https://check-host.net/check-result/${requestId}`, {
      headers: { Accept: 'application/json' }
    });
    const results = await resRes.json();

    let ruNodesChecked = 0;
    let ruFailures = 0;
    let failureDetails = [];

    for (const [node, checks] of Object.entries(results)) {
      // Фильтруем ноды, находящиеся в РФ (ru1.node..., ru2.node...)
      if (node.startsWith('ru') && Array.isArray(checks) && checks.length > 0) {
        ruNodesChecked++;
        const check = checks[0]; // [ok, time, message, code, address]
        const isOk = check[0] === 1 && check[3] === '200';

        if (!isOk) {
          ruFailures++;
          failureDetails.push(`Нода ${node}: статус=${check[3] || 'ERR'}, сообщение=${check[2] || 'RST/Timeout'}`);
        }
      }
    }

    console.log(`[MONITOR] Проверено нод в РФ: ${ruNodesChecked}, сбоев: ${ruFailures}`);

    if (ruNodesChecked > 0 && ruFailures >= ruNodesChecked) {
      const alertMsg = 
        `🚨 <b>ВНИМАНИЕ: Сбой доступности friday.andcoffee.online из РФ!</b>\n\n` +
        `Все проверенные российские ноды (${ruNodesChecked}) зафиксировали ошибку соединения.\n` +
        `Возможна блокировка подсети ТСПУ!\n\n` +
        `<b>Детали:</b>\n${failureDetails.join('\n')}\n\n` +
        `<i>Инструкция по замене IP: docs/network-incident-runbook.md</i>`;
      
      console.warn('[MONITOR] Фиксация падения в РФ! Отправка уведомления...');
      await sendTelegramAlert(alertMsg);
    } else {
      console.log('[MONITOR] Доступность из РФ в норме.');
    }
  } catch (err) {
    console.error('[MONITOR] Ошибка при вызове API Check-Host:', err.message);
  }
}

checkViaCheckHost();

3. Как подключить запуск мониторинга
 * В .env на сервере добавь ID администратора для уведомлений (если ещё нет):
   TG_ADMIN_CHAT_ID=твой_telegram_id

 * Проверь разовый запуск скрипта на сервере:
   node scripts/monitor-ru-availability.mjs

 * Добавь вызов проверки каждые 15 минут в системный crontab:
   crontab -e

   Вставь строку в конец файла:
   */15 * * * * cd /var/www/zerno-app && /usr/bin/node scripts/monitor-ru-availability.mjs >> /var/log/ru-monitor.log 2>&1

