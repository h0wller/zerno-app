# Weekday lunch menu discount

## Goal

20% discount on menu items Monday through Friday, 11:00 inclusive to 15:00 exclusive, in `Europe/Kaliningrad`.

## Confirmed policy

- Eligibility is determined only by the server-side order submission time in `Europe/Kaliningrad`, not by the selected fulfilment slot.
- A preorder submitted during the weekday lunch window receives the lunch discount even if its selected slot is outside the window. A preorder submitted outside the window does not receive it, even if its selected slot falls within the window.
- ASAP and preorders use the same checkout-time eligibility rule.
- The discount applies to the menu subtotal, including server-validated paid modifiers. Delivery fee is unchanged.
- The existing 10% staff discount is the only discount allowed to stack. It is calculated against the original subtotal, so staff receive a total 30%, not 28%.
- Pickup discount, percentage/fixed promo codes and other free-shipping promo codes are suppressed during lunch. The personal one-time free-delivery bonus granted for registration remains available. Automatic gifts are suppressed; rejected promo codes are not used.
- Outside lunch, existing pickup/staff precedence, promo-code behaviour and gifts remain unchanged.
- Server calculates the final total. Discount label and amount are persisted and shown in customer confirmation/history and staff notifications/details.

## Tests

Weekday boundaries, weekend, ASAP/preorders, guest 20%, staff 30%, pickup suppression, promo/freeship suppression and usage count, gift suppression, preservation outside lunch, and persisted/displayed discount label.
