# [Handoff][Ponytail] Remove obsolete category-rail cue plumbing and dead stub

## Проблема

После перехода на новую rail mask часть прежней cue-инфраструктуры может больше не влиять на UI: JS продолжает отслеживать overflow/scroll-end, а CSS отключает старые псевдоэлементы. Дополнительно в `scrolltop.js` присутствует пустая `alignMbonusWithRail()`, экспортируемая в глобальную область.

Evidence:
- `public/app/menu.js` — `syncCoffeeRailCue()` и binding handlers
- `public/app/delivery.js` — `syncDeliveryRailCue()` и binding handlers
- `public/app/core/views.js` — отключение старых pseudo-element cues
- `public/app/ui/scrolltop.js` — пустой `alignMbonusWithRail()`
- `tests/menu-header-rail-layout.spec.js` — проверки старых cue flags

## Предлагаемое решение

1. Сначала завершить PR по реальному поведению маски и доступности; не удалять код, пока он нужен новой реализации.
2. Удалить только доказанно неиспользуемые cue observers/listeners/state и старые псевдоэлементы.
3. Удалить пустую функцию и глобальный экспорт после проверки всех call sites.
4. Переписать тесты с внутренних CSS-классов на пользовательское поведение: видимость первой/последней кнопки, scroll affordance, keyboard scroll, отсутствие page overflow.
5. Не вводить универсальный rail framework и не объединять несхожие state machines только ради сокращения строк.

## Критерии приёмки

- Нет мёртвых глобальных API и неиспользуемых обработчиков.
- Подсказка прокрутки остаётся понятной и корректной.
- Клавиатурная и touch-навигация не регрессируют.
- Тесты проверяют внешний контракт, а не реализацию через внутренние классы.
- После cleanup diff действительно уменьшает сложность без изменения UX.

## Объём

Ponytail: удалить лишнюю сложность, не переписывая архитектуру. Задача зависит от завершения rail accessibility и mask behavior.

## Примечание

Это handoff PR с постановкой задачи. Production-код намеренно не менялся.
