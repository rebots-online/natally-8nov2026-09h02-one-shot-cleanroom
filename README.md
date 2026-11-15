# Natally — astrologer companion

Natally is a warm, sincere astrologer who lives in an atelier. A customer signs
in with Google, casts their natal chart once, and then talks with her: she reads
the chart aloud, explains its parts, and points at what she is talking about on
a live 3D chart beside her.

- **Landing** (`/`): the atelier scene with Natally, an example chart to explore,
  what she offers and the prices.
- **App** (`/app.html`): the atelier, the customer's own natal chart, and the
  conversation with Natally (streamed text, optional voice), plus account and
  top-up.
- **Souvenir**: a US$30 keepsake natal report, as a PDF plus an interactive
  viewer that stays available.

Conversation is paid for with credit packs of US$5, US$10 and US$25. Nothing in
the product is a placeholder: anything not configured or not yet working fails
visibly and names what is missing.

[DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) is the **codebase snapshot** — what
the code at the current commit *is*, subsystem by subsystem, with diagrams and
an exhaustive entity registry that doubles as the allow-list of names that may
be realized in code. (The 2026-11-08 intent document it replaced is preserved as
`DOCS/ARCHITECTURE.md.bak-2026-11-09`.) [CHECKLIST.md](CHECKLIST.md) translates
work into coder tasks; [DOCS/TODO-LEDGER.md](DOCS/TODO-LEDGER.md) records every
open item with its citation.

## How the two trees fit together (read this first)

The repository deliberately contains **three preserved trees next to the
clean-room rewrite**, and the running product is a composition of all of them:

| Tree | Status | What the running product uses it for |
| --- | --- | --- |
| `src/app/`, `src/astro/`, `src/chart/`, `src/commerce/`, `src/platform/`, `src/voice/`, `src/souvenir/`, `src/content/`, `src/services/`, `src/shared/` | **Active rewrite** | App shell, stage + inset card, chat + inference client, billing client, platform, voice adapter, keepsake, authored content |
| `src/landing-original/` | **Verbatim port (v1.42), operator-authorized** | The entire live landing: `marketing.tsx` self-mounts via `src/landing/main.tsx`, including its own services (billing access, authored education, soul memory, checkout catalog, supertonic voice…) |
| `src/atelier-original/` | **Verbatim copies, still live** | The 3D wheel (`Astrolabe3D.tsx`), the atelier scene components, the supertonic TTS worker, the original ephemeris pipeline (`services/ephemeris.ts`) that feeds the renderer |
| `src/onboarding-original/` | **Verbatim copy, still live** | The first-light intake questionnaire (`FirstLight.tsx`) wrapped by `src/app/onboarding/` |

Because of this, **two astrology pipelines coexist by design**: the clean-room
`src/astro/chart.ts` (which produces the frozen `NatalChart` type used by chat,
souvenir and persistence) and the original
`src/atelier-original/services/ephemeris.ts` (which produces `NatalChartResult`
for the 3D renderer). `src/chart/astrolabeInput.ts` is the bridge: the same
persisted `BirthInput` feeds both.

## The stage: two views, one card

The stage always shows both Natally and her chart — one view fills the stage,
the other lives in `src/app/stage/Inset.tsx`, a draggable, dockable,
corner-resizable card persisted per account (per guest on the landing):

- **Click swaps** the two views (a click acts on whatever hover highlighted; a
  drag only ever moves the card).
- **Size floor** is computed from usefulness — every body a ~44 px target
  (`insetFloorPx`), capped at 60% of the stage.
- **Layout by range:** dock beside the scene when there is room (the scene
  re-zooms), float clear of her face when roomy, least-overlap when tight, and
  invert (chart focused, Natally inset) when the floor cannot fit.
- Her replies carry hidden cues (`[[view:chart]]`, `[[chart:Sun;Moon]]`) parsed
  by `src/app/presentation/` and applied **as her voice reaches each passage**,
  so she drives focus, highlights and view swaps herself.

## Stack

Vite 8 · React 19 · TypeScript (strict, `tsc --noEmit` is the gate) · three.js
chart · Swiss Ephemeris WASM (vendored `public/vendor/swisseph/` +
`swisseph-wasm` server-side) with a bundled 108-place gazetteer · Firebase Auth
(Google) + Firestore · Chargebee one-time checkout · OpenRouter inference on a
per-customer managed key (free-tier model chain) · Supertonic local voice TTS ·
jsPDF keepsake export · Tauri 2 native matrix.

