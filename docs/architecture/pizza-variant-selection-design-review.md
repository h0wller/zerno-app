# Review технического дизайна выбора варианта пиццы

> Тип проверки: same-context EGM critique по текущему draft и проверенным исходникам.
> Это не независимый Goldfish review: отдельный изолированный reviewer в этой сессии не запускался.
> Базовый код: pizza @ 4bd2fd3ad19bdcd6a060e080100e72302923814e.

## Итог

**Blocker findings: 0.** Направление native radio group соответствует взаимоисключающему выбору и позволяет сохранить данные корзины и server-side price resolution. Переход к реализации допустим после внесения замечания по ошибочной обратной связи и review двух оставшихся визуальных деталей.

## Findings

### UXD-01 — Medium — Неоднозначная стратегия объявления ошибки

**Где:** UX concept §3.2; technical design §4 «Add без выбора».

**Наблюдаемое доказательство:**
- Концепт одновременно предлагает связывать сообщение с группой через `aria-describedby` и объявлять его через live region.
- Technical design описывает `aria-describedby` и focus transfer, но не определяет live region.
- `public/app/core/ui.js: toast` создаёт обычный элемент `.toast`; ни `role`/live semantics у toast, ни `aria-live` у `#toasts` в `public/index.html` не обнаружены.

**Почему важно:** две независимые точки объявления могут привести к двойному сообщению. Сохранение одного только toast не даёт программно надёжной обратной связи. Сейчас toast визуальный, а не live announcement.

**Требуемое решение:** inline error — единственный текст источника истины для невыбранной опции; при ошибке установить `aria-describedby` на первый radio и переместить туда фокус. Не добавлять параллельный live region в первом implementation. Не вызывать toast для этого случая, поскольку inline error виден и доступен; успешный Add toast сохранить. Проверить реальное произнесение в VoiceOver/TalkBack до release.

**Уверенность:** высокая; основано на текущей реализации toast и предложенной DOM-структуре.

### UXD-02 — Medium — Click delegation меняется вместе с семантикой HTML

**Где:** technical design §4; source `public/app/delivery.js: handleDeliveryGridClick, handleDeliveryCardClick`.

**Наблюдаемое доказательство:** текущий card handler исключает `.opts button`; новая плитка — label с вложенным input и текстом.

**Почему важно:** клик по label/тексту после миграции может пройти в обработчик клика по карточке и показать ложную ошибку выбора.

**Статус:** учтено в design draft: ранний return для кликов внутри `.opts`, delegated `change` для radio и checked lookup в обработчике свободной части карточки. Требуется обязательный RED-тест, который нажимает по label, input и вложенному тексту.

**Уверенность:** высокая; поведение подтверждено исходным event flow.

### UXD-03 — Low — Геометрия после замены button на label/fieldset

**Где:** technical design §3 и §6.

**Наблюдаемое доказательство:** текущая сетка/высота и текстовые стили применяются к `button`; fieldset/legend/label изменят intrinsic sizing и каскад. Critical CSS в `public/index.html` зеркалирует часть option layout.

**Почему важно:** одна только замена элемента может изменить высоту карточки, baseline и focus outline, а изменение только внешнего theme файла создаст расхождение первого кадра.

**Статус:** учтено: перечислены владельцы `160-09`, `160-11`, `views.js` и `#critical-css`; включены viewport matrix и screenshot checks. Необходимо реально проверить все перечисленные файлы при runtime PR.

**Уверенность:** высокая.

### UXD-04 — Low — Видимость legend остаётся UX-компромиссом

**Где:** technical design §11.

**Наблюдаемое доказательство:** текущие option tiles не имеют видимого заголовка группы; legend добавит контекст, но может увеличить карточку на коротком экране.

**Почему важно:** скрытый legend экономит место, но снижает визуальную явность того, что выбираются размер и тип теста.

**Рекомендация:** использовать короткий видимый legend «Размер и тесто»; проверить влияние на 320×568 и 390×844 до утверждения финального UI.

**Уверенность:** средняя; screenshot pixels live capture не были независимо просмотрены.

## Проверка полноты и codebase fit

- Cart shape/key/fields остаются без изменения; подтверждено по `upsertDeliveryCartItem` и cart consumer.
- Сервер остаётся источником цены и проверяет `oi` в `POST /api/orders`.
- Повторный render первой карточки переписывает `.cbody.innerHTML`; делегирование на `#deliveryGrid` — правильная граница.
- Не требуется новый модуль, библиотека, MutationObserver, API или DB migration.
- CSS layer constraints из `PROJECT_RULES.md` и исполняемые правила `scripts/css-audit.mjs` учтены.
- Новый Playwright spec будет запускаться в обоих projects; Mobile Chrome исключает только `tests/menu-cards.spec.js`.
- RED/GREEN, rollback и PWA/TMA verification описаны. Ни один runtime test не запускался, так как код не менялся.

## Рекомендованные корректировки перед runtime PR

1. Синхронизировать concept и design на одном механизме ошибки: focus first radio + aria-describedby; без дополнительного live region.
2. Не показывать toast для missing selection (inline error заменяет его); сохранить toast для успешного Add.
3. Оставить видимый компактный legend как рекомендуемый вариант; измерить высоту на коротких мобильных экранах.
4. Оставить click-delegation regression в первом RED наборе.

## Заключение

Технический draft пригоден для отдельного runtime PR после корректировки UXD-01. Это заключение same-context и не заменяет независимое ревью или ручное AT/device verification.
