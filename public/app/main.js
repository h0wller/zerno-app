/* public/app/main.js — Ф5.6-финал: единая module-точка входа приложения.
   Порядок импортов = прежний документ-порядок module-тегов.
   boot.js импортируется последним: его DOMContentLoaded-listener зарегистрируется
   после всех shims, и boot() вызовется корректно. */
import './core/utils.js'; /* Ф5.6-финал шаг 3 */
import './core/api.js'; /* Ф5.6-финал шаг 3 */
import './core/ui.js'; /* Ф5.6-финал шаг 3 */
import './core/auth.js'; /* Ф5.6-финал шаг 3 */
import './core/panel.js'; /* Ф5.6-финал шаг 3 */
import './core/catalog.js';
import './core/staffpin.js';
import './core/editor.js';
import './core/promo.js';
import './core/dash.js';
import './core/push-ui.js';
import './core/fx.js';
import './core/overlay-core.js';
import './chat.js';
import './core/chat-head.js';
import './profile.js';
import './cashier.js';
import './orders.js';
import './menu.js';
import './core/a11y.js';
import './ui/styles.js';
import './ui/scrolltop.js';
import './scanner.js';
import './menu-editor.js';
import './delivery.js';
import './cart.js';
import './core/chat-state.js';
import './chat-core.js';
import './live.js';
import './core/deeplink.js';
import './profile-brand.js';
import './core/overlay.js';
import './core/swipe.js';
import './admin-extra.js';
import './core/notify.js';
import './core/views.js'; /* Ф5.6-финал шаг 2: позиция прежнего тега 36 */
import './core/config.js';
import './core/splash.js';
import './ui/settings.js';
import './ui/delivery-search.js';
import './ui/cashier-log.js';
import './ui/cashier-card.js';
import './core/qr.js';
import './core/review.js';
import './address.js';
import './core/boot.js';
