/* public/app/core/dnd.js — F3.70: drag-and-drop порядка карточек меню (admin + editMode).
   Один движок на оба грида: слушатели делегированы на контейнер и переживают перерендеры innerHTML.
   Контракт: attachGridDnD(gridEl, { canDrag, getIds, onReorder, rerender }). */

export function canDragMenu() {
  return !!(window.me && window.me.role === 'admin' && window.editMode);
}

/* Строка-атрибут для шаблонов карточек: без draggable="true" браузер не начнёт drag. */
export function dragAttr() {
  return canDragMenu() ? ' draggable="true"' : '';
}

function cardId(card) {
  return card.getAttribute('data-item-id') || card.getAttribute('data-product-id') || '';
}

function cleanMarks(gridEl) {
  gridEl.querySelectorAll('.card.dragging, .card.drag-over').forEach(function (c) {
    c.classList.remove('dragging', 'drag-over');
  });
}

export function attachGridDnD(gridEl, opts) {
  if (!gridEl) return;
  let dragId = null;

  gridEl.addEventListener('dragstart', function (e) {
    if (!opts.canDrag()) return;
    const card = e.target.closest ? e.target.closest('.card') : null;
    if (!card || !cardId(card)) return;
    dragId = cardId(card);
    card.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {}
    }
  });

  gridEl.addEventListener('dragover', function (e) {
    if (!opts.canDrag() || !dragId) return;
    e.preventDefault();
    const over = e.target.closest ? e.target.closest('.card:not(.dragging)') : null;
    gridEl.querySelectorAll('.card.drag-over').forEach(function (c) {
      if (c !== over) c.classList.remove('drag-over');
    });
    if (over) over.classList.add('drag-over');
  });

  gridEl.addEventListener('drop', function (e) {
    if (!opts.canDrag() || !dragId) return;
    e.preventDefault();
    const dst = e.target.closest ? e.target.closest('.card:not(.dragging)') : null;
    const fromId = dragId;
    dragId = null;
    cleanMarks(gridEl);
    if (!dst) return;
    const toId = cardId(dst);
    if (!toId || toId === fromId) return;
    const ids = opts.getIds().slice();
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
    opts.onReorder(ids).catch(function (err) {
      if (typeof window.toast === 'function') window.toast(err.message || 'Не удалось сохранить порядок', '⚠️');
      opts.rerender();
    });
  });

  gridEl.addEventListener('dragend', function () {
    dragId = null;
    cleanMarks(gridEl);
  });
}