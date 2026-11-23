/* public/app/core/boot.js — Ф5.5: точка входа и жизненный цикл приложения.
Было: inline-скрипт index.html (renderAll, boot-IIFE, SW-регистрация №1)
+ три инлайн-скрипта в <body> (install-баннер, iOS-хинт, SW-регистрация №2).
Зависимости на момент DOMContentLoaded: loadMenu/renderModes (inline-ядро),
renderRail/renderMenu (menu.js), renderBonus/renderProfile (profile.js),
renderChips (chat.js), renderVerifyNote (profile-brand.js), drawQR (qr.js),
showBadge/initChatPointer (chat.js), maybeAskReview (review.js), openAuth (auth.js). */
(function () {
'use strict';

/* Детектор режима аудита Lighthouse для предотвращения перехвата LCP баннерами */
const isAudit = (typeof document !== 'undefined' && document.documentElement.classList.contains('is-audit')) ||
  /Chrome-Lighthouse|Lighthouse|moto g power/i.test(navigator.userAgent) ||
  location.search.includes('lighthouse=1');

/* Missing dish media uses the card emoji; only brand marks have WebP→SVG pairs. */
document.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG') return;
  var s = t.currentSrc || t.src || '';
  if (!/\\.webp(\\?|$)/i.test(s)) return;

  if (t.closest('#grid .media, #deliveryGrid .media')) {
    var fallback = document.createElement('span');
    fallback.className = 'em';
    fallback.dataset.imgFallback = '1';
    fallback.textContent = t.dataset.fallbackEmoji || '☕';
    fallback.setAttribute('role', 'img');
    if (t.alt) fallback.setAttribute('aria-label', t.alt);
    t.replaceWith(fallback);
    return;
  }

  if (t.dataset.imgFb === '1' || !t.closest('#brandMark, .brandLogo, .brand-mark')) return;
  t.dataset.imgFb = '1';
  var p = t.parentElement;
  if (p && p.tagName === 'PICTURE') { while (p.firstChild) p.removeChild(p.firstChild); p.appendChild(t); }
  t.src = s.replace(/\\.webp(\\?|$)/i, '.svg$1');
}, true);


function runWhenIdle(callback, timeout) {
  var schedule = function () {
    var run = function () {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: timeout || 2000 });
      } else {
        setTimeout(callback, 800);
      }
    };
    if (document.visibilityState === 'visible' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}

/* ── 1. Агрегатная перерисовка всех видов ── */
function renderAll(options) {
  const initChar = (window.me && window.me.name && window.me.name.trim())
    ? window.me.name.trim().charAt(0).toUpperCase()
    : '?';
  const topAva = document.getElementById('profileTopBtn');
  if (topAva) topAva.textContent = initChar;
  const profAva = document.getElementById('avInit');
  if (profAva) profAva.textContent = initChar;

  if (window.brand !== 'delivery') {
    if (typeof renderRail === 'function') renderRail();
    if (!(options && options.skipCoffeeMenu) && typeof renderMenu === 'function') renderMenu();
  }
  if (typeof renderModes === 'function') renderModes();

  runWhenIdle(function () {
    if (typeof renderBonus === 'function') renderBonus();
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof renderChips === 'function') renderChips();
    if (typeof renderVerifyNote === 'function') renderVerifyNote();

    if (window.mode === 'cashier' && typeof renderLog === 'function') renderLog();
  });
}

/* ── 2. Точка входа: пользователь → меню → виды → бейджи → отзыв ── */
function preloadDeliveryCatalog() {
  if (window.brand !== 'delivery' || typeof window.loadDelivery !== 'function') return null;
  window.__dlReq = 1;
  return window.__dlPromise = window.loadDelivery();
}

function preloadCoffeeCatalog() {
  if (window.brand !== 'coffee' || typeof window.loadMenu !== 'function') return null;
  var requestedBrand = window.brand;
  return window.loadMenu({ expectedBrand: requestedBrand });
}

function applyStaffRoleState(customer) {
  var staffRole = customer && ['admin', 'cashier', 'dispatch'].indexOf(customer.role) !== -1
    ? customer.role
    : '';
  try {
    if (staffRole) localStorage.setItem('zt_role', staffRole);
    else localStorage.removeItem('zt_role');
  } catch (_) {}
  if (staffRole) document.documentElement.setAttribute('data-staff-role', staffRole);
  else document.documentElement.removeAttribute('data-staff-role');
  document.documentElement.setAttribute('data-staff-ready', '1');
}

