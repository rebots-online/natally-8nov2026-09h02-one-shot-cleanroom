# Chargebee runtime publication observation rubric — draft, 2026-11-16

Existing required behavior: DOCS/ARCHITECTURE.md section 9 and CHECKLIST.md BILL-1. This is an observation protocol, not implementation permission or a successful-payment claim.

1. The published app and every native package use the exact approved current Chargebee runtime URL and existing Chargebee site. A health response from the older RevenueCat/Stripe runtime is not acceptance.
2. A real signed-in account with no allowance is offered the existing USD5, USD10 and USD25 packs and USD30 souvenir. Every hosted checkout is produced by the current billing/chargebee.mjs for that account, with the correct item, currency and amount.
3. The real Chargebee lightbox opens. Cancellation returns to the app without a grant; provider/configuration/network errors stay visible and truthful.
4. A real paid invoice generates the actual Chargebee payment_success event, received by the published current webhook route. No synthetic event, fabricated customer, fake successful charge or manual ledger grant substitutes.
5. That event creates one account-owned grant in the existing declared Firestore ledger and updates the existing managed OpenRouter allowance. Provider retry does not double-grant; a failed upstream update is observed truthfully.
6. The customer allowance refreshes and the intended conversation resend works. The USD30 souvenir also produces its required retained interactive report and PDF.
7. Record the end-to-end customer observations as a screencast with secret/payment fields excluded, retain the actual invoice/event identifiers and observed ledger identity privately, and distinguish every unobserved checkpoint. A successful compile or HTTP401/204 is not payment acceptance.

Payment authorization remains a separate final checkout action; do not invent payment details or an approved charge.
