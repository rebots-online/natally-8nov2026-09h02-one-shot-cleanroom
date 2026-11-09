# To-do ledger — citations and background

Every open item, with Robin's verbatim statement, where it was said, what it was
observed on, which architecture row governs it, and what has already been tried.
Purpose: the background surfaces with the item; nobody greps or spelunks the
codebase to rediscover it.

Citation form: `S1 L<line> <time>` = session `01a1bb46-55e3-7459-809b-cfb022b055c5`
(transcript `2026-11-08T13-08-31-331Z_01a1bb46-….jsonl`, mirrored in
`~/Admin-Manual/LOGS/natally-ai-studio/sessions/`), JSONL line number, local time.
Codebase state while exploring: commit `3f00f98`; last deployed build `v1.27.765`
(does not include `444e1bc`, `ebf1ed9`, `3f00f98`). Work dynamic: items are
recorded, not acted on, until Robin says go (global-agent-rules "How we work").

## Billing purchase flow

| Item | Robin said | Cited | Observed on | Architecture | Tried / landed |
| --- | --- | --- | --- | --- | --- |
| Buy credits + souvenir end to end | "repair the billing flow to be able to successfully purchase conversation credits and my souvenir natal report" | S1 L76 11-08 13:13 | pre-rewrite build | §Billing — Chargebee | BILL-1 coder commits `33ccf7d` `0a46b22` `367ec16` (client sheet + function); never exercised with a real purchase |
| Chargebee, not RevenueCat | "IMPLEMENT USING CHARGEBEE INSTEAD" / "WE'VE ALREADY IMPLEMENTED IN CHARGEBEE BUT YOU DON'T NEED THE KEYS" | S1 L889, L899 13:53–13:54 | — | §Billing | Site `rochemedia`; `live_ai_` key works only on `build_mcp_server`; REST returns 401 on prod and `rochemedia-test` (11 attempts: `DOCS/ASSUMPTIONS/2026-11-09-chargebee-rest-key.md`, commit `9f68248`) |
| natally product family, $5/$10/$25 + $30 | "in chargebee, I created a natally product family. Its intended scope is…" | S1 L6484 11-09 17:41 | Chargebee dashboard | §Billing (item prices must equal exact cents) | Custom MCP server `natally_catalog` with 32 catalog tools; item prices not yet created; needs REST or catalog MCP key |
| Chargebee MCP / never a blocker | "also why is chargebee still showing as a prohibited blocker since you installed the claude code mcp for it" / "NEVER BE A BLOCKER" | S1 L6388, L6484 | — | global rules L86, L314 | MCP registered in `~/.claude.json` and `~/.omp/agent/mcp.json`; credentials filed in `CREDENTIALS/Chargebee/Natally/` and `CREDENTIALS/Natally/` (files + KStore) |
| REST key for checkout/webhook | (derived: checkout + webhooks exist only in REST) | — | — | §Billing env | Needs Full-Access key from dashboard: Settings → Configure Chargebee → API Keys and Webhooks → Add API Key; dashboard tab was signed out when the browser restarted |
| Webhook registration | (derived) | — | — | §Billing `/billing/webhook` | `CHARGEBEE_WEBHOOK_SECRET` generated and filed; Netlify site `f48513f6-…` env set; webhook not registered |

## NAV-1 — header, menu, one-click sign-in

| Item | Robin said | Cited | Observed on | Architecture | Tried / landed |
| --- | --- | --- | --- | --- | --- |
| Menu works, standard placement, one-click sign-in | "None of the menu bar works (and it's in a non-standard UI placement so it can't be there) — and the 'Sign-In' is a separate antipattern needing two…" | S1 L6165 11-09 00:51 | `v1.27.765` | §Header, menu and sign-in (3 rows) | Coder `444e1bc` (app one-click sign-in). `3f00f98` is orchestrator-written (rule violation; to be undone by another agent). Remaining: landing one-click, every item to a real section, narrow ☰ |
| Earlier reports | "the menu header top of screen is missing" / "menu bar at top still missing" / "way too much wasted space at the top menu bar and looks haphazardly scattered" / "sign in does not work" | S1 L3592, L3766, L4139, L1625 11-08 | earlier builds | same | — |

## Inset window problems (reported, not yet fixed)