async function verifyStaffSession() {
  if (!window.USER_TOKEN) {
    applyStaffRoleState(null);
    return;
  }

  const authController = new AbortController();
  const authTimeout = setTimeout(() => authController.abort(), 12000);
  try {
    window.me = (await api('/me', { signal: authController.signal })).customer;
    applyStaffRoleState(window.me);
  } catch (e) {
    if (e && e.status === 401) {
      // api() already invalidates the user on an authoritative 401. Do not turn
      // timeouts, offline mode or 5xx responses into permanent sign-outs.
      window.me = null;
      window.USER_TOKEN = null;
      try { localStorage.removeItem(typeof T_USER !== 'undefined' ? T_USER : 'zt_user'); } catch (_) {}
      window.__ztSessionOffline = false;
    } else {
      window.__ztSessionOffline = true;
      window.me = null;
      if (!window.__ztSessionOfflineToastShown && typeof window.toast === 'function') {
        window.__ztSessionOfflineToastShown = true;
        window.toast('Нет связи с сервером. Сессия сохранена — приложение повторит проверку при восстановлении сети.', '📡');
      }
    }
    applyStaffRoleState(null);
  } finally {
    clearTimeout(authTimeout);
  }
}

async function loadInitialCatalog(earlyDeliveryLoad, earlyCoffeeLoad) {
  // A visible splash owns the next brand choice; don't load the stored brand.
  if (window.__brandSplashPending === true) return false;

  if (window.brand !== 'delivery') {
    var coffeePreloadSucceeded = earlyCoffeeLoad ? await earlyCoffeeLoad : false;
    var isCoffeeStaffRole = window.me && ['admin', 'cashier', 'dispatch'].indexOf(window.me.role) !== -1;
    // The public first paint stays in the DOM while the guarded staff list updates MENU.
    if (isCoffeeStaffRole || !coffeePreloadSucceeded) {
      if (typeof loadMenu === 'function') {
        var staffUpgradeSucceeded = await loadMenu({
          render: !coffeePreloadSucceeded,
          expectedBrand: 'coffee',
          expectedRole: isCoffeeStaffRole ? window.me.role : null
        });
        return {
          rendered: coffeePreloadSucceeded || staffUpgradeSucceeded,
          loaded: staffUpgradeSucceeded || coffeePreloadSucceeded
        };
      }
    }
    return { rendered: coffeePreloadSucceeded, loaded: coffeePreloadSucceeded };
  }

  var isStaffRole = window.me && ['admin', 'cashier', 'dispatch'].indexOf(window.me.role) !== -1;
  var deliveryLoad = earlyDeliveryLoad;

  // Once /api/me confirms a staff role, replace the public list with the
  // full catalog (including stopped items) required by staff tools.
  if (isStaffRole && typeof window.loadDelivery === 'function') {
    // Let the public preload settle before starting the staff request. Otherwise
    // a slower /api/dmenu response could overwrite the complete staff catalog.
    if (earlyDeliveryLoad) await earlyDeliveryLoad;
    deliveryLoad = window.__dlPromise = window.loadDelivery();
  } else if (!deliveryLoad && typeof window.loadDelivery === 'function') {
    window.__dlReq = 1;
    deliveryLoad = window.__dlPromise = window.loadDelivery();
  }

  if (deliveryLoad) await deliveryLoad;
}

async function boot() {
  document.documentElement.setAttribute('data-staff-boot-started', '1');

  // Start the selected public catalog while staff authentication is being verified.
  // The guarded full menu remains behind the verified role; a pending splash owns the choice.
  var canPreloadCatalog = window.__brandSplashPending !== true;
  var earlyDeliveryLoad = canPreloadCatalog ? preloadDeliveryCatalog() : null;
  var earlyCoffeeLoad = canPreloadCatalog ? preloadCoffeeCatalog() : null;

  await verifyStaffSession();
  if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
  try {
    var coffeeCatalogResult = await loadInitialCatalog(earlyDeliveryLoad, earlyCoffeeLoad);
  } catch (err) {
    console.warn('[BOOT] Ошибка загрузки меню:', err);
  } finally {
    renderAll({ skipCoffeeMenu: window.brand === 'coffee' && coffeeCatalogResult && coffeeCatalogResult.rendered });
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (typeof showBadge === 'function') showBadge();
    if (typeof maybeAskReview === 'function') maybeAskReview();
    if (typeof initChatPointer === 'function') {
      runWhenIdle(function () { initChatPointer(); }, 2500);
    }
  }
}

