# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-support.spec.js >> поддержка из бота: оверлей появляется и НЕ исчезает
- Location: tests\chat-support.spec.js:8:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#supportChooseOverlay')
Expected: visible
Timeout: 6000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('#supportChooseOverlay') with timeout 6000ms
  - waiting for locator('#supportChooseOverlay')

```

```yaml
- banner:
  - img
  - text: …и кофе кофейня на берегу моря
  - button "🌊 Кофейня"
  - button "🍕 Пятница"
  - text: 22:35
  - button "?"
- navigation:
  - button "☕ Кофе"
  - button "🧋 Напитки"
  - button "🌊 Сезонное"
  - button "🥐 Еда"
  - button "🍰 Десерты"
  - button "🛍 С полки"
- heading "Меню на берегу моря" [level=1]:
  - text: Меню
  - emphasis: на берегу моря
- text: Обновлено 10 сентября в 22:35 🔍
- textbox "Найти в меню…"
- article:
  - text: ⚡
  - heading "Эспрессо" [level=3]
  - text: 40 мл чистой честности. Без молока и компромиссов эспрессо 40 мл 200 ₽
- article:
  - text: ☕
  - heading "Американо" [level=3]
  - text: Для тех, кто любит «просто кофе». Держит до вечера эспрессо вода 200 мл 240 ₽
- article:
  - text: 🫖
  - heading "Батч брю" [level=3]
  - text: Заварили с любовью. Кислит, сладит, живёт фильтр-кофе 200 / 300 мл 220 ₽ / 260 ₽
- article:
  - text: ☕
  - heading "Флэт уайт" [level=3]
  - text: Двойной эспрессо в бархатной накидке двойной эспрессо молоко 180 мл 280 ₽
- article:
  - text: ☕ Хит
  - heading "Капучино" [level=3]
  - text: Классика, за которой возвращаются. Пенка — хоть рисуй эспрессо молоко 200 / 300 мл 250 ₽ / 340 ₽
- article:
  - text: 🥛
  - heading "Латте" [level=3]
  - text: Мягкий и тёплый, как объятие. Только вкуснее эспрессо молоко 300 / 400 мл 310 ₽ / 360 ₽
- article:
  - text: 🍦
  - heading "Раф" [level=3]
  - text: Сливочный, сладкий, затягивает. Мы никому не расскажем эспрессо сливки ванильный сахар 300 / 400 мл 360 ₽ / 400 ₽
- complementary:
  - button "Бонусы"
  - button "Профиль"
  - text: 🎁 Копите на бесплатный кофе
  - paragraph: Каждый 10-й кофе — за наш счёт. Создайте профиль по номеру телефона — штампы начисляет кассир.
  - button "Создать профиль"
- button "Чат поддержки":
  - img
- region "Чат поддержки":
  - text: 🌊 Ника · поддержка онлайн, отвечает ~1 мин
  - button "Закрыть": ✕
  - text: У вас вопрос по кофе или доставке? Выберите тему обращения — откроется нужная Ника, а вызов сотрудника уйдёт правильной команде.
  - button "🍕 Доставка Пятница"
  - button "☕ Кофейня …и кофе"
  - textbox "Напишите сообщение…"
  - button "Отправить":
    - img
- button "✕"
- heading "Позиция меню" [level=3]
- text: Изменения сразу видны гостям в меню Название
- textbox "Название":
  - /placeholder: Капучино
- text: Категория
- combobox "Категория":
  - option "☕ Кофе" [selected]
  - option "🧋 Напитки"
  - option "🌊 Сезонное"
  - option "🥐 Еда"
  - option "🍰 Десерты"
  - option "🛍 С полки"
- text: Цена, ₽
- spinbutton "Цена, ₽"
- text: Объём / выход
- textbox "Объём / выход":
  - /placeholder: 300 мл
- text: Эмодзи-фолбэк
- textbox "Эмодзи-фолбэк":
  - /placeholder: ☕
- text: Описание
- textbox "Описание":
  - /placeholder: Коротко и с характером
- text: Состав — через запятую, покажем чипсами
- textbox "Состав — через запятую, покажем чипсами":
  - /placeholder: эспрессо, молоко
- text: Метка
- combobox "Метка":
  - option "без метки" [selected]
  - option "Хит"
  - option "New"
  - option "Vegan"
- checkbox "Считать в бонусах (это кофе)"
- text: Считать в бонусах (это кофе)
- checkbox "Показывать в меню (снять = стоп-лист)" [checked]
- text: Показывать в меню (снять = стоп-лист)
- button "Сохранить"
- button "⧉"
- button "🗑"
- img
- heading "Создайте профиль" [level=3]
- text: Штампы и бесплатные кофе — по номеру телефона. Никаких карт и анкет. Имя
- textbox "Имя":
  - /placeholder: Как к вам обращаться?
- text: Телефон
- textbox "Телефон":
  - /placeholder: +7 900 000-00-00
- button "🤖 Подтвердить в Telegram · бесплатно"
- text: Нет Telegram? Создайте профиль — кассир назовёт код активации, а +1 штамп ждёт в Telegram 🎁 PIN-код (4 цифры)
- textbox "PIN-код (4 цифры)":
  - /placeholder: Например 2580
