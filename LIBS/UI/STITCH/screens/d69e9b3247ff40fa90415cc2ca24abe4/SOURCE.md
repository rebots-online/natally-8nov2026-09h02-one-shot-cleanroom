# Revised live atelier prototype

Repository: **rebots-online/astronatally**. Date:2026-11-13.
Project: [Natally — live atelier](https://stitch.withgoogle.com/projects/16384422545803483395), private.
Canonical screen: `projects/16384422545803483395/screens/d69e9b3247ff40fa90415cc2ca24abe4`.
Authoritative HTML: `projects/16384422545803483395/files/68077327956557277`.
Authoritative PNG: `projects/16384422545803483395/files/68077327956556163`.
Design system: `assets/de2732fb73e04b1a8815be4699a0e7ec`, derived immediately
from the exact uploaded DOCS/DESIGN.md before screen generation.

`master.html` is the complete self-contained responsive prototype downloaded
from Stitch after all approved pre-freeze authoring corrections. `master-desktop.png`
is its1440×900 screenshot uploaded to and downloaded from the same screen.
Both authoritative downloads were byte-identical to their approved upload.
`master-phone.png` is the390×844 local render of the exact same HTML/CSS.
Stitch retains stale2560×2048 desktop metadata after update_screen; actual files
and measured geometry are recorded instead of claiming those metadata are correct.

There are52 actual template states, selected by `?screen=S01-guest` and the
other IDs in `state-manifest.json`. No visible developer selector exists.
The prototype navigates interface views; service action hooks await the existing
real application services and never simulate purchases, authentication or receipts.

`shared.css` is extracted verbatim from authoritative HTML style text. `frame.html`
is the exact shared body frame before the state templates. `templates/` contains
exact per-state markup, with hashes and React/service/observation bindings in
`state-manifest.json`. These are the immutable implementation references.
`pre-freeze-corrections.json` records deliberate corrections to deficient initial
generation before it was accepted. `generated-original.*`, `provider-corrected.*`
and the generation/correction responses preserve that history; they are not the
selected implementation authority.

The stage art is byte-identical existing room.webp; the chart preview is captured
from the actual existing Astrolabe3D renderer, and actual fonts are embedded.
No replacement character or chart art is generated. Geographic option/chip and
17-section report layout use actual existing gazetteer and public demonstration
BirthInput → natalChart → buildReport, with an actual AstroChart capture. They
are documented design references, not customer records or paid outcomes.
Production binds real entered data and retained report in the same structures.
The native datalist popup is a documented platform adaptation.

Outer chart defaults are square260×260 desktop and132×132 phone, with30px grip
chrome, existing96px minimum and existing manual geometry persistence. Idle caption
space remains geometrically stable and visually transparent until real speech.
Interaction sounds controls only the existing foley mute gate; it never claims
to mute the separately hardcoded ambience engine. Motion uses the existing
paused/setPaused→ReadingStage→AtelierScene contract. All app entries render the
same canonical frame; source adapters are listed explicitly in the manifest.

Root reviewed the actual desktop/phone composition and approved the bounded
corrections. QA rendered all52 states across both sizes; final bounded target and
data-layout observations are separately recorded by the QA owner. This design
freeze does not certify external login/payment, packaged builds or market adoption.
