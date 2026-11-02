# Weekday lunch menu discount

## Goal

Introduce a 20% discount on menu items from Monday through Friday during the local business-time interval 11:00–15:00. The discount must be calculated on the server from the selected fulfilment slot, never from the time the customer opened checkout or submitted the order.

## Provisional acceptance criteria

- The promotion is active Monday–Friday, from 11:00 inclusive until 15:00 exclusive, using the restaurant's Kaliningrad timezone.
- A regular ASAP order is eligible only when the current local time is inside the promotion window.
- A preorder is eligible only when its validated fulfilment slot falls inside the promotion window. An order placed at 12:00 for 16:00 is not eligible; an order placed before 11:00 for 12:00 is eligible.
- The promotion applies to menu subtotal (including validated paid modifiers); delivery fee is not discounted.
- During the promotion window, the pickup discount must not be added to the lunch discount.
- Outside the promotion window, existing pickup and staff discount behavior remains unchanged.
- Client-side totals are informational only; the server recalculates and persists the authoritative discount and total.
- The order receipt and staff order details must expose the applied discount clearly.

## Decisions to confirm before implementation

- Whether the lunch discount applies to both delivery and pickup (assumed yes because the offer says the entire menu).
- Whether promo codes and staff discounts are also mutually exclusive with the lunch discount, or whether the explicit non-stacking rule applies only to the pickup discount.
- Whether the promotion window should be interpreted as [11:00, 15:00), i.e. orders at exactly 15:00 are not eligible.

## Required regression cases

- Monday–Friday: 10:59, 11:00, 14:59, 15:00.
- Saturday and Sunday at 12:00.
- ASAP order inside and outside the window.
- Preorder made during the window for 16:00 (no lunch discount).
- Preorder made before the window for 12:00 (lunch discount).
- Pickup discount is suppressed when lunch discount applies.
- Existing staff discount and promo-code precedence is preserved according to the confirmed policy.
- Client-submitted discount/total values cannot override server calculation.
