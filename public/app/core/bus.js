/* public/app/core/bus.js — F5.72: Легковесный EventBus для межмодульной связи */
const target = new EventTarget();

export function emit(event, detail = null) {
  target.dispatchEvent(new CustomEvent(event, { detail }));
}

export function on(event, callback) {
  const handler = (e) => callback(e.detail);
  target.addEventListener(event, handler);
  // Возвращает функцию отписки
  return () => target.removeEventListener(event, handler);
}

export function once(event, callback) {
  const handler = (e) => callback(e.detail);
  target.addEventListener(event, handler, { once: true });
}

// Доступ в глобальную область для плавного перехода vanilla-скриптов
if (typeof window !== 'undefined') {
  window.ztBus = { emit, on, once };
}