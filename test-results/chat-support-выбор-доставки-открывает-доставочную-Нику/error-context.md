# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-support.spec.js >> выбор доставки открывает доставочную Нику
- Location: tests\chat-support.spec.js:16:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#supportChooseOverlay [data-support-topic="delivery"]')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e10] [cursor=pointer]:
      - text: …и кофе
      - generic [ref=e11]: кофейня на берегу моря
    - generic [ref=e12]:
      - button "🌊 Кофейня" [ref=e13] [cursor=pointer]
      - button "🍕 Пятница" [ref=e14] [cursor=pointer]
    - generic [ref=e15]: 22:36
    - button "?" [ref=e16] [cursor=pointer]
  - generic [ref=e18]:
    - generic [ref=e19]: кофейня на берегу моря …и кофе 〜
    - generic [ref=e20]: каждый 10-й кофе — бесплатно 〜
    - generic [ref=e21]: п. Янтарный, Советская 70г 〜
    - generic [ref=e22]: t.me/and_coffee39 〜
    - generic [ref=e23]: ежедневно с 8:00–21:00 〜
    - generic [ref=e24]: кофейня на берегу моря …и кофе 〜
    - generic [ref=e25]: каждый 10-й кофе — бесплатно 〜
    - generic [ref=e26]: п. Янтарный, Советская 70г 〜
    - generic [ref=e27]: t.me/and_coffee39 〜
    - generic [ref=e28]: ежедневно с 8:00–21:00 〜
  - generic [ref=e29]:
    - navigation [ref=e30]:
      - button "☕ Кофе" [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: ☕
        - text: Кофе
      - button "🧋 Напитки" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: 🧋
        - text: Напитки
      - button "🌊 Сезонное" [ref=e35] [cursor=pointer]:
        - generic [ref=e36]: 🌊
        - text: Сезонное
      - button "🥐 Еда" [ref=e37] [cursor=pointer]:
        - generic [ref=e38]: 🥐
        - text: Еда
      - button "🍰 Десерты" [ref=e39] [cursor=pointer]:
        - generic [ref=e40]: 🍰
        - text: Десерты
      - button "🛍 С полки" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: 🛍
        - text: С полки
    - generic [ref=e45]:
      - generic [ref=e47]:
        - generic [ref=e48]:
          - heading [level=1] [ref=e49]:
            - text: Меню
            - emphasis [ref=e50]: на берегу моря
          - generic [ref=e51]: Обновлено 10 сентября в 22:35
        - generic [ref=e53]:
          - text: 🔍
          - textbox "Найти в меню…" [ref=e54]
      - generic [ref=e55]:
        - article [ref=e56]:
          - generic [ref=e57]: ⚡
          - generic [ref=e59]:
            - heading "Эспрессо" [level=3] [ref=e60]
            - generic [ref=e61]: 40 мл чистой честности. Без молока и компромиссов
            - generic [ref=e62]: эспрессо
            - generic [ref=e64]: 40 мл
            - generic [ref=e65]: 200 ₽
        - article [ref=e67]:
          - generic [ref=e68]: ☕
          - generic [ref=e70]:
            - heading "Американо" [level=3] [ref=e71]
            - generic [ref=e72]: Для тех, кто любит «просто кофе». Держит до вечера
            - generic [ref=e73]:
              - generic [ref=e74]: эспрессо
              - generic [ref=e75]: вода
            - generic [ref=e76]: 200 мл
            - generic [ref=e77]: 240 ₽
        - article [ref=e79]:
          - generic [ref=e80]: 🫖
          - generic [ref=e82]:
            - heading "Батч брю" [level=3] [ref=e83]
            - generic [ref=e84]: Заварили с любовью. Кислит, сладит, живёт
            - generic [ref=e85]: фильтр-кофе
            - generic [ref=e87]: 200 / 300 мл
            - generic [ref=e88]: 220 ₽ / 260 ₽
        - article [ref=e90]:
          - generic [ref=e91]: ☕
          - generic [ref=e93]:
            - heading "Флэт уайт" [level=3] [ref=e94]
            - generic [ref=e95]: Двойной эспрессо в бархатной накидке
            - generic [ref=e96]:
              - generic [ref=e97]: двойной эспрессо
              - generic [ref=e98]: молоко
            - generic [ref=e99]: 180 мл
            - generic [ref=e100]: 280 ₽
        - article [ref=e102]:
          - generic [ref=e103]:
            - generic [ref=e104]: ☕
            - generic [ref=e105]: Хит
          - generic [ref=e106]:
            - heading "Капучино" [level=3] [ref=e107]
            - generic [ref=e108]: Классика, за которой возвращаются. Пенка — хоть рисуй
            - generic [ref=e109]:
              - generic [ref=e110]: эспрессо
              - generic [ref=e111]: молоко
            - generic [ref=e112]: 200 / 300 мл
            - generic [ref=e113]: 250 ₽ / 340 ₽
        - article [ref=e115]:
          - generic [ref=e116]: 🥛
          - generic [ref=e118]:
            - heading "Латте" [level=3] [ref=e119]
            - generic [ref=e120]: Мягкий и тёплый, как объятие. Только вкуснее
            - generic [ref=e121]:
              - generic [ref=e122]: эспрессо
              - generic [ref=e123]: молоко
            - generic [ref=e124]: 300 / 400 мл
            - generic [ref=e125]: 310 ₽ / 360 ₽
        - article [ref=e127]:
          - generic [ref=e128]: 🍦
          - generic [ref=e130]:
            - heading "Раф" [level=3] [ref=e131]
            - generic [ref=e132]: Сливочный, сладкий, затягивает. Мы никому не расскажем
            - generic [ref=e133]:
              - generic [ref=e134]: эспрессо
              - generic [ref=e135]: сливки
              - generic [ref=e136]: ванильный сахар
            - generic [ref=e137]: 300 / 400 мл
            - generic [ref=e138]: 360 ₽ / 400 ₽
    - complementary [ref=e140]:
      - generic [ref=e141]:
        - button "Бонусы" [ref=e142] [cursor=pointer]
        - button "Профиль" [ref=e143] [cursor=pointer]
      - generic [ref=e146]:
        - generic [ref=e147]: 🎁
        - generic [ref=e148]: Копите на бесплатный кофе
        - paragraph [ref=e149]: Каждый 10-й кофе — за наш счёт. Создайте профиль по номеру телефона — штампы начисляет кассир.
        - button "Создать профиль" [ref=e150] [cursor=pointer]
  - button "Чат поддержки" [ref=e151] [cursor=pointer]
  - region "Чат поддержки" [ref=e154]:
    - generic [ref=e155]:
      - generic [ref=e156]: 🌊
      - generic [ref=e157]:
        - text: Ника · поддержка
        - generic [ref=e158]: онлайн, отвечает ~1 мин
      - button "Закрыть" [ref=e160] [cursor=pointer]: ✕
    - generic [ref=e162]:
      - textbox "Напишите сообщение…" [ref=e163]
      - button "Отправить" [ref=e164] [cursor=pointer]
  - generic:
    - generic:
      - button "✕"
      - heading "Позиция меню" [level=3]
      - generic: Изменения сразу видны гостям в меню
      - generic:
        - generic:
          - generic:
            - text: Название
            - textbox "Название":
              - /placeholder: Капучино
          - generic:
            - text: Категория
            - combobox "Категория":
              - option "☕ Кофе" [selected]
              - option "🧋 Напитки"
              - option "🌊 Сезонное"
              - option "🥐 Еда"
              - option "🍰 Десерты"
              - option "🛍 С полки"
        - generic:
          - generic:
            - text: Цена, ₽
            - spinbutton "Цена, ₽"
          - generic:
            - text: Объём / выход
            - textbox "Объём / выход":
              - /placeholder: 300 мл
          - generic:
            - text: Эмодзи-фолбэк
            - textbox "Эмодзи-фолбэк":
              - /placeholder: ☕
        - generic:
          - text: Описание
          - textbox "Описание":
            - /placeholder: Коротко и с характером
        - generic:
          - text: Состав
          - generic: — через запятую, покажем чипсами
          - textbox "Состав — через запятую, покажем чипсами":
            - /placeholder: эспрессо, молоко
        - generic:
          - generic:
            - text: Метка
            - combobox "Метка":
              - option "без метки" [selected]
              - option "Хит"
              - option "New"
              - option "Vegan"
          - generic:
            - checkbox "Считать в бонусах (это кофе)"
            - text: Считать в бонусах (это кофе)
        - generic:
          - checkbox "Показывать в меню (снять = стоп-лист)" [checked]
          - text: Показывать в меню (снять = стоп-лист)
        - generic:
          - button "Сохранить"
          - button "⧉"
          - button "🗑"
  - generic [ref=e168]:
    - heading "Создайте профиль" [level=3] [ref=e175]
    - generic [ref=e176]: Штампы и бесплатные кофе — по номеру телефона.Никаких карт и анкет.
    - generic [ref=e177]:
      - generic [ref=e178]:
        - text: Имя
        - textbox "Имя" [active] [ref=e179]:
          - /placeholder: Как к вам обращаться?
      - generic [ref=e180]:
        - text: Телефон
        - textbox "Телефон" [ref=e181]:
          - /placeholder: +7 900 000-00-00
      - button "🤖 Подтвердить в Telegram · бесплатно" [ref=e182] [cursor=pointer]
      - generic [ref=e183]: Нет Telegram? Создайте профиль — кассир назовёт код активации, а +1 штамп ждёт в Telegram 🎁
      - generic [ref=e184]:
        - text: PIN-код (4 цифры)
        - textbox "PIN-код (4 цифры)" [ref=e185]:
          - /placeholder: Например 2580
      - generic [ref=e186]: PIN защищает ваш профиль — без него никто не войдёт, даже зная номер
      - button "Создать профиль" [ref=e187] [cursor=pointer]
      - generic [ref=e188]:
        - text: Уже есть профиль?
        - button "Войти по номеру" [ref=e189] [cursor=pointer]
  - generic:
    - generic:
      - button "✕"
      - heading "Код доступа" [level=3]
      - generic: Введите код, который выдал владелец кофейни.Вкладки «Кассир» и «Админ» открываются только сотрудникам.
      - generic:
        - textbox "••••"
        - button "Активировать"
      - generic: После 5 ошибок — пауза, растущая вдвое
  - generic:
    - generic:
      - button "✕"
      - heading "Придумайте PIN" [level=3]
      - generic: 4 цифры — вы будете вводить их при входе.Без PIN никто не сможет войти в ваш профиль.
      - generic:
        - textbox "••••"
        - button "Сохранить PIN"
      - generic:
        - button "🔑 Не помню PIN — код в Telegram"
  - generic:
    - generic:
      - button "✕"
      - generic: Покажите кассиру
      - generic: —
      - generic: —
      - generic: Нажмите в любом месте, чтобы закрыть
  - generic:
    - generic:
      - button "✕"
      - heading "Промокоды и акции" [level=3]
      - generic: Гость активирует код в «Бонусах» → «Есть промокод?»
      - generic:
        - generic:
          - text: Код
          - 'textbox "Код Латиницей, без пробелов. Например: MORE10, SEA5"':
            - /placeholder: MORE10
          - generic: "Латиницей, без пробелов. Например: MORE10, SEA5"
        - generic:
          - generic:
            - text: Тип
            - combobox "Тип «Штампы» — начислит N штампов. «Кофе» — сразу даст подарок":
              - option "Штампы (кофейня)" [selected]
              - option "Бесплатный кофе (кофейня)"
              - option "Скидка % (доставка)"
              - option "Скидка ₽ (доставка)"
            - generic: «Штампы» — начислит N штампов. «Кофе» — сразу даст подарок
          - generic:
            - text: Кол-во
            - 'spinbutton "Кол-во Сколько даст код: штампов или бесплатных кофе"': "1"
            - generic: "Сколько даст код: штампов или бесплатных кофе"
        - generic:
          - generic:
            - text: Дней
            - spinbutton "Дней 0 — бессрочно. Иначе сгорит через N дней": "0"
            - generic: 0 — бессрочно. Иначе сгорит через N дней
          - generic:
            - text: Лимит
            - spinbutton "Лимит 0 — без лимита. Иначе — всего N активаций на всех": "0"
            - generic: 0 — без лимита. Иначе — всего N активаций на всех
        - button "Создать промокод"
      - heading "Список кодов" [level=4]
      - heading "🍕 Пятничный подарок (доставка)" [level=4]
      - generic:
        - generic:
          - text: Текст акции для гостей
          - textbox "Текст акции для гостей":
            - /placeholder: Каждые 2000 ₽ в чеке — бутылка пива в подарок 🍺
        - generic:
          - generic:
            - text: Порог, ₽ (0 = подарок к каждому заказу)
            - spinbutton "Порог, ₽ (0 = подарок к каждому заказу)": "0"
          - generic:
            - text: Подарок (пусто = только текст)
            - textbox "Подарок (пусто = только текст)":
              - /placeholder: Пиво 0.5
        - generic:
          - text: Действует до
          - textbox "Действует до"
        - generic:
          - checkbox "Отправить пуш всем при сохранении"
          - text: Отправить пуш всем при сохранении
        - button "Сохранить пятничный подарок"
      - heading "🍕 Пицца месяца" [level=4]
      - generic:
        - generic:
          - text: Название подарочной (30 см, тонкое)
          - textbox "Название подарочной (30 см, тонкое)":
            - /placeholder: Маргарита
        - generic:
          - checkbox "Акция «2 пиццы 35 см → подарок» включена"
          - text: Акция «2 пиццы 35 см → подарок» включена
        - button "Сохранить пиццу месяца"
  - generic:
    - generic:
      - button "✕"
      - heading "Дашборд владельца" [level=3]
      - generic: Живая статистика лояльности · …и кофе
      - heading "Штампы за 14 дней" [level=4]
      - heading "Пуш всем гостям" [level=4]
      - heading "Кто подписан на пуши" [level=4]
      - generic:
        - generic:
          - text: Текст акции
          - textbox "Текст акции":
            - /placeholder: "Например: сегодня до 12:00 капучино −20%"
        - button "🔔 Отправить"
  - generic:
    - generic:
      - button "✕"
      - heading "Чаты гостей" [level=3]
      - generic: Если бот не смог помочь — ответьте лично
      - button "Показать закрытые"
  - generic [ref=e190]:
    - heading "Корзина" [level=3] [ref=e191]
    - generic [ref=e192]:
      - generic [ref=e193]:
        - generic [ref=e194]: "Итого:"
        - generic [ref=e195]: 0 ₽
      - generic [ref=e196]:
        - textbox "Промокод" [ref=e197]
        - button "Применить" [ref=e198] [cursor=pointer]
    - generic [ref=e199]:
      - generic [ref=e200]:
        - text: Способ получения
        - combobox "Способ получения" [ref=e201]:
          - option "Доставка" [selected]
          - option "Самовывоз (−10%)"
      - generic [ref=e202]:
        - text: Населённый пункт
        - combobox "Населённый пункт" [ref=e203]
      - generic [ref=e204]:
        - text: Адрес (улица, дом, квартира)
        - textbox "Адрес (улица, дом, квартира)" [ref=e205]:
          - /placeholder: Советская 10, кв. 5
      - generic [ref=e206]:
        - text: Когда привезти
        - combobox "Когда привезти" [ref=e207]:
          - option "Как можно скорее (~45 мин)" [selected]
      - generic [ref=e208]:
        - text: Оплата
        - combobox "Оплата" [ref=e209]:
          - option "Наличные при получении" [selected]
          - option "Картой при получении"
      - generic [ref=e210]:
        - text: Комментарий
        - textbox "Комментарий" [ref=e211]:
          - /placeholder: Домофон, подъезд, пожелания…
    - button "Оформить заказ" [ref=e212] [cursor=pointer]
    - button "Закрыть" [ref=e213] [cursor=pointer]
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
  11 |   await expect(ov).toBeVisible({ timeout: 6000 });
  12 |   await page.waitForTimeout(2000);            // регрессия «появилась на секунду»
  13 |   await expect(ov).toBeVisible();
  14 | });
  15 | 
  16 | test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  17 |   await page.goto('/?src=tg&tab=chat&support=choose');
> 18 |   await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
     |                                                                               ^ Error: locator.click: Test timeout of 30000ms exceeded.
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