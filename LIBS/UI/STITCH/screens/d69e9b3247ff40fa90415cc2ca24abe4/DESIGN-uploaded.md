# Design System: Natally's live atelier

Repository: rebots-online/astronatally. Google Stitch generation specification.
Read alongside PRD.md; the operator's existing atmosphere takes precedence over
generic design-skill preferences. This is a character-led atelier, not a
dashboard or a new branding exercise.

## 1. Visual Theme & Atmosphere

Candlelit, intimate, curious and tactile. The real animated room is the main
composition. Density4, variance4, motion6 in the scene and motion2 in controls.
The screen is evidence: Natally and an interactive three-dimensional chart.
Interface surfaces are restrained dark acrylic work areas beside that evidence.
Never put a welcome or sign-in card over her face, hat, hands or crystal ball.
Never reproduce her likeness in a logo, portrait medallion, avatar or form.

## 2. Color Palette & Roles

- **Atelier Ink** (#130F18) — page/header foundation, a warm near-black.
- **Plum Glass** (rgba(27,19,32,.78)) — legible task rail over the same atmosphere.
- **Plum Solid** (#211824) — reduced-transparency/blur fallback and inputs.
- **Candle Cream** (#F5EAD7) — primary interface and body text.
- **Quiet Linen** (#C5B7A7) — secondary copy that remains readable.
- **Aged Brass** (#CFAD70) — the single interface accent: primary action,
  selected border, focus. Saturation below80%; dark ink text on filled buttons.
- **Brass Edge** (rgba(207,173,112,.26)) — structural rail/input border.
- **Spoken Light** (#FFF36B) — existing active spoken word, not a competing
  decorative accent; preserve its sharp edge and luminous treatment.
- Errors use the existing accessible error color only as semantic feedback.

The violet character clothing and jewel art are the existing authored scene,
not permission for neon purple controls or a second interface accent. No
gradient text, outer neon glow, pure black page canvas or new illustration style.

## 3. Typography Rules

- **Identity/task display:** Playfair Display from existing local font asset.
  This deliberate product-continuity exception preserves the user's design
  factors. Wordmark28px desktop/24px phone; task heading24px, line-height1.2.
- **Controls/body:** Outfit,16px with1.5 line-height; labels14px/600. Bundle the
  actual exported font for native/offline fidelity; do not depend on remote CSS.
- **Metadata:** monospace12px, tabular numbers for balance/progress/version.
- Max body measure55ch in the rail,65ch in printable/utility content.
- One heading per task. No giant centered welcome, uppercase ceremony labels,
  duplicate descriptions, Inter replacement or tiny input text.

## 4. Component Stylings

- **Header:**52px desktop/48px phone, no vacant masthead; text wordmark left,
  compact navigation, identity/account right. Actual customer avatar32px inside
  a44px control. No Natally portrait logo.
- **Task rail:** about352px wide desktop,24px padding,16px corners,1px Brass
  Edge, blur16px/saturate125%. Shadow communicates separation without neon.
  Phone rail is a full-width document region with20px padding below the stage.
- **Buttons:**48px height,12px corners, Aged Brass fill for the single primary,
  dark text; quiet outline/text alternatives; transform-only tactile feedback.
- **Inputs:**48px minimum,12px corners, Plum Solid fill, persistent label above,
 1px edge, visible2px brass focus ring. Inline errors below, never placeholders
  replacing labels. ReCAPTCHA occupies its actual dedicated region.
- **Caption:**two real lines maximum at the stage foot; do not overlay the face
  or ball. Preserve spoken-word indexing, cream text and Spoken Light current
  word. Long transcript is in the rail.
- **Status:**small truthful acrylic region, actual progress bar/size/percentage,
  Retry only on error. Appearing/disappearing never changes stage or scrollY.
- **Navigation:**real existing sections, no dead anchors; compact Previous/Next
  only when that direction exists. Menu opens within the task rail.
- **Empty/pending/error:**use actual field/calculation/loading state, not a
  decorative avatar, circular marketing loader or invented customer content.

## 5. Layout Principles

Use semantic CSS Grid. Header spans columns. Desktop main grid is
`minmax(0,1fr) 352px`, with24px gutter; scene occupies the dominant column.
Contain rail reading width, not the entire immersive room in a small card.
Below768px use one column: header → persistent stage → caption → active task.
The stage band is approximately44dvh, bounded240–380px where viewport permits.
Use dynamic/visual viewport sizing and native safe-area padding. No horizontal
scroll, no second nested phone feed and no screen-height modal.

Every element has its own spatial region. The live stage's existing inset may
float/dock within its stage as its contract requires; never count that as
permission for a form or marketing card to cover Natally. Contain complete
registered room/character geometry; do not crop her face or ball to fit a card.
The focused wheel keeps its entire thick 3D profile and perimeter markings.
Use the exact current asset set, not stock room photos or new mascot artwork.

## 6. Motion & Interaction

Keep existing actual scene/voice/cue behavior, including manual view pin,
speech-paced highlight and reduced motion. No new perpetual animation on
buttons, inputs or account controls; interaction must remain calm. Swap motion
uses the existing eased transition; animate transform/opacity rather than layout.
Do not remount the live scene when switching rail tasks. No fake voice waveform,
fake progress, staged reading or default forced audio.

## 7. Anti-Patterns (Banned)

No welcome blocker, full-viewport tint, duplicate character likeness, oversized
account image, staged customer success, testimonial, invented balance, new mic
or upload function, explanation of hidden room mechanics, decorative eyebrow
text, three-equal-card promotion grid, gradient headline, custom cursor, neon
button glow, placeholder artwork or broken remote image. Exact prices and actual
provider state override attractive placeholder copy. Do not add a new logo,
feature or service while reproducing the prototype.

## 8. Export contract

Generate actual responsive HTML with CSS and explicit stable slots:
`data-slot="header"`, `data-slot="stage"`, `data-slot="caption"`,
`data-slot="rail"`, `data-slot="status"`. Use class prefix `atelier-` for the
new shared frame. Keep complete real screen families S01–S11 from PRD.md,
including auth/intake/checkout/recovery variants. Include actual existing art
as content assets in the stage slot; implementation replaces only that slot
with the existing live renderer. Do not flatten the complete UI into a picture.
Preserve exact generated exports, screen IDs, screenshots and SHA-256 hashes;
any asset correction must happen in Stitch before freezing. Reproduce the
export's actual DOM/CSS, not an independently styled approximation.