## Develop

Requires Node.js 24 and npm.

```bash
npm ci
npm run dev    # Vite dev server
npm run lint   # tsc --noEmit type gate
```

`.env` holds pointers only (`kstore://…`); real values are resolved at runtime
from KStore / Admin-Manual and never committed. Public settings the browser
needs: `VITE_BILLING_API_URL`, `VITE_CHARGEBEE_SITE`, `VITE_FIREBASE_CONFIG`,
`VITE_CREDIT_DISPLAY_PER_USD`.

## Build and deploy

From the repository root, run the single supported build-and-deploy command:

```bash
./build_all.sh
```

The script performs the whole pipeline: resolves the configured credentials,
automatically increments the shared `MAJOR.MINOR.BUILD` version, commits and
pushes that stamp, validates the source, builds the web assets, publishes both
purchased domains with HTTPS forced, then packages Linux, Windows and Android.
Use this entry for every attempt, including a retry after a fix. Version numbers
are assigned by the script. The native application namespace is
`mba.robin.astronatally`.

### Surge deployment account and domains

The existing Surge deployment account is **`robinsai.world@gmail.com`**
(Free plan; ownership of both domains verified on 2026-11-11). Run the pipeline
with that account's authorized Surge CLI context. Keep its token/password in
private credential configuration, outside this repository.

| Public destination | Purpose | Expected DNS target |
| --- | --- | --- |
| `astronatally.com` / `www.astronatally.com` | Landing and atelier introduction | `geo.surge.world` |
| `asknatally.online` / `www.asknatally.online` | Web app | `geo.surge.world` |

Wildcard CNAME records, where configured, use that same target. The spelling is
`geo.surge.world`, with one `geo`. The pipeline publishes the named purchased
domains directly. Surge manages their custom-domain certificates; correct DNS
routing and valid certificates are both required for HTTPS.

### Outputs and verification

The web bundle includes the app, preserved landing entry and
`/auth/native.html` browser handoff. Web publication must succeed before native
packaging starts. Native outputs are staged under `dist/natally-v<version>/`
with a SHA-256 inventory and per-target logs: Linux AppImage/deb/rpm, Windows
x64 executable/NSIS/MSI, and signed Android arm64 APK/AAB plus native symbols.
A failed or incomplete target remains recorded in the inventory; it is not a
complete platform set. Verify the actual version badge on both deployed sites
and report the produced artifacts and any failed targets. Build success and
functional sign-in/reading acceptance are recorded separately in CHECKLIST.md.

## Billing and inference (server)

**Legacy implementation reference:** the Netlify routing below is deprecated
by the operator's direct per-user OpenRouter-key decision. It describes the
remaining source wiring, not an instruction to deploy another Netlify service.
The current migration and functional verification status is in CHECKLIST.md.

The Netlify function `netlify/functions/chargebee.mjs` (site
`natally-hosted-chat`, locally hostable via `billing/server.mjs`) serves:

| Route | What it does |
| --- | --- |
| `GET /billing/access` | Bearer Firebase ID token → allowance + managed-key state |
| `POST /billing/checkout` | `{kind, amountUsdMicros, requestId}` → Chargebee hosted page |
| `POST /billing/redeem` | grant-code redemption |
| `POST /billing/webhook` | HMAC/Basic-verified Chargebee webhook → idempotent grant + key-limit raise |
| `GET /billing/history` | grants + posted usage |
| `GET /billing/invoices/:id` | owner-checked Chargebee invoice |
| `POST /billing/chat` | SSE passthrough on the customer's managed OpenRouter key; actual spend posted to the ledger |

Allowance = grants − posted usage, integer USD-micros in Firestore
(`natallyCreditGrants` − `events`), with managed keys encrypted at rest
(AES-256-GCM). When a turn has no allowance left, Natally asks in her own
voice and the top-up sheet opens. A second function,
`netlify/functions/ephemeris.mjs`, serves signed swisseph positions/houses.

## Process

`DOCS/ARCHITECTURE.md` (snapshot + registry allow-list) → `CHECKLIST.md` →
coder agents → `build_all.sh` → version badge verified on both hosts. Coders
read the architecture, the checklist, the TODO ledger and the files they edit.
Work is recorded in the ledger and acted on only when Robin says go.

## License

AGPL-3.0-only.
