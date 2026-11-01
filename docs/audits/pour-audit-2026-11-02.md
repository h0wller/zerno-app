# Pour accessibility audit — 2026-11-02

**Audited URL:** `https://friday.andcoffee.online/?brand=delivery`  
**Report timestamp:** 2026-11-01 22:15:27 UTC  
**Source:** CSV supplied in the task conversation (540 rows, 343,033 bytes).  
**Scope:** delivery brand state only. Coffee brand, authenticated roles and additional viewports are not covered by this CSV.

## Report normalization

The 540 rows are repeated selector/state observations rather than 540 independent defects:

- 1 critical finding: `form-label`.
- 27 serious findings: 15 `target-size-enhanced`, 11 `color-contrast-enhanced`, 1 `color-contrast`.
- 3 moderate findings: missing landmark treatment for `#chatFab`, `#fx` and `#scrollTopBtn`.
- 509 review-level observations: 252 `color-contrast`, 252 `color-contrast-enhanced`, plus one each for canvas alternative, reading order, non-text contrast, pause/stop/hide and focus visibility.

The contrast review rows include many repeated card descendants whose background was obscured by a translucent full-page overlay or an image/gradient. Those rows require a clean-state visual rerun; changing all affected selectors blindly would create unrelated CSS churn. The CSV also identifies image-overlay contrast as “check by eye”, not as a computed failure.

## Fix plan and verification

- [ ] Give `#dSearch` a persistent associated label; preserve the placeholder as a hint.
- [ ] Make the search field and container distinguishable from their background (3:1 boundary) and provide a visible keyboard focus indicator.
- [ ] Ensure 44×44 px targets for four `#modeSeg` buttons, `#editToggle`, `#dSearch` and nine `#deliverySubFilter` chips.
- [ ] Raise the confirmed delivery-brand contrast below AAA: venue-toggle arrow, mode segment active/inactive labels, ticker text, active delivery-rail button, delivery heading badge and update label.
- [ ] Expose the chat FAB and scroll-to-top control through labelled landmarks; mark the confetti canvas decorative.
- [ ] Remove continuous marquee movement rather than adding a separate pause control; remove the duplicated ticker copies used only for looping.
- [ ] Align topbar DOM order with the visible reading order.
- [ ] Re-run Pour with all overlays/modals dismissed and the page fully hydrated; inspect image/gradient text, footer text and every remaining `review` item by eye.

## Scope notes

The CSV was recorded as a supplied input, not copied into the repository. This Markdown file keeps the normalized report and remediation checklist. The Playwright regression spec added in this PR covers the deterministic DOM, target-size, landmark, ticker and keyboard-focus contracts. The report does not certify WCAG AAA across the whole application: repeat the audit for the coffee brand, authenticated staff states, mobile and desktop after the fixes.

## Confirmed CSS/DOM work tracked in this PR

- Search label, 44 px search field and visible field boundary.
- 44 px topbar/edit/subfilter hit targets.
- AAA delivery palette overrides for the elements called out in the serious findings.
- Visible search focus, dialog focus and structural landmarks for fixed controls.
- Static wrapped ticker and matching DOM order.