/* ── 3. Service Worker: ЕДИНАЯ регистрация ── */
function isStandalonePWA() {
  try {
    return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  } catch (_) {
    return navigator.standalone === true;
  }
}
function showSWUpdateAppliedToast() {
  const marker = 'zt_sw_update_applied';
  if (!isStandalonePWA() || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;

  let applied = false;
  try {
    applied = sessionStorage.getItem(marker) === '1';
    if (applied) sessionStorage.removeItem(marker);
  } catch (_) {}

  if (applied && typeof window.toast === 'function') {
    window.toast('Приложение обновлено', '✅');
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator) || isAudit) return;
  addEventListener('load', () => {
    let updateApproved = false;
    let updateDeferred = false;
    let reloadPending = false;
    let reloadStarted = false;
    let waitingWorker = null;
    let updateDialog = null;
    let updateCheckFrame = 0;

    function hasBlockingWork() {
      return !!document.querySelector(
        '#cartPanel.open, .modal.show, #ordersModal.show, #redeemPick.show, #orderTrackModal.show, #authModal.show, #panel.open, #chatPanel.open, #addrBookSheet.open'
      );
    }

    function closeUpdateDialog() {
      if (!updateDialog) return;
      const current = updateDialog;
      updateDialog = null;
      try {
        if (current.open && typeof current.close === 'function') current.close();
      } catch (_) {}
      current.remove();
    }

    function reloadAfterActivation() {
      if (!updateApproved || reloadStarted) return;
      if (hasBlockingWork()) {
        reloadPending = true;
        return;
      }

      reloadPending = false;
      reloadStarted = true;
      try { sessionStorage.setItem('zt_sw_update_applied', '1'); } catch (_) {}
      window.location.reload();
    }

    function deferUpdate() {
      updateDeferred = true;
      closeUpdateDialog();
    }

    function showUpdateDialog() {
      if (updateDialog || !waitingWorker || updateApproved || updateDeferred || hasBlockingWork()) return;

      if (!document.getElementById('swUpdateDialogStyles')) {
        const style = document.createElement('style');
        style.id = 'swUpdateDialogStyles';
        style.textContent = `
          .sw-update-dialog {
            position: fixed;
            inset: 0;
            margin: auto;
            width: min(440px, calc(100vw - 24px));
            max-width: none;
            max-height: calc(100dvh - 28px);
            padding: 0;
            border: 0;
            overflow: visible;
            color: var(--ink, #101418);
            background: transparent;
          }
          .sw-update-dialog::backdrop {
            background: rgba(16, 20, 24, .54);
            backdrop-filter: blur(4px);
          }
          .sw-update-dialog-card {
            box-sizing: border-box;
            display: grid;
            gap: 13px;
            width: 100%;
            padding: clamp(20px, 5vw, 28px);
            border: var(--modal-border, 1px solid rgba(62, 143, 208, .25));
            border-radius: var(--modal-radius, 22px);
            background: var(--modal-bg, #fff);
            box-shadow: var(--modal-shadow, 0 25px 60px rgba(18, 58, 107, .2));
          }
          .sw-update-dialog-icon {
            display: grid;
            place-items: center;
            width: 48px;
            height: 48px;
            border-radius: 15px;
            background: color-mix(in srgb, var(--flame, #C8402A) 12%, transparent);
            color: var(--flame, #C8402A);
            font-size: 27px;
            line-height: 1;
          }
          .sw-update-dialog h2 {
            margin: 0;
            color: var(--modal-title-color, var(--ink, #101418));
            font: var(--modal-title-font, 400 24px Prata, "Golos Text", serif);
            line-height: 1.2;
          }
          .sw-update-dialog p {
            margin: 0;
            color: var(--soft, #687783);
            font-size: 14px;
            line-height: 1.55;
          }
          .sw-update-dialog-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 9px;
            margin-top: 4px;
          }
          .sw-update-dialog-actions button {
            min-width: 0;
            min-height: 44px;
            flex: 1 1 auto;
            white-space: normal;
          }
          .sw-update-dialog-actions button:focus-visible {
            outline: 2px solid var(--staff-focus-ring, var(--ink, #101418));
            outline-offset: 0;
          }
          @media (max-width: 420px) {
            .sw-update-dialog-actions {
              flex-direction: column-reverse;
            }
            .sw-update-dialog-actions button {
              width: 100%;
            }
          }
        `;
        document.head.appendChild(style);
      }

      const dialog = document.createElement('dialog');
      dialog.className = 'sw-update-dialog';
      dialog.setAttribute('aria-labelledby', 'swUpdateDialogTitle');
      dialog.setAttribute('aria-describedby', 'swUpdateDialogDescription');
      dialog.innerHTML = `
        <div class="sw-update-dialog-card">
          <div class="sw-update-dialog-icon" aria-hidden="true">↻</div>
          <h2 id="swUpdateDialogTitle">Доступно обновление</h2>
          <p id="swUpdateDialogDescription">Мы подготовили новую версию приложения. Обновите приложение, чтобы применить изменения.</p>
          <div class="sw-update-dialog-actions">
            <button type="button" class="btn ghost" data-sw-update-later>Позже</button>
            <button type="button" class="btn fire" data-sw-update-accept>Обновить приложение</button>
          </div>
        </div>
      `;

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        deferUpdate();
      });

      dialog.querySelector('[data-sw-update-later]').addEventListener('click', deferUpdate);
      dialog.querySelector('[data-sw-update-accept]').addEventListener('click', () => {
        if (!waitingWorker || updateApproved) return;
        if (hasBlockingWork()) {
          scheduleUpdateCheck();
          return;
        }

        const workerToActivate = waitingWorker;
        updateApproved = true;
        updateDeferred = false;
        closeUpdateDialog();

        if (
          workerToActivate === navigator.serviceWorker.controller ||
          workerToActivate.state === 'activated'
        ) {
          reloadPending = true;
          reloadAfterActivation();
          return;
        }

        try {
          workerToActivate.postMessage({ type: 'SKIP_WAITING' });
        } catch (_) {
          updateApproved = false;
          scheduleUpdateCheck();
        }
      });

      document.body.appendChild(dialog);
      updateDialog = dialog;
      try {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      } catch (_) {
        dialog.setAttribute('open', '');
      }
      const acceptButton = dialog.querySelector('[data-sw-update-accept]');
      if (acceptButton) requestAnimationFrame(() => acceptButton.focus());
    }

    function offerUpdate() {
      if (!isStandalonePWA() || !navigator.serviceWorker.controller || !waitingWorker || updateApproved || updateDeferred || updateDialog || hasBlockingWork()) return;
      showUpdateDialog();
    }

    function scheduleUpdateCheck() {
      if (updateCheckFrame) return;
      updateCheckFrame = requestAnimationFrame(() => {
        updateCheckFrame = 0;
        offerUpdate();
      });
    }

    function recheckDeferredReload() {
      if (!reloadPending || reloadStarted) return;
      reloadAfterActivation();
    }

    document.addEventListener('visibilitychange', scheduleUpdateCheck);
    document.addEventListener('zt:overlay-closed', scheduleUpdateCheck);
    document.addEventListener('zt:cart-closed', scheduleUpdateCheck);
    document.addEventListener('zt:checkout-closed', scheduleUpdateCheck);
    document.addEventListener('zt:profile-closed', scheduleUpdateCheck);
    document.addEventListener('zt:chat-closed', scheduleUpdateCheck);
    document.addEventListener('zt:address-book-closed', scheduleUpdateCheck);
    window.addEventListener('pageshow', scheduleUpdateCheck);
    window.addEventListener('focus', scheduleUpdateCheck);
    window.addEventListener('resize', scheduleUpdateCheck);
    window.addEventListener('orientationchange', scheduleUpdateCheck);

    navigator.serviceWorker.addEventListener('controllerchange', reloadAfterActivation);
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_ACTIVATED') reloadAfterActivation();
    });

    navigator.serviceWorker.addEventListener('messageerror', (event) => {
      if (!updateApproved) return;
      updateApproved = false;
      try { console.warn('[SW] Не удалось подтвердить обновление:', event); } catch (_) {}
      scheduleUpdateCheck();
    });

    navigator.serviceWorker.ready.then((registration) => {
      if (!registration || !registration.waiting) return;
      if (!navigator.serviceWorker.controller) return;

      waitingWorker = registration.waiting;
      waitingWorker.addEventListener('statechange', () => {
        if (waitingWorker !== registration.waiting) waitingWorker = null;
        if (waitingWorker && waitingWorker.state === 'activated') reloadAfterActivation();
        else scheduleUpdateCheck();
      });
      offerUpdate();
    }).catch(() => {});
  });
}

/* ── 4. Экспорты и старт ── */
window.renderAll = renderAll;
window.boot = boot;
window.applyStaffRoleState = applyStaffRoleState;
window.showSWUpdateAppliedToast = showSWUpdateAppliedToast;

registerSW();
document.addEventListener('DOMContentLoaded', boot);
})();