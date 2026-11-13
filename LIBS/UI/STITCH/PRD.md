# Natally — the live atelier

Repository: **rebots-online/astronatally**. Revision: 2026-11-13.
Status: **FROZEN**, with the actual 52-state Stitch export and binding/hash
manifest attached to ARCHITECTURE §24.6. Baseline source is commit04322e9, represented
in [the new current-UI Stitch project](https://stitch.withgoogle.com/projects/6919345441915622012).

## Product and adoption hypothesis

Natally is an astrologer companion whose character, responsive room, spoken
reading and manipulable three-dimensional chart are the experience. The visitor
can see her explain the thing they selected before deciding to make their own
chart or pay for conversation. That observable connection is the product's
evidence. A paragraph claiming a special experience cannot substitute for it.

The target is a curious astrology visitor who enjoys character-led discovery,
wants to understand their own chart, and distrusts interchangeable promises of
instant insight. A returning customer values continuity, a readable chart and
conversation that gets to their question. The recommendation hypothesis is
specific: someone can show a friend the actual living atelier and a chart
interaction, then share the product address without explaining an onboarding
wall. This is a design hypothesis, not a claim of market validation.

The intended sequence is experience → personal chart → useful conversation →
optional purchase/keepsake. Birth details and authentication serve the personal
chart; they do not become entrance gates to experiencing Natally. Prices are
findable before purchase, not repeated across the first viewport. No testimonials,
invented social proof, countdowns, scarcity, dependency or simulated purchases.

## Nonnegotiable rules

**P01 — presence.** Show the actual live scene from first paint onward. No welcome
modal, duplicated Natally portrait, splash presentation, fullscreen dimmer or
marketing panel across her face or ball. Forms and account tasks share the same
place as conversation rather than replacing the room. The system browser's own
authentication UI remains external to this composition.

**P02 — evidence.** Keep the existing live demonstration chart and authored tap
explanations available to guests. Show a personal chart only after real input and
calculation. A demonstration is never represented as a visitor's calculated chart.
Do not introduce a second wheel, fake reading, seeded allowance or placeholder.

**P03 — earned space.** Each word must identify an action, necessary input,
meaningful chart fact, actual result, price or actionable state. Use one heading
per task, one primary action, persistent field labels and concise inline feedback.
Natally's spoken prose may retain her personality; surrounding interface copy
must not repeat it. Her likeness belongs to the scene, never a second logo.

**P04 — discoverability without exposition.** Standard header/menu placement,
visible close/back actions, focus indication and real navigation destinations.
Do not label, hint at or disclose the room's hidden interactions or trinket rules.
Chart targets retain their existing hit labels, hover and spoken explanations.

**P05 — honest state.** Loading is not zero allowance; an API error is not an
empty account; a closed checkout is not a payment. Keep required facts and
provider failures truthful. Never promise storage or a capability the wiring
does not actually provide. Technical implementation details stay out of normal
flows; an actionable configuration failure may identify what is missing.

**P06 — fixed function.** Freeze the existing astrology, presentation, voice,
Firebase auth, paid allowance, Chargebee, native handoff and PDF contracts in
the architecture. This revision changes their screen composition and necessary
bindings. It does not redesign the services, invent mic/media workflows, add
ZIM support, alter pricing, migrate storage or substitute a billing provider.

**P07 — faithful production.** Implement the actual newly exported Stitch
markup, assets, typography, spacing and state designs. Retain exports unchanged.
Freeze the PRD, architecture, screen IDs and hashes together before UI coding.
After freeze only documented platform adaptations are allowed. Conformance is
required; it does not certify that the design has achieved commercial success.

## Shared composition and every shared element

Desktop uses a compact header, a live stage occupying the majority of the
available width, and a narrow task rail beside it. The rail is the only place
for invitation, forms, transcript, account or purchase details. It never floats
over the stage. At phone widths the same ordering becomes header → persistent
room/chart band → caption → task rail. The document has one vertical scroll;
long forms remain reachable without a second nested phone scroll region.

| Element | Function, appearance and placement | Why it earns the space |
| --- | --- | --- |
| `Natally` wordmark | Text only, left in a 52px desktop/48px phone header; existing distinctive display face, cream | Identifies a product someone can remember and recommend; no repeated portrait or tagline |
| Section navigation | Desktop compact text destinations; phone Menu button opens navigation in the rail | Gives a conventional route to existing content without a second header or oversized masthead |
| Account control | Rightmost header button; real customer photo at32px, circular, contained inside44px target; text fallback if absent | Recognizable identity and account entry; bounded dimensions prevent the screenshot's header expansion |
| Allowance | Signed-in header/account, actual formatted balance or explicit loading/error | Lets the customer decide whether to buy; no invented available credit |
| Sound/voice controls | Existing stage control group at its edge,44px targets, icon plus concise accessible state | Audio needs user control; the entire room remains the source of atmosphere |
| Live atelier | Existing registered room artwork, animation and interactive objects in dedicated stage slot | The USP is directly experienced; no substitute stock scene or character generation |
| Live chart/inset | Existing interactive wheel and movable/dockable inset; stage-relative geometry and a small grip | Supports pointing, manipulating and explaining; existing focus/swap semantics remain intact |
| Caption | Separate two-line stage-foot band, cream text and current spoken word in luminous warm yellow | Makes the real voice readable without a wall of transcript obscuring her |
| Task rail | Muted dark plum acrylic,16px radius,1px muted-brass edge,24px desktop/20px phone padding | One consistent work surface joins tasks to the atelier; contrast makes fields readable while preserving the atmosphere |
| Rail heading | One compact24px task title, not a repeated welcome or oversized marketing headline | Identifies what the current task is |
| Back/Close | Quiet44px controls in rail heading row; retain draft where existing behavior does | Recovery and control are necessary; they never become a fullscreen blocker |
| Primary action | One warm brass-filled button, dark ink text,48px minimum height | Shows the single next task; no competing hero CTAs or decorative glow |
| Secondary actions | Understated text/outline controls within the same rail | Necessary alternatives remain available without competing with completion |
| Inputs | Label above,16px body text,48px field, error below; logical keyboard and autocomplete | Labels survive typing; large targets prevent accidental taps and phone zoom |
| Actual pending/error state | Inline beside relevant task; skeleton or honest elapsed time, retry when supported | Explains a real wait/failure without manufacturing completion or interrupting the room |
| Voice progress | Small translucent status area outside face/ball/chart controls; actual MB, percentage, preparation and retry | A substantial local voice download needs visible progress; it cannot resize the viewport or block experience |
| Version | Quiet small monospace tag at lower utility edge, five-digit displayed build | Supports identification without stealing hierarchy from Natally; no oversized badge |
| Privacy/Terms | Small utility links after task content; readable utility view | Gives real legal access without entrance consent theatre or promotional filler |

## Complete screen and state specification

Every state below uses the shared composition; a provider popup or native
handoff is the documented exception. The new Stitch exports must include the
primary desktop and phone compositions and each task family's state variants.

### S01 — guest atelier and existing information sections

The live room and demonstration wheel are usable immediately. The initial
rail has title **Your birth chart**, body **Tell me when and where you were
born.**, primary **Cast my chart**, and small cost line **Free · No card needed**.
The title identifies the tangible result; the sentence asks for the actual
calculation inputs; the button names the action; the cost line removes a real
purchase uncertainty. There is no First Light label, duplicate greeting, mascot,
browser-audio advice or promotional claim.

The existing six section destinations remain Meet Natally, Your chart, Reading
aloud, Personal readings, Prices and Learn astrology. Their rail pages contain
one idea, at most two short sentences. Previous/Next moves to a real adjacent
section; directions disappear at the ends. There is no second scrolling feed.
Your-chart/reading pages bring the existing live wheel forward; leaving returns
the atelier. Selection uses the same authored speech/presentation path as today.
The exact concise factual copy is frozen in the exports. Prices remain: chart
creation free; conversation packs US$5/US$10/US$25; keepsake US$30. Do not promise
cloud history or retained cross-device conversations. A footer may carry the
existing entertainment-purpose notice once; do not repeat it in the experience.

### S02 — sign-in and its six views

**Choose:** title **Save your chart**; **Continue with Google**, **Continue with
email**, **Continue with SMS**, Close. The heading explains the immediate value
of identity. Each labelled method starts its actual existing flow; Google starts
the popup on that click. Do not ask for a second generic Sign in click.

**Email:** title **Sign in**; Email and Password labels; primary **Sign in**;
secondary **Create account**, **Forgot password**, Back. **Create account** has
Email, Password, Confirm password; primary **Create account**, Back. **Reset**
has title **Reset password**, Email, **Send reset email**, Back and the existing
neutral actual-result message. Password rules and validation remain Firebase's.
Every field is necessary to the selected provider operation; no photo or
astrology sales copy accompanies these forms.

**SMS:** title **Sign in by SMS**, Phone number field, real reCAPTCHA container,
existing SMS consent/rates notice, **Send code**, Back. **Code:** title **Enter
your code**, six-digit Code field, **Verify code**, **Resend code**, **Change
number**. Consent and verification controls exist for the actual phone operation,
not decoration. Pending disables only the active submission. Keep actual
invalid/expired/quota/network/disabled-provider failures inline. Switching or
closing disposes the existing phone session. No passwords, codes or tokens
persist. Landing Email/SMS follows the existing app-origin handoff; no credentials
travel in a URL. On success, auth observation owns the transition.

### S03 — signed-in first visit

Natally stays visible and active. The rail title is **Your birth chart**, with
**Let’s find your sky.** and **Cast my chart**. One short invitation bridges
to the intake without repeating her name, appearance or a fictional table
preparation. Account/Menu stay available. There is no overlay, compulsory
welcome tour, dismiss-before-interacting step or second likeness.

### S04 — birth details

Retain the existing validated intake as compact sequential rail fields with
a visible current-step indication, Back and one Continue action. Questions
appear immediately; decorative typewriter timing must not hide a usable field.

| Field/view | Exact principal label/action | Specific purpose and layout |
| --- | --- | --- |
| Name | **What should I call you?**, Name, **Continue** | Personal address in existing reading; one field directly under question |
| Birth date | **When were you born?**, **Birth date (YYYY/MM/DD)** and existing calendar, **Continue** | Preserve the actual typed date widget and its month/day/year chooser; the explicit format avoids locale ambiguity and the calendar remains optional assistance |
| Birthplace | **Where were you born?**, Birthplace search, actual suggestions and confirmed place, **Continue** | Coordinates and historical IANA zone; chosen location remains visible with Change action |
| Time | **What time were you born?**, Birth time, existing **I don’t know** option, **Cast my chart** | Real angles/houses depend on time; unknown-time behavior stays exactly as existing astrology service specifies |

Errors sit beneath the relevant field; keyboard focus follows the active step.
Existing draft recovery is retained. Do not collect the old optional current
location: the active implementation discards it after intake and no frozen
function uses it. Removing this unused question prevents asking for unnecessary
personal information; it does not change chart computation or storage. Birth
place still supplies the existing timezone and coordinates. No new precision
promise, data store or inference behavior is added.

### S05 — calculation and calculation failure

Keep the room mounted. In the same rail show **Casting your chart…** plus the
actual existing elapsed wait where available. No second portrait or wheel
animation falsely representing computed data. Success reveals the real wheel
and existing opening reading in the same stage. Failure shows the actual
calculation error and **Try again** / **Edit birth details**; recovered answers
stay available. A restored stale casting state returns to intake as today.

### S06 — personal reading and chart focus

Keep Natally and the personal wheel as the existing two views of one stage.
The rail title **Your reading** identifies the transcript. Existing opening
and streamed replies use the real word-paced cue driver, real voice and mouth
movement; full transcript belongs in the rail, current sentence in the caption.
The existing text composer has accessible **Ask Natally** label and **Send**;
its blank prompt is **Ask about your chart…**. Preserve the user's unanswered
question on actual failure. Do not add fake microphone/upload controls for
services that do not exist in this codebase.

Planet/sign/house/aspect selection, associated highlights, structural wheel
legibility, free authored explanation, timed clearing, manual follow pin and
drag-versus-swap semantics remain unchanged. The live 3D object replaces the
prototype's exact stage slot; the prototype is not a screenshot pasted over it.
The existing explanatory notebook is available as **Chart notes**, a secondary
rail section rather than an always-open generic panel. It serves the current
existing authored lesson; do not fabricate personalized analysis for that panel.

### S07 — header menu and account

The account control opens **Account** in the rail. Show the real account
identity, actual allowance state, **Top up**, **My keepsake** and **Sign out**.
Do not reproduce the customer's avatar at hero size. The menu uses the same
rail for existing real section destinations; navigation closes/changes the
current rail, not the live stage. No inert menu entry or dead anchor.

Top up/keepsake entries must mount their corresponding existing surface from
all signed-in states, including before a chart exists. A chart-required action
asks for the existing chart intake rather than silently disappearing. Close
returns to the preceding task. No allowance grant, purchase, signout or deletion
occurs merely from opening or closing account content.

### S08 — top-up, redemption and checkout states

Title **Conversation credits**. Show actual allowance and the existing US$5,
US$10, US$25 pack choices, then one **Continue** for the selected real product.
Each price is indispensable to an informed purchase. Do not invent duration,
number of readings, discounts or a popular/best-value designation. Show the
existing **Redeem admin code** option as a subordinate disclosure: Code,
**Redeem**, actual result/error. This is an existing real operation, never
preloaded with a secret or simulated grant.

Keep the live scene while opening the existing provider checkout. **Opening
checkout…**, cancellation, failure and verified balance refresh remain their
actual states. A provider-owned lightbox/system browser is a platform adaptation;
the application must not add another full-screen dimmer. A missing configuration
stays explicit and retryable; it is not replaced by an attractive dummy checkout.

### S09 — keepsake offer, preparation, result and retained viewer

Title **Keep your sky**. Copy **Your natal report, as a PDF and an interactive
keepsake.** Price **US$30**, primary **Get my keepsake**. The nouns name the
two existing deliverables; the price is adjacent to the decision. No second
mascot or unsupported “all conversations saved forever” claim. If sign-in or
a chart is needed, route into the existing corresponding task and preserve
the existing offer intent.

Checkout, cancellation, preparation and generation failure use existing real
purchase/report/PDF contracts. **Preparing your keepsake…** appears only while
actual generation is underway. Success offers **Open keepsake** and **Download
PDF**. If the existing local retained record is present, opening My keepsake
mounts the existing `SouvenirViewer`, not an unreachable component or a repeat
purchase offer. Viewer has the real chart, birth facts, body sections, aspects,
closing and export. Use the authentic earlier Stitch souvenir exports as content
references while the new shared frame preserves current scene continuity.
The PDF remains a distinct printable artifact; it cannot be used as an opaque
replacement for the interactive stage.

### S10 — native browser handoff

This page is a short secure bridge, not a second marketing site. It uses the
same wordmark, palette and labelled controls. Google shows **Continue in your
browser** then the actual redirect/return state. SMS shows the same phone/code
controls and actual reCAPTCHA; **Return to Natally** describes the actual
verification handoff, not a successful native login before verification.
Keep the existing state/origin/port/nonce/deadline/cancellation validation,
memory-only sensitive data, field restrictions and callback behavior. Invalid
or expired requests show the actual error and a restart instruction; no invented
deep link or token in the URL. This separate browser page cannot keep the native
app's live canvas inside the browser and is a justified platform exception.

### S11 — status, recovery, utility views and first paint

Auth resolution and credential handoff use a small **Signing you in…** rail
state while the existing room poster/live mount remains present. Asset load
failure exposes the existing retry action rather than an empty canvas or a fake
room. Voice download/preparation/synthesis states use actual events, sizes and
percentages; muted/not-ready never pretends to be speaking. Retry belongs to
the failed operation. Rate limiting, zero allowance and disconnected inference
retain their existing distinct contracts; no service rewrite is authorized.

Privacy and Terms remain real readable utility content accessible through the
shared rail or existing valid destination, with Back. Avoid adding a new consent
system. If a route is unimplemented, do not invent a legal document or expose a
dead link. Initial HTML poster fits the same stage boundary so hydration does
not produce an obstructing mascot splash or viewport jump.

## Accessibility and responsive behavior

At least44px controls, visible focus, persistent labels,16px input text,
contrast at least4.5:1 for ordinary text,7:1 for the current spoken word.
Respect reduced motion and reduced transparency; use an opaque dark rail when
blur is unavailable. No forced audio; existing gesture admission and Save-Data
behavior remain. Do not place a focus trap/inert/aria-modal layer around a
nonmodal rail. The provider's own accessible verification widget is retained.
Focus moves to a new task heading or first relevant field and returns to the
opener on Close, while keyboard access to stage controls remains possible.

Desktop uses a roughly352px rail with bounded readable measure and a stage
that fits the available height. Below768px, use one column, no horizontal
overflow,48px header and a room band about44dvh within240–380px. On short
viewports/keyboard resize use the available visual viewport and preserve
Natally/ball with contained scene scaling; allow the document to scroll to the
active field rather than overlaying it. Native safe areas inset the same layout.
Follow actual exported responsive rules at freeze rather than inventing new
breakpoints during implementation.

## Build and evidence

Build identity and target matrix are exactly ARCHITECTURE §23. Each screen
family maps to its export ID, implementation binding and observation checkpoint
in §24. The preauthored rubric controls visual/state evidence. Compile/package
success, external authentication/payment observations and market adoption are
three different claims; provide evidence only for what actually occurred.
