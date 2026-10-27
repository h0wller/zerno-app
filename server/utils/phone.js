/**
 * Очищает номер телефона от лишних символов и приводит к 10 цифрам (без 7/8).
 * @param {string|number} v - Исходное значение номера.
 * @returns {string} 10 цифр номера или пустая строка.
 */
export const ph10 = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = d.slice(1);
  return d.slice(0, 10);
};

/**
 * Форматирует номер телефона в вид +7 XXX XXX-XX-XX.
 * @param {string|number} v - Исходное значение номера.
 * @returns {string} Отформатированный номер или пустая строка.
 */
export const fmtPhone = (v) => {
  const d = ph10(v);
  if (!d) return '';
  let r = '+7';
  if (d.length > 0) r += ' ' + d.slice(0, 3);
  if (d.length > 3) r += ' ' + d.slice(3, 6);
  if (d.length > 6) r += '-' + d.slice(6, 8);
  if (d.length > 8) r += '-' + d.slice(8, 10);
  return r;
};