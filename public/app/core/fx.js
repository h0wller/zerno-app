/* public/app/core/fx.js — Ф5.7: кластер "fx" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
/* ── FIX-FX-LAZY: ленивая инициализация канваса (убирает лишнюю работу на старте) ── */
let fx = null;
let fxx = null;
let pieces = [];
let fxOn = false;

function ensureCanvas() {
  if (!fx) {
    fx = $("#fx");
    if (fx) {
      fxx = fx.getContext("2d");
      fitFx();
    }
  }
  return fx && fxx;
}

function fitFx() {
  if (fx) {
    fx.width = innerWidth;
    fx.height = innerHeight;
  }
}

// Убрали немедленный fitFx(); — он позовётся внутри ensureCanvas()

let __fitTimer;
addEventListener("resize", function() {
  clearTimeout(__fitTimer);
  __fitTimer = setTimeout(function() {
    if (fx) fitFx(); // Обновляем только если канвас уже был инициализирован
  }, 250);
});

function confetti() {
  if (!ensureCanvas()) return; // Ленивая инициализация: если нет канваса, ничего не делаем
  
  const C = ["#1F4E8C", "#7FB2D9", "#C89B6A", "#BBD6EE", "#F5F2EC"];
  for (let i = 0; i < 90; i++)
    pieces.push({
      x: Math.random() * fx.width,
      y: -20 - Math.random() * 80,
      vy: 2 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 2,
      s: 5 + Math.random() * 6,
      r: Math.random() * 6.3,
      vr: (Math.random() - 0.5) * 0.3,
      c: C[i % C.length],
    });
  if (!fxOn) {
    fxOn = true;
    loop();
  }
}

function loop() {
  fxx.clearRect(0, 0, fx.width, fx.height);
  pieces = pieces.filter((p) => p.y < fx.height + 30);
  pieces.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    fxx.save();
    fxx.translate(p.x, p.y);
    fxx.rotate(p.r);
    fxx.fillStyle = p.c;
    fxx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
    fxx.restore();
  });
  pieces.length
    ? requestAnimationFrame(loop)
    : ((fxOn = false), fxx.clearRect(0, 0, fx.width, fx.height));
}

/* ── Ф5.6.2a: ESM-шим: явный экспорт для классик-вызывающих (кассир/админ штамп) ── */
window.confetti = confetti;
window.fitFx = fitFx;