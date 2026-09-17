/* public/app/core/qr.js — Стабильный генератор QR-кода на canvas */

/* Емкости byte-режима для ECC M (v1..v10) — консервативная оценка.
   Используется только как fallback, если библиотека не умеет auto (typeNumber=0). */
function _pickQRVersion(byteLen) {
    var caps = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
    for (var v = 1; v < caps.length; v++) if (byteLen <= caps[v]) return v;
    return 10;
}

function drawQR(cv, seed, _retry) {
    if (!cv || typeof cv.getContext !== 'function') return;

    /* Библиотека qrcode-generator ещё не подгрузилась — ждём (но не бесконечно) */
    if (typeof qrcode === 'undefined') {
        if ((_retry || 0) < 20) {
            setTimeout(function () { drawQR(cv, seed, (_retry || 0) + 1); }, 200);
        } else {
            console.warn('[QR] Библиотека qrcode не загрузилась — холст остаётся пустым');
        }
        return;
    }

    var s = String(seed || 'guest');

    function paint(qr) {
        var count = qr.getModuleCount();
        var W = cv.width || 220;
        var H = cv.height || W;
        var size = Math.min(W, H);
        var tile = size / count;
        var ox = (W - tile * count) / 2;
        var oy = (H - tile * count) / 2;
        var ctx = cv.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#101418';
        for (var r = 0; r < count; r++) {
            for (var c = 0; c < count; c++) {
                if (qr.isDark(r, c)) {
                    ctx.fillRect(
                        Math.round(ox + c * tile),
                        Math.round(oy + r * tile),
                        Math.ceil(tile),
                        Math.ceil(tile)
                    );
                }
            }
        }
    }

    try {
        var qr = null;
        /* 1) Авто-версия (поддерживается в qrcode-generator >= 1.4.4) */
        try { qr = qrcode(0, 'M'); } catch (_) { qr = null; }
        /* 2) Ручной подбор, если авто не поддержано */
        if (!qr) qr = qrcode(_pickQRVersion(s.length), 'M');

        qr.addData(s);
        qr.make();
        paint(qr);
    } catch (e) {
        console.error('[QR] Ошибка отрисовки (M):', e, 'len=', s.length);
        /* 3) Fallback: более слабая коррекция даёт больше ёмкости */
        try {
            var qr2 = qrcode(_pickQRVersion(s.length), 'L');
            qr2.addData(s);
            qr2.make();
            paint(qr2);
        } catch (e2) {
            console.error('[QR] Fallback тоже упал:', e2, 'seed=', s);
        }
    }
}

let wakeLock = null;
function openQRFull() {
    if (!me) { toast('Сначала создайте профиль', '👤'); openAuth(); return; }
    const fullCv = document.getElementById('qrFull');
    if (fullCv) drawQR(fullCv, me.qr || 'guest');
    $('#qrName').textContent = me.name || 'Гость';
    $('#qrMeta').textContent = `${me.phone || ''} · штампов: ${me.stamps || 0} из 10` + (me.free ? ` · 🎁 подарок: ${me.free}` : '');
    $('#qrModal').classList.add('show');
    syncOverlay();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(w => wakeLock = w).catch(() => {});
}

function closeQRFull() {
    $('#qrModal').classList.remove('show');
    syncOverlay();
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
}

document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('qrCard');
  if (card) card.addEventListener('click', closeQRFull);
  const closeBtn = document.getElementById('qrClose');
  if (closeBtn) closeBtn.addEventListener('click', e => { e.stopPropagation(); closeQRFull(); });
  const openB = document.getElementById('qrOpenBonus');
  if (openB) openB.onclick = openQRFull;
  const openP = document.getElementById('qrOpenProfile');
  if (openP) openP.onclick = openQRFull;

  /* ── НОВОЕ: клик по самому QR-холсту открывает полный экран ── */
  ['qrMini', 'qrMain'].forEach(function (id) {
    var cv = document.getElementById(id);
    if (!cv || cv.dataset.qrClick) return;
    cv.dataset.qrClick = '1';
    cv.style.cursor = 'zoom-in';
    cv.title = 'Открыть на весь экран';
    cv.addEventListener('click', function (e) {
      e.stopPropagation();
      openQRFull();
    });
  });
});