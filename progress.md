Original prompt: Develop the visual language for the cosmic cards and source image approach for the space object cards in this repo. You own card art treatment, rarity styling, image sourcing strategy, and card visual data fields. The user asked for images for each card; if network or licensing makes direct fetching risky, implement a robust fallback using generated/remote-safe imagery conventions and clearly note that. Do not revert others' edits; you are not alone in the codebase. Keep write scope focused on card visuals/data assets/styles where possible, and report the files changed.

## Notes
- Using a generated SVG art fallback for every card so the build stays licensing-safe and does not depend on network fetches.
- The repo already points `/cosmic-card-battle` at a missing view, so the visual layer is being added there as a reusable foundation.

## Progress
- Added a cosmic card library with broad celestial coverage, rarity-aware metadata, and source-hint fields for future image swaps.
- Added a dedicated cosmic game view scaffold with hooks for pack opening, battle, and gallery rendering.
- Added scoped neon/glass CSS for card frames, rarity glows, and animated cosmic surfaces.
- Wired the interactive game loop into the shared card library, including pack opening, collection saving, daily pack claims, aura leveling, and local battle resolution.
- Added generated SVG card art into collection tiles, reveal cards, and battle cards so every shipped card has a working image without network fetches.
- Added stat-by-stat battle comparison bars, reward tracking, and deterministic `window.advanceTime` / `window.render_game_to_text` hooks for browser testing.
- Rebuilt the page into separate Packs, Collection, and Battle tabs so the game no longer feels like one long landing page.
- Expanded the card database heavily with more asteroids, dwarf planets, stars, galaxies, and black holes.
- Switched card art loading to real object imagery via Wikipedia summary thumbnails with generated SVG fallback caching when a remote image is unavailable.
- Tightened the pack/collection/battle loop so only pulled cards enter the collection and battles require an owned selected card.

## Follow-ups
- If a future pass wants more than the current representative roster, expand `public/cosmic-card-library.js` with additional celestial objects while keeping the same schema.
- If future real images are desired, swap the `generated-svg` fallback for curated, licensed assets without changing the gameplay code.
