# Weekday lunch menu discount

## Goal

20% discount on menu items Monday through Friday, 11:00 inclusive to 15:00 exclusive, in `Europe/Kaliningrad`.

## Confirmed policy

- Eligibility is determined by fulfilment time, not checkout-open or submit time.
- ASAP uses current Kaliningrad local time. Preorders use the start of the selected, server-validated slot.
- The discount applies to the menu subtotal, including server-validated paid modifiers. Delivery fee is unchanged.
- The existing 10% staff discount is the only discount allowed to stack. It is calculated against the original subtotal, so staff receive a total 30%, not 28%.
- Pickup discount, every delivery promo code (percent, fixed-value and free-shipping), and automatic gifts are suppressed during lunch. Rejected promo codes are not used.
- Outside lunch, existing pickup/staff precedence, promo-code behaviour and gifts remain unchanged.
- Server calculates the final total. Discount label and amount are persisted and shown in customer confirmation/history and staff notifications/details.

## Tests

Weekday boundaries, weekend, ASAP/preorders, guest 20%, staff 30%, pickup suppression, promo/freeship suppression and usage count, gift suppression, preservation outside lunch, and persisted/displayed discount label.
