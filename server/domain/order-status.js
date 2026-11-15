// Allowed order status transitions shared by the API and unit tests.
const ALLOWED_TRANSITIONS = {
  new: ['accept', 'done', 'cancel'],
  accept: ['cook', 'done', 'cancel'],
  cook: ['done', 'cancel'],
  way: ['done', 'cancel'],
  done: [],
  cancel: [],
};

export function canTransitionOrderStatus(current, next, method) {
  if (!current || !next || current === next) return false;
  if (current === 'cook' && method !== 'pickup') {
    return ['way', 'done', 'cancel'].includes(next);
  }
  return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}
