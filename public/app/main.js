/* public/app/main.js — Ф5.6-финал: единая module-точка входа приложения.
   ТОЛЬКО статические импорты. Никаких if/import()/IIFE.
   boot.js импортируется ПОСЛЕДНИМ: его DOMContentLoaded-listener зарегистрируется
   после всех shims, и boot() вызовется корректно. */

import './core/state.js';      /* Ф5.6-финал шаг 4: ПЕРВЫМ (все модули читают state-глобалы) */
import './core/utils.js';     /* Ф5.6-финал шаг 3 */
import './core/api.js';       /* Ф5.6-финал шаг 3 */
import './core/ui.js';        /* Ф5.6-финал шаг 3 */
import './core/auth.js';      /* Ф5.6-финал шаг 3 */
import './core/panel.js';     /* Ф5.6-финал шаг 3 */
import './core/qr.js';        /* Ф5.7 */
import './core/review.js';    /* Ф5.7 */
import './core/fx.js';        /* Ф5.7 */
import './core/dash.js';      /* Ф5.7 */
import './core/promo.js';     /* Ф5.7 */
import './core/staffpin.js';  /* Ф5.7 */
import './core/push-ui.js';   /* Ф5.7 */
import './core/overlay-core.js'; /* Ф5.7 */
import './core/catalog.js';   /* Ф5.7: loadMenu/renderMenu/renderModes — КРИТИЧНО ДЛЯ ГОСТЯ */
import './core/splash.js';    /* Ф5.7 */
import './core/views.js';     /* Ф5.6-финал шаг 2: позиция прежнего тега 36 */
import './core/chat-head.js'; /* Ф5.7 */
import './core/chat-state.js';/* Ф5.7 */
import './core/deeplink.js';  /* Ф5.7 */
import './core/swipe.js';     /* Ф5.7 */
import './core/notify.js';    /* Ф5.7 */
import './core/a11y.js';      /* Ф5.7 */
import './core/config.js';    /* Ф5.7 */
import './core/push.js';      /* Ф5.6-финал шаг 4 */
import './ui/styles.js';      /* Ф5.7 */
import './ui/settings.js';    /* Ф5.7 */
import './ui/cashier-card.js';/* Ф5.7 */
import './ui/scrolltop.js';   /* Ф5.7 */
import './chat.js';           /* Ф5.7 */
import './chat-core.js';      /* Ф5.7 */
import './menu.js';           /* Ф5.7 */
import './profile.js';        /* Ф5.7 */
import './profile-brand.js';  /* Ф5.7 */
import './cashier.js';        /* Ф5.7 */
import './scanner.js';        /* Ф5.7 */
import './delivery.js';       /* Ф5.7 */
import './ui/delivery-search.js'; /* Ф5.7 */
import './cart.js';           /* Ф5.7 */
import './orders.js';         /* Ф5.7 */
import './live.js';           /* Ф5.7 */
import './admin-extra.js';    /* Ф5.7: applyBrandChrome — КРИТИЧНО ДЛЯ ГОСТЯ (логотипы/тикер) */
import './menu-editor.js';    /* Ф3.6 */
import './address.js';        /* Ф5.7 */
import './core/editor.js';    /* Ф5.7: кластер editor */
import './ui/cashier-log.js'; /* Ф5.7: кластер cashier-log */

import './core/boot.js';      /* ОБЯЗАТЕЛЬНО ПОСЛЕДНИМ */
