# Architecture — 2026-11-08 (clean-room one-shot)

## Product

Natally: astrologer companion. Landing (marketing) · App (atelier, natal
chart, conversation with Natally) · Souvenir (US$30 natal report keepsake).
Conversation runs on credit packs (US$5/10/25). No placeholders, no dummy
payments.

## Stack

Vite + React 19 + TypeScript strict · three.js chart · Firebase (existing
project, public web config) · Chargebee prepaid rail · OpenRouter inference on
a per-customer managed key.

## Identity

Firebase Auth, Google sign-in. Firebase ID token authenticates every billing
call. UID = customer identity. Firestore with ported-shape rules.

## Billing — Chargebee (replaces RevenueCat on the client rail)

- Client: Chargebee.js drop-in checkout for one-time charges. Prices from
  `.env` (`BILLING_OFFER_PRICE_USD=30.00`, `BILLING_CREDIT_PACKS_USD=5,10,25`);
  Chargebee item prices must equal those exact cents.
- Server: Netlify function `chargebee.mjs` on the `natally-hosted-chat` site,
  routes `/billing/{access,checkout,redeem,webhook,history,invoices/:id}`.
  Verified Chargebee webhook payments idempotently grant integer USD-micros
  allowances in the runtime Firestore ledger and raise the managed OpenRouter
  key's USD spend limit by the verified amount. Allowance = grants − posted
  usage. The existing RevenueCat-wired function stays untouched.
- Env (kstore pointers, resolved at runtime only): `CHARGEBEE_SITE`,
  `CHARGEBEE_API_KEY`, `CHARGEBEE_WEBHOOK_SECRET`, `VITE_CHARGEBEE_SITE`,
  plus `OPENROUTER_ADMIN_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `BILLING_KEY_ENCRYPTION_KEY`, `BILLING_ALLOWED_ORIGIN`.

## Inference

`completeHosted`: streaming completions on the customer's managed OpenRouter
key (free-tier chain); context = natal chart facts + conversation. Without
allowance: authored content only.

## Astrology

Swiss Ephemeris WASM (`public/vendor/swisseph/*`) computed locally; gazetteer
for birth place → coordinates/timezone. Frozen chart types in
`src/shared/types.ts`.

## Surfaces

- `/` landing: actual atelier art + mascot hero, example chart, value copy,
  offers at configured prices.
- `/app.html`: atelier scene (actual art), natal chart, chat with Natally
  (persona: warm astrologer, streaming, optional voice), account + top-up.
- Souvenir: US$30 purchase → authored + chart-facts report → PDF + retained
  interactive viewer.

## Env (public)

`VITE_BILLING_API_URL=https://natally-hosted-chat.netlify.app`,
`VITE_CHARGEBEE_SITE`, `VITE_FIREBASE_CONFIG` (public JSON),
`VITE_CREDIT_DISPLAY_PER_USD=100`.

## Release

Canonical `build_all.sh` (web-only). Datestamped staging domain deploys until
a real purchase works; production cutover is the operator's.
