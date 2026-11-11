You are the coder for task AUDIT2-CHART in the Natally clean-room repository (cwd is the repo root). Read ONLY: this assignment, DOCS/ARCHITECTURE.md §12.1 4c, src/atelier-original/components/Astrolabe3D.tsx (owned).
HARD RULES: edit only src/atelier-original/components/Astrolabe3D.tsx. No placeholders. `npx tsc --noEmit` clean. Do not commit. Use `npx vite --port 5192 --strictPort`. Never make anything darker, blurrier or smaller.

THE ORCHESTRATOR OBSERVED THESE FAILURES AFTER THE LAST PASS (all must be gone):
1. The gold zodiac sign-boundary ticks (CylinderGeometry of length R_TORUS_TUBE*1.8 around line ~1232) cross the ring and stick out on both sides, reading as gold bars floating off the wheel. Replace them with short thin lines lying ON the ring band (from the band's inner edge to its outer edge, flush with the ring surface), never protruding past it.
2. Zodiac sign baubles are pale fills with a pale glyph (e.g. light mint/peach with near-white glyph) — illegible. Each sign bauble needs a saturated mid/dark fill with a light glyph, or a light fill with a dark glyph — contrast ratio ≥ 4.5:1 between glyph and bauble.
3. Degree labels and house numbers now pile on top of planet glyphs and each other ("25°", "7° Cap", "11°22'" overlapping). Offset degree text radially outward from its body so it never overlaps any glyph; when two bodies are close, stagger their labels; keep the ≥11 CSS px minimum.
4. A new dark arc now covers the top of the inner ring (around houses 9–10) — a regression from the last pass; remove whatever draws it.
5. The house cusp separators must run between the rings, attached, never floating apart.
VERIFY at 1440×900 floating and focused (/app.html signed out, scroll to #your-chart for focused); state what you observed for each of 1–5.