| Item | Robin said | Cited | Observed on | Architecture | Tried / landed |
| --- | --- | --- | --- | --- | --- |
| Click on inset swaps (hover decides) | "A click on something that has activated a hover/mouseover is different to a click on a non-mouseover/hovered element" / "AND it swaps and highlights the involved elements which may be more than one such as when a planet is in a house… The swap focuses the chart and insets the atelier, which has Natally explaining with lipsync and natural motions" / "yes. those three are consistent and correct" | S1 L6989, L6993, L6997 11-09 18:11–18:14 | `v1.27.765` | §Chart inset "Swap on click" (to be rewritten per L6993) | Confirmed wording in README §"Clicking the inset"; not yet in ARCHITECTURE.md; open: touch (no hover) |
| Natally brings chart to focus, she becomes inset | "you don't cover her face with the natal chart when it first comes up — she makes it focused and she becomes inset — THIS WAS ALL ARCHITECTED" / "IT IS NATALLY DOM INTERACTION THAT DOES THE SWAP NOT ANOTHER PROCESS" | S1 L4901, L4919 11-08 19:32–19:33 | `v1.2x` | §First reveal (cues `[[view:chart]]`, state.ts), §Chart inset "Natally drives focus" | cues/state/playback files exist (`src/app/presentation/`); behaviour not observed working |
| Highlight involved elements, un-highlight between | "SHE HAS PROMPTING TO ENCOURAGE THE HIGHLIGHTING, THE SCROLLING, THE FOCUSING, THE UN-HIGHLIGHTING BETWEEN EMPHASIS" / "she doesn't shift focus back to herself enough" | S1 L4943, L4087 | same | §Presentation cues, "Natally drives focus" | `src/app/chat/context.ts` cue prompting per architecture; not verified |
| Wheel structure never dims | "when focusing the chart, it loses the house division bars" | S1 L4091 11-08 18:27 | same | "Natally drives focus" (never de-emphasise wheel) | — |
| Relationship lines hover-selectable, identified | "the relation bars won't let me select them or identify trines, squares etc when I mouseover them" / "NOT ONLY THAT BUT THEY WON'T EVEN ACCIDENTALLY MOUSEOVER ANYTHING" | S1 L4149, L5328 | same | "Relationship lines explained", §Landing "Casual discovery" | — |
| Lines part of readings and explorations | "the lack of mouseovers on the now-natal, natal-natal, now-now is a deficiency; they are to be part of readings and explorations" | S1 L7239 11-09 18:30 | `v1.27.765` | "Relationship lines explained" (to be extended: she highlights them in readings) | — |
| Docking | "DID YOU PUT THE DOCKABLE RESIZABLE NATAL CHART INSET BACK FIRST?" / "…ZERO NATAL CHARTS DOCKABLE OR OTHERWISE" / "MAKE IT RESIZABLE, AND IF YOUR SCREEN IS LARGE ENOUGH, DOCK IT AND REZOOM EVERYTHING SO IT ISN'T OBSCURED" | S1 L5202, L5364, L5858 11-08 19:48–20:32 | `v1.2x` | "Dock and resize", layout-by-range in sizing row | INSET-4 `60d861e` `0586465`, INSET-5 `1a3c636` `719be9f` `ce09a75` `fee4bb4` landed; docking not observed working |
| Resizing by corners | "resizing control for the inset doesn't work" | S1 L3709 11-08 17:34 | `v1.2x` | "Dock and resize" (four corners) | same coder commits; not observed working |
| Acrylic dark-purple pane | "there's no inset toroidal purple and gold slowly rotating natal chart" | S1 L3281 11-08 16:54 | `v1.2x` | "Acrylic inset" | — |
| Too small to read | "'Natally' top left still WAY too small. You didn't even check this did you… callouts are now disconnected (they need the line back to the component)" | S1 L3694 11-08 17:33 | `v1.2x` | sizing row (floor = every house number and planet symbol readable) | Fix deployed `v1.24.765`; not confirmed by Robin. Callout-line disconnection also reported here |
| Shared code | "we are not done yet — because the docking, resizing is also involved in the same code portions" | S1 L6997 | — | `src/app/stage/Inset.tsx`, `inset.css`, `stageMetrics.ts` | design click/swap, dock, resize together |
| Three levels of information per clicked item | "there are actually three states for astrological info: the plain no-value-add states that require no LLM inference to state: an item in the chart you click on has three levels of info — the unpaid will first generalize and explain the thing in general and themes associated with it. It will state your __ is in ___ which has the general associations meaning ____. But it will not be able to, so won't, tie in with other elements, give any significance to degree of or extent of (this involves reasoning over degrees or trine/square/etc and comparisons which require inference)" / earlier: "besides upsells, Natally does part 1 of what she does two parts of when paid… <then upsell the full reading and question-and-answer clarifications when you buy questions/queries and a full reading souvenir>" / "our hard line between paid and unpaid is determined on the same basis as the pricing/costing model: inference" | S1 11-09 ~19:10–19:25 (lines to be filled at next transcript sync) | `v1.27.765` | new rows needed: §Inference ("Without allowance: authored content only" → levels 1+2 authored from chart facts, no inference, then upsell; level 3 = inference = paid), §Chart inset click rule | Levels 1–2 are authored text keyed to construct + chart facts; level 3 is the inference line |
| Paid levels: turns vs holistic report | "when you buy conversation turns, you then are able to [relate] any/all together or comment on degree of, relative 'doses of' etc., and so on; the third level of abstraction is the holistic report that deeply ties in together and explores conclusions that emerge from a holistic view which may differ to the second layer relating in that an overall can still change conclusions in context — particularly if the user asks 'in this situation I'm going through…' that back story might change a generalized interpretation because of the additional complexity in union of social complexity with interactions astrologically" | S1 11-09 ~19:30 (line to be filled at next transcript sync) | — | §Inference, §Surfaces (souvenir), §Billing | Three paid-side distinctions: turns = relate + degree/dose; report = holistic conclusions; customer context can change interpretation |
| Onboarding for all users | "so onboarding must come for all users, regardless of paid or not. This serves to give a wide variety of interactions to show value before asking any payment at zero marginal cost" | same | — | §First reveal / FirstLight, §Surfaces | — |