- text: PIN защищает ваш профиль — без него никто не войдёт, даже зная номер
- button "Создать профиль"
- text: Уже есть профиль?
- button "Войти по номеру"
- button "✕"
- heading "Код доступа" [level=3]
- text: Введите код, который выдал владелец кофейни. Вкладки «Кассир» и «Админ» открываются только сотрудникам.
- textbox "••••"
- button "Активировать"
- text: После 5 ошибок — пауза, растущая вдвое
- button "✕"
- heading "Придумайте PIN" [level=3]
- text: 4 цифры — вы будете вводить их при входе. Без PIN никто не сможет войти в ваш профиль.
- textbox "••••"
- button "Сохранить PIN"
- button "🔑 Не помню PIN — код в Telegram"
- button "✕"
- text: Покажите кассиру — — Нажмите в любом месте, чтобы закрыть
- button "✕"
- heading "Промокоды и акции" [level=3]
- text: Гость активирует код в «Бонусах» → «Есть промокод?» Код
- 'textbox "Код Латиницей, без пробелов. Например: MORE10, SEA5"':
  - /placeholder: MORE10
- text: "Латиницей, без пробелов. Например: MORE10, SEA5 Тип"
- combobox "Тип «Штампы» — начислит N штампов. «Кофе» — сразу даст подарок":
  - option "Штампы (кофейня)" [selected]
  - option "Бесплатный кофе (кофейня)"
  - option "Скидка % (доставка)"
  - option "Скидка ₽ (доставка)"
- text: «Штампы» — начислит N штампов. «Кофе» — сразу даст подарок Кол-во
- 'spinbutton "Кол-во Сколько даст код: штампов или бесплатных кофе"': "1"
- text: "Сколько даст код: штампов или бесплатных кофе Дней"
- spinbutton "Дней 0 — бессрочно. Иначе сгорит через N дней": "0"
- text: 0 — бессрочно. Иначе сгорит через N дней Лимит
- spinbutton "Лимит 0 — без лимита. Иначе — всего N активаций на всех": "0"
- text: 0 — без лимита. Иначе — всего N активаций на всех
- button "Создать промокод"
- heading "Список кодов" [level=4]
- heading "🍕 Пятничный подарок (доставка)" [level=4]
- text: Текст акции для гостей
- textbox "Текст акции для гостей":
  - /placeholder: Каждые 2000 ₽ в чеке — бутылка пива в подарок 🍺
- text: Порог, ₽ (0 = подарок к каждому заказу)
- spinbutton "Порог, ₽ (0 = подарок к каждому заказу)": "0"
- text: Подарок (пусто = только текст)
- textbox "Подарок (пусто = только текст)":
  - /placeholder: Пиво 0.5
- text: Действует до
- textbox "Действует до"
- checkbox "Отправить пуш всем при сохранении"
- text: Отправить пуш всем при сохранении
- button "Сохранить пятничный подарок"
- heading "🍕 Пицца месяца" [level=4]
- text: Название подарочной (30 см, тонкое)
- textbox "Название подарочной (30 см, тонкое)":
  - /placeholder: Маргарита
- checkbox "Акция «2 пиццы 35 см → подарок» включена"
- text: Акция «2 пиццы 35 см → подарок» включена
- button "Сохранить пиццу месяца"
- button "✕"
- heading "Дашборд владельца" [level=3]
- text: Живая статистика лояльности · …и кофе
- heading "Штампы за 14 дней" [level=4]
- heading "Пуш всем гостям" [level=4]
- heading "Кто подписан на пуши" [level=4]
- text: Текст акции
- textbox "Текст акции":
  - /placeholder: "Например: сегодня до 12:00 капучино −20%"
- button "🔔 Отправить"
- button "✕"
- heading "Чаты гостей" [level=3]
- text: Если бот не смог помочь — ответьте лично
- button "Показать закрытые"
- heading "Корзина" [level=3]
- text: "Итого: 0 ₽"
- textbox "Промокод"
- button "Применить"
- text: Способ получения
- combobox "Способ получения":
  - option "Доставка" [selected]
  - option "Самовывоз (−10%)"
- text: Населённый пункт
- combobox "Населённый пункт"
- text: Адрес (улица, дом, квартира)
- textbox "Адрес (улица, дом, квартира)":
  - /placeholder: Советская 10, кв. 5
- text: Когда привезти
- combobox "Когда привезти":
  - option "Как можно скорее (~45 мин)" [selected]
- text: Оплата
- combobox "Оплата":
  - option "Наличные при получении" [selected]
  - option "Картой при получении"
- text: Комментарий
- textbox "Комментарий":
  - /placeholder: Домофон, подъезд, пожелания…
- button "Оформить заказ"
- button "Закрыть"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | async function skipSplash(page){
  4  |   const sp = page.locator('#brandSplash');
  5  |   if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
  6  | }
  7  | 
  8  | test('поддержка из бота: оверлей появляется и НЕ исчезает', async ({ page }) => {
  9  |   await page.goto('/?src=tg&tab=chat&support=choose');
  10 |   const ov = page.locator('#supportChooseOverlay');
> 11 |   await expect(ov).toBeVisible({ timeout: 6000 });
     |                    ^ Error: expect(locator).toBeVisible() failed
  12 |   await page.waitForTimeout(2000);            // регрессия «появилась на секунду»
  13 |   await expect(ov).toBeVisible();
  14 | });
  15 | 
  16 | test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  17 |   await page.goto('/?src=tg&tab=chat&support=choose');
  18 |   await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
  19 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  20 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  21 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 }); // подсказки не глотаются
  22 | });
  23 | 
  24 | test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  25 |   await page.goto('/?src=tg&tab=chat&support=choose');
  26 |   await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click();
  27 |   await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
  28 | });
  29 | 
  30 | test('обычное открытие чата — без оверлея', async ({ page }) => {
  31 |   await page.goto('/');
  32 |   await skipSplash(page);
  33 |   await page.locator('#chatFab').click();
  34 |   await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  35 |   await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
  36 | });
  37 | 
  38 | test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  39 |   await page.goto('/');
  40 |   await skipSplash(page);
  41 |   await page.locator('#chatFab').click();
  42 |   const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  43 |   await call.click();
  44 |   await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible(); // первый тап не отправляет
  45 | });
```