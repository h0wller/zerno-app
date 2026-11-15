// Pure order-statistics helpers shared by the dashboard route and unit tests.
export function isCancelledStatus(status) {
  return ['cancel', 'cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());
}

const emptyBucket = () => ({ orders: 0, revenue: 0, avg: 0, cancelled: 0, pickup: 0, delivery: 0, preorders: 0, byStatus: {}, top: [] });

export function summarizeOrderRows(rows) {
  const bucket = emptyBucket();
  const top = {};
  for (const order of rows) {
    bucket.byStatus[order.status] = (bucket.byStatus[order.status] || 0) + 1;
    if (isCancelledStatus(order.status)) {
      bucket.cancelled++;
      continue;
    }
    bucket.orders++;
    bucket.revenue += Number(order.total) || 0;
    if (order.method === 'pickup') bucket.pickup++; else bucket.delivery++;
    if (order.is_preorder) bucket.preorders++;
    let items;
    try { items = JSON.parse(order.items || '[]'); } catch { items = []; }
    for (const item of items) {
      if (!item || !item.name) continue;
      top[item.name] = (top[item.name] || 0) + (Number(item.qty) || 1);
    }
  }
  bucket.avg = bucket.orders ? Math.round(bucket.revenue / bucket.orders) : 0;
  // Keep the full ranking here. The client combines guest/staff rankings and only then takes top 5.
  bucket.top = Object.entries(top).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ name, qty }));
  return bucket;
}