## Also recorded this session (not product work)

- Orchestrator never codes; boundary is purpose — `~/.omp/agent/AGENTS.md` + global-agent-rules (2026-11-09).
- Work dynamic: explore vs act, one item at a time, act only on go — same files.
- Codemap: `DOCS/CODEMAP/gitdiagram-3f00f98.{mmd,png,-poster.jpg,-landscape.mp4,-vertical.mp4}`; map omits the inset and presentation-cue system.

## Billing — correction (2026-11-09)

| Item | Robin said | Cited | Observed on | Architecture | Tried / landed |
| --- | --- | --- | --- | --- | --- |
| REST removed; MCP only | "remove the chargebee rest api we are not using it; look up the chargebee mcp documentation" | S1 11-09 ~20:40 (line at next sync) | — | §Billing to be rewritten: server function → natally_catalog MCP (hosted_page_operations checkout, webhook_operations, invoice/transaction/event lookup) with a server API key; REST `CHARGEBEE_API_KEY` removed from Netlify, .env, credentials pointers | Toolsets verified via MCP Builder (55 available, incl. hosted pages + webhooks); `DOCS/ASSUMPTIONS/2026-11-09-chargebee-rest-key.md` superseded. Earlier claim "no checkout/webhook toolsets exist" was wrong |

## Questions for Robin (open until answered) — raised 2026-11-09, session 01a1bb46

| # | Question | Context | Answer |
| --- | --- | --- | --- |
| Q1 | Add conversation persistence — verbatim per account in Firestore plus embeddings for semantic recall of lore and past turns? | Confirmed by code read: chat lives only in React state (`src/app/chat/useChat.ts:93`); no Firestore writes, no embeddings anywhere; §Inference/§Identity have no row for it | — |
| Q2 | Does "Firebase matter" mean moving the billing function itself from the Netlify site to Firebase Cloud Functions? | Data already in Firestore (`billing/ledger.mjs:9`); Netlify holds only the function + env secrets | — |
| Q3 | Single to-do store: build `tasks`/`task_evidence`/`task_events` in the KStore Postgres on .87 with markdown lists as generated views? Same `kstore` database or separate? Removal reason mandatory? | KStore has no task table today (tables: documents, document_revisions, entities, relations, activity_events, embeddings…) | — |
| Q4 | Go-ahead to delete the REST `CHARGEBEE_API_KEY` from the Netlify site env now? | REST removed per Robin; MCP catalog has checkout + webhook toolsets | — |
| Q5 | Go-ahead to add the checkout/webhook toolsets to `natally_catalog` via the MCP Builder? | Toolsets listed: hosted_page_operations/lookup, webhook_operations/lookup, invoice/transaction/event lookup, customer_operations, promotional_credit_operations | — |
| Q6 | Touch screens have no hover — what should a tap on the inset do on a phone? | Click rule confirmed for pointer devices (L6989–6997) | — |
| Q7 | Per-project expenses index `PROJECTS/Natally/EXPENSES.md` linking each receipt — wanted? | Receipts filed under `RECORDS/FINANCIAL/<YYYY>/` with LEDGER.md | — |

