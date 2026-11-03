const DEFAULT_PICKUP_RATE = 0.10;
const DEFAULT_STAFF_RATE = 0.10;
const LUNCH_DISCOUNT_RATE = 0.20;

export function calculateOrderDiscounts({
  subtotal, method, byStaff, lunchPromo,
  pickupRate = DEFAULT_PICKUP_RATE,
  staffRate = DEFAULT_STAFF_RATE,
}) {
  const amount = Math.max(0, Number(subtotal) || 0);
  if (lunchPromo) {
    const combinedRate = LUNCH_DISCOUNT_RATE + (byStaff ? staffRate : 0);
    return {
      discount: Math.round(amount * combinedRate),
      label: byStaff ? '20% дневная акция + 10% для своих' : '20% дневная акция',
    };
  }
  const staffDiscount = byStaff ? Math.round(amount * staffRate) : 0;
  const pickupDiscount = method === 'pickup' ? Math.round(amount * pickupRate) : 0;
  const discount = Math.max(pickupDiscount, staffDiscount);
  return {
    discount,
    label: pickupDiscount ? '10% самовывоз' : (staffDiscount ? '10% для своих' : ''),
  };
}
