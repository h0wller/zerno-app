/* public/app/main.js — единая module-точка входа приложения.
   ТОЛЬКО статические импорты. boot.js импортируется ПОСЛЕДНИМ. */

import './core/state.js';
import './core/utils.js';
import './core/api.js';
import './core/ui.js';
import './core/auth.js';
import './core/panel.js';
import './core/qr.js';
import './core/review.js';
import './core/fx.js';
import './core/dash.js';
import './core/promo.js';
import './core/staffpin.js';
import './core/push-ui.js';
import './core/overlay-core.js';
import './core/catalog.js';
import './core/splash.js';
import './core/views.js';
import './core/chat-head.js';
import './core/chat-state.js';
import './core/deeplink.js';
import './core/swipe.js';
import './core/notify.js';
import './core/a11y.js';
import './core/config.js';
import './core/push.js';
import './ui/styles.js';
import './ui/settings.js';
import './ui/cashier-card.js';
import './ui/scrolltop.js';
import './chat.js';
import './chat-core.js';
import './menu.js';
import './profile.js';
import './profile-brand.js';
import './cashier.js';
import './scanner.js';
import './delivery.js';
import './ui/delivery-search.js';
import './cart.js';
import './orders.js';
import './live.js';
import './admin-extra.js';
import './menu-editor.js';
import './address.js';
import './core/editor.js';
import './ui/cashier-log.js';

import './core/boot.js';      /* ОБЯЗАТЕЛЬНО ПОСЛЕДНИМ */