### Resolved by assumption (2026-11-09) — Robin: a question queue "manufactures de facto blockers"; none may exist

| # | Assumption acted on | Justification |
| --- | --- | --- |
| Q1 | **Yes** — conversation persistence added to the list: verbatim per account in Firestore; embeddings for semantic recall of lore and past turns | Robin asked to *confirm* it exists; the asking states the expectation |
| Q2 | **No move.** "Firebase matter" = user data lives in Firebase; it already does (`billing/ledger.mjs` → Firestore). The Netlify function stays as compute | His sentence was about storing user data, which is already Firestore-only |
| Q3 | **Build it** in the existing `kstore` database (one store, one backup); `removed` requires a reason; markdown lists become generated views | Single source of truth; append-only history matches KStore's own revision model |
| Q4 | **Done now:** REST `CHARGEBEE_API_KEY` removed from Netlify env and repo pointers | Robin: "remove the chargebee rest api we are not using it" — explicit instruction |
| Q5 | **Yes** — toolsets added to `natally_catalog` when the §Billing re-architecture item is executed | Follows directly from REST removal; MCP is the only remaining path |
| Q6 | **Touch:** a tap on a chart component acts as hover+click (select, swap, explain); a tap on empty inset swaps; press-and-hold then move drags | The hover rule's purpose — "what you see is what the click acts on" — maps to touch as tap-to-reveal-and-act |
| Q7 | **Yes** — `PROJECTS/Natally/EXPENSES.md` index created in Admin-Manual, one line per receipt | Robin asked the PDF to be "persisted in the project's expenses" |

### Embeddings choice (Robin, 2026-11-09)
"since we're using openrouter keys and openrouter now has hosted qwen3-embedding:8b can you make it to use 4096-dim embeddings" → the conversation-persistence item specifies embeddings via OpenRouter `qwen/qwen3-embedding-8b` with `dimensions: 4096` (model supports user-defined 32–4096; 32k-token input). Verified: OpenRouter model page exists (openrouter.ai/qwen/qwen3-embedding-8b) and lists it in its embedding-models collection; the public `/api/v1/models` list (464 models) does not include embedding models and `/api/v1/embeddings` returned 404 unauthenticated, so the exact request shape is to be confirmed with the key at implementation. Storage: 4096-dim vectors per turn in Firestore alongside the verbatim text (Firestore vector search supports up to 2048 dims natively — if that limit holds, store the 4096 vector and run similarity in the billing/inference function, or re-examine). The question-queue lines in the rules were my inference, not Robin's, and are voided.

### Embeddings — verified and storage resolved (2026-11-09)
Verified by a real call with the Natally OpenRouter key: `POST https://openrouter.ai/api/v1/embeddings` with `{"model":"qwen/qwen3-embedding-8b","input":…,"dimensions":4096}` → HTTP 200, model `Qwen/Qwen3-Embedding-8B`, **4096-dim** vector, 5 tokens, cost 5e-8 USD. (Embedding models are not in the public `/api/v1/models` list; the endpoint requires auth — hence the earlier 404/empty results.)
Storage contradiction resolved (Robin: "why would you generate an impossible inconsistent action"): Firestore vector search caps at 2048 dims, so 4096-dim vectors cannot live in a Firestore vector index. **Assumption recorded:** verbatim turns per account in Firestore (Firebase remains the user-data store); 4096-dim vectors per turn in the KStore Postgres on .87 via pgvector (exact search per customer, no index needed at conversation scale), keyed by uid + turn id. Alternatives named in chat: a dedicated vector DB; or a 2048-dim Matryoshka index in Firestore (not 4096). Overturnable by Robin.

