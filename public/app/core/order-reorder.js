export function restoreOrderItems(orderItems, menu) {
  var products = Array.isArray(menu) ? menu : [];
  return (Array.isArray(orderItems) ? orderItems : []).map(function (item) {
    var id = String(item.id || '');
    var product = products.find(function (entry) { return String(entry.id) === id; });
    var options = product && Array.isArray(product.opts) ? product.opts : [];
    if (product && typeof product.opts === 'string') {
      try {
        var parsed = JSON.parse(product.opts);
        if (Array.isArray(parsed)) options = parsed;
      } catch (_) {}
    }

    var oi = Number.isInteger(item.oi) ? item.oi : -1;
    if (oi >= 0 && options.length && !options[oi]) oi = -1;
    if (oi < 0 && item.opt && options.length) {
      oi = options.findIndex(function (option) {
        if (String(option.l || option.name || '') === String(item.opt)) return true;
        return Number(item.sz) > 0 &&
          Number(option.sz) === Number(item.sz) &&
          Number(option.p) === Number(item.price);
      });
    }

    return {
      key: id + (oi >= 0 ? '_' + oi : ''),
      id: id,
      oi: oi,
      name: item.name || 'Блюдо',
      opt: item.opt || null,
      price: Number(item.price) || 0,
      sz: Number(item.sz) || 0,
      qty: Number(item.qty) || 1,
      modifiers: Array.isArray(item.modifiers) ? item.modifiers.map(function (modifier) {
        return { ...modifier };
      }) : []
    };
  });
}