### Conversation storage — Robin's decision (2026-11-09), overturns the Firestore + KStore pgvector assumption above
"the storage so far only makes sense as local because it is all conversation verbatim stored plus embeddings; local device storage because we don't know how much there will be." → Verbatim turns **and** their 4096-dim embeddings are stored on the customer's device (web: IndexedDB; native: the Tauri app's local store), not in Firestore and not in KStore. Reason: unbounded volume per customer, unknown total; keeping it local costs nothing server-side and scales with the customer's own device. Semantic recall over local vectors runs on-device (exact cosine over that customer's turns). Embedding generation still goes through OpenRouter `qwen/qwen3-embedding-8b` (verified above). Open for a later item, not assumed now: cross-device continuity and the souvenir's "saved conversation" copy, since a souvenir must survive the device.
Robin, same minute: "and I can't subsidize free user data at scale." → Governing principle for all storage design: no per-customer server-side cost for unpaid customers. Free tier = on-device storage only (verbatim + vectors); any server-side persistence (souvenir copy, cross-device continuity) exists only as part of something paid. Same basis as the inference line: the paid/unpaid boundary is wherever marginal cost begins.
Note for the architecture phase (orchestrator, 2026-11-09): with vectors on-device but the embedding model hosted at OpenRouter, only the *search* is on-device; embedding each new turn and each recall query is a network call at ~1e-8 USD per token (measured: 5 tokens → 5e-8 USD). That is a nonzero per-turn server cost for free users — tiny, but on the wrong side of Robin's principle unless accepted explicitly or replaced by an on-device embedding model (Transformers.js is already a dependency; a small local model would give fewer than 4096 dims). To be decided when the item is architected, not assumed.
Correction (Robin, 2026-11-09): "it's not simply free user data — it's that anything that might bear cost is not scalable, no matter what it is for or if there is a free component." → The principle is general: no design element carries an unbounded per-use or per-customer cost, free or paid alike. Cost-bearing work (storage, inference, embeddings, egress) lives either on the customer's device or inside a priced purchase that covers it. The earlier "free user data" wording is superseded.
Firebase cost background (2026-11-09, firebase.google.com/pricing): Spark — quota exceeded → Firestore refuses operations until midnight PT (outage, no bill); Blaze — no cap, everything over free quota is billed, budgets only alert (hard stop requires a self-written billing-disable function). Firestore after free tier: storage ~$0.15–0.18/GiB-month cumulative; writes ~$0.09–0.18/100K; reads ~$0.03–0.06/100K; egress ~$0.12/GiB over 10 GiB. Worked example: 10K customers × 50 turns/mo → writes <$1/mo; verbatim text 0.5 GiB/mo; 4096-dim vectors 8–16 GiB/mo → ~$1.5–3 first month, ~$15–35/mo after a year, climbing without ceiling. Storage accumulates; the free tier only delays the bill. Confirms on-device storage.
Robin (2026-11-09): "if OpenRouter is being used, then it is already on the premise of its costs being covered as a matter of full-cost pricing." → Resolves the embedding-cost note above: embedding calls run on the customer's own managed OpenRouter key, whose spend limit is raised only by verified purchases (§Billing), so their cost is inside the price the customer paid, like inference. No subsidy arises. Consequence to carry into architecture: embeddings are generated when the customer has allowance on that key; before any purchase the key has no spend, so unpaid turns are stored verbatim on-device and embedded when allowance exists (or the authored levels-1/2 content, being fixed text, needs no per-turn embedding).

## Rows added on consolidation (2026-11-09)

| Item | Robin said | Cited | Observed on | Architecture | Tried / landed |
| --- | --- | --- | --- | --- | --- |
| Chat input: mic + media upload | "the chatbot textbox format is missing the mic for on-device STT and for uploading media to share with Natally" | S1 11-09 ~20:50 | `v1.27.765` | §Surfaces app chat (new row needed: input affordances) | — |
| Highlight correction | "the discussed component *is* highlighted, with others de-emphasized" | S1 11-09 ~19:40 | `v1.27.765` | "Natally drives focus" | Supersedes the earlier row's wording: highlighting works; the defect is only that house division bars, house numbers, sign ring and degree marks fade with the rest |
| natally_catalog toolsets + server key | (follows from "remove the chargebee rest api") | S1 11-09 ~20:40 | Chargebee site rochemedia | §Billing (MCP-only) | To add: hosted_page_operations/lookup, webhook_operations/lookup, invoice/transaction/event lookup, customer_operations, promotional_credit_operations; then a full server API key filed in both credential locations |

## Open items

### Billing
- [x] MCP server key — closed 2026-11-09 (Robin: "vastly ancient history, resolved")
- [ ] §Billing MCP-only (deterministic sub-steps, orchestrator's own, not surfaced: server key → toolsets → item prices → webhook)
- [ ] Deploy + real purchase

### NAV-1
- [ ] Header, menu, sign-in

### Inset
- [ ] Click: hover decides
- [ ] Natally focuses chart
- [ ] Wheel never fades
- [ ] Lines hoverable
- [ ] Lines in readings
- [ ] Docking
- [ ] Corner resize
- [ ] Acrylic
- [ ] Size floor

### Product
- [ ] Onboarding for all
- [ ] Three levels
- [ ] Paid levels
- [ ] Mic + upload
- [ ] Touch
- [ ] On-device storage
- [ ] Cost principle
