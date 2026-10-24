# Aotearoa: Generations — Game Design Document

## 1. Overview

**Genre:** Idle/incremental settlement-building game
**Format:** Single-page web app (HTML/JS), playable in-browser
**Session pattern:** Short active check-ins (2–10 min) punctuated by long idle wait periods (minutes to hours), designed to unfold over multiple weeks of real time
**Rendering:** PixiJS 2D (WebGL-accelerated 2D scene), NOT 3D — the scene is an illustrated, storybook-style landscape that visibly evolves as the game progresses
**Core fantasy:** Grow a small founding settlement into a thriving population across two connected historical eras of Aotearoa New Zealand, watching one illustrated scene transform from coastline and waka to a modern town skyline

---

## 2. Design Pillars

1. **Idle + Active hybrid loop** — long timers (crop growth, construction, ship voyages, immigration) run in the background even when the tab is closed; short satisfying tap-tasks fill the gaps when the player is actively engaged.
2. **One continuous illustrated scene** — not separate levels or screens. The same canvas evolves in place: new buildings appear, old ones stay, the landscape fills in over the full playthrough.
3. **A visible turning point, not a reset** — the arrival of European ships is a major mid-game event that unlocks a new layer of mechanics. The original settlement is NOT destroyed or replaced — it continues to exist and grow alongside the new systems, reflecting that both threads are part of the same continuous history.
4. **Long-tail pacing** — early timers are short and rewarding (seconds/minutes) to hook the player quickly; later timers stretch to hours, encouraging players to check in once or twice a day over several weeks rather than sit and grind.
5. **Respectful, general historical framing** — the game evokes eras and everyday settlement life (gardening, fishing, building, trade, township growth) rather than depicting specific real conflicts, real named historical figures, or sensitive events in detail. See Section 9.

---

## 3. Tech Stack & Asset Capabilities

- **Rendering:** [PixiJS](https://pixijs.com/) (2D WebGL renderer), loaded via CDN (`https://cdnjs.cloudflare.com/ajax/libs/pixi.js/<version>/pixi.min.js`) for rich, 60fps WebGL-accelerated 2D scene rendering.
- **Structure:** Single HTML file or clean modular vanilla JS architecture — zero build step required, runs directly in any modern browser.
- **State/save system:** Key-value local storage with offline progress calculation, plus JSON/Base64 import/export for cross-device saves.
- **3D vs 2D Decision:** Pixi3D was considered, but 2D/2.5D illustrated storybook rendering is explicitly chosen for the aesthetic. With custom illustrated art assets, 2D delivers a more vibrant and authentic storybook feel than generic 3D low-poly models.
- **Visual Assets (AI-Generated & Procedural):** 
  - **Gemini Image Generator:** Custom, copyright-free storybook-style 2D assets, multi-layer parallax backgrounds, building sprites across upgrade tiers (whare, pā, waka, colonial cottages, mills, ships, modern skyline), milestone splash art, and UI icons can be directly generated using the Gemini Image Generator (`generate_image`).
  - **PixiJS Graphics & Procedural Layer:** Dynamic vector shapes, glowing particle effects, water wave shaders, and animated smoke/weather overlays.
- **Audio Engine (Web Audio API):** Full procedural sound synthesis built directly in JavaScript — ambient ocean waves, wind breezes, native bird calls, construction hammers, and milestone chimes without needing heavy external audio files.

---

## 4. Core Loop

### 4.1 Idle systems (tick automatically, including while offline)
- Population growth (based on food + housing capacity)
- Resource generation (crops ripening, fish stocks replenishing, timber regrowing, trade goods accumulating)
- Construction timers (buildings under construction complete after a set duration)
- Later game: ship voyages, immigration waves, trade caravans

### 4.2 Active tasks (player-initiated, quick to perform)
- Harvest a ready crop / collect a ready resource
- Assign villagers to a job (fishing, farming, building, trading)
- Start a new construction project
- Collect completed timers (building finished, ship arrived, trade completed)
- Spend resources on upgrades or new unlocks

### 4.3 Offline progress
- On return, calculate elapsed real time since last visit and simulate idle systems forward (capped at a reasonable max, e.g. 12–24 hours, to avoid runaway numbers) — show a "while you were away" summary panel

### 4.4 Milestones
- Population and resource thresholds unlock new buildings, resources, and story beats
- Milestones are the primary progression gate — not a currency-buying gate — so the game always feels like "grow and wait" rather than "pay to skip"

---

## 5. Visual Style & Scene System (Isometric City Builder)

- **Perspective:** Isometric perspective achieved via mathematical transform (rotating 45 degrees, scaling Y by 0.5) applied to a PixiJS container, allowing flat textures to project as perfect diamonds.
- **Grid-Based Layout:** The game functions as a classic isometric city builder. Players place buildings on a grid, allowing custom settlement layouts and organic expansion.
- **Dual-Container Rendering:** 
  - **Terrain:** A mathematically squashed `PIXI.Container` mapping flat, top-down seamless textures (Grass, Sand) as tiled isometric diamonds.
  - **Entities:** An overlaid, un-squashed container where vertical entities (Whare, Trees) are placed using exact coordinate math so they stand perfectly upright.
- **AI-Generated Textures & Sprites:** Uses `generate_image` for seamless orthogonal floor textures and isometric building sprites.
- **Dynamic Day/Night & Weather System:** Smooth color grading (dawn, midday, golden hour, dusk, starry night with moon) driven by PixiJS color matrix filters applied to the isometric grid container.
- **UI overlay:** Modern, responsive glassmorphism / storybook parchment panel (HTML/CSS, outside the canvas) showing resource counters, population, active timers, milestone trackers, and action controls.

---

## 6. Chapters & Progression

### Chapter 1 — Founding & Settlement (Māori Era)

**Setting:** A small group arrives by waka and founds a kāinga (settlement) on the coast.

**Resources:**
- Population (kai-fed villagers)
- Kai (food): kūmara gardens + fishing
- Rākau (timber): gathered from nearby forest
- Whenua (land): unlocks as the settlement expands outward

**Buildings:**
- Whare (houses) — increase population capacity
- Māra kūmara (gardens) — idle food production, harvested on a timer
- Waka ama / fishing spot — idle food production
- Kūmara storage pit — increases resource cap
- Pā (fortified village) — a major mid-chapter milestone building, unlocks defensive/prestige bonuses and new population cap tier

**Active tasks:** tend gardens, fish, gather timber, assign villagers, start construction

**Progression:** population and building milestones gradually raise a "settlement growth" meter. When it's full, trigger the turning-point event.

---

### The Turning Point — Sails on the Horizon

- A ship silhouette appears on the horizon as a scripted event (not a jump-scare — a slow, visible approach over an in-game timer, so the player can watch it happen)
- Framed narratively as **a new chapter beginning**, not the settlement ending
- On arrival, unlocks Chapter 2 systems; the Chapter 1 settlement remains fully visible and continues generating resources in the background for the rest of the game
- This is the emotional and mechanical "halfway point" of the full playthrough

---

### Chapter 2 — Trade & Growth (Colonial Era → Township)

**New resources:**
- Currency (pounds/shillings-style abstracted "coin")
- Trade goods (wool, timber exports, produce)
- Immigrants (a second population stream alongside natural growth)

**New buildings:**
- Wharf/port — enables trade ships (idle timers: ship sails out, returns with goods/coin)
- Trading post — converts goods to currency
- Cottages/houses (European-style) — new population capacity tier
- Roads — connect and visually expand the settlement
- Farms — larger-scale food production
- Small workshops/mills — early industry

**Active tasks:** manage trade routes, assign new arrivals to jobs, start new construction, collect completed voyages

**Progression:** population and trade milestones unlock roads expanding the map, then small industry, then...

---

### Chapter 2b — Township to Modern Growth (endgame)

**New resources/systems:**
- Industry output (abstracted — "goods" or "production")
- Infrastructure (roads, later rail/utilities as abstracted upgrades)
- Population booms (larger-scale growth ticks)

**New buildings:**
- Town hall, shops, small factories
- Expanding road network filling out the map
- Eventually a skyline silhouette representing a modern small city

**End state:** the full scene shows the complete arc — original kāinga still visible and thriving in one corner, surrounded by the township/city that grew up around and alongside it. This is the "ending" screenshot moment.

---

## 7. Data Model & Save System

Use a simple persistent key-value store. Suggested keys (single user, not shared):

```
game-state : {
  lastSavedAt: timestamp,
  chapter: 1 | 2,
  population: number,
  populationCap: number,
  resources: { kai, rakau, whenua, currency, tradeGoods, immigrants, ... },
  buildings: [ { id, type, status: "building"|"complete", completesAt } ],
  timers: [ { id, type, startedAt, duration, targetId } ],
  milestonesReached: [ ids ],
  turningPointTriggered: boolean,
  turningPointTimestamp: timestamp | null
}
```

- On load: fetch `game-state`, compute elapsed time since `lastSavedAt`, fast-forward idle timers/resources accordingly (capped), then render the "while you were away" summary
- Save on every meaningful state change (resource collected, building started/completed, milestone reached) plus a periodic autosave
- Include a manual "reset game" option for testing/starting over

---

## 8. UI Layout (suggested)

- **Top/center:** the PixiJS illustrated scene canvas (majority of screen space)
- **Side or bottom panel:**
  - Population + resource counters (icons + numbers)
  - Active timers list with progress bars (crops, construction, voyages)
  - Action buttons (harvest, build, assign, trade) — disabled/greyed when not available
  - Milestone/goal tracker ("Next: reach population 50 to unlock the Pā")
- **Event banner:** appears for major beats (turning point event, chapter transitions, milestone unlocks) — brief, dismissible, doesn't block the scene
- **"While you were away" modal:** shown on return after time away, summarizing idle gains

---

## 9. Historical & Cultural Sensitivity Guidelines

- Keep historical framing **general and atmospheric**: era names, everyday settlement activities, rough time periods — not specific real battles, real named historical figures, or real documented conflicts
- Represent the transition to Chapter 2 as **continuation and coexistence**, not replacement — the Māori settlement is never shown as destroyed, erased, or "overwritten" by the new arrivals
- Avoid caricature — character/building art should be simple, dignified, and consistent in art style across both eras (same illustration style, not a "primitive vs. advanced" visual contrast)
- If adding flavor text (building names, milestone descriptions), keep wording respectful and simple; avoid claiming ownership of specific iwi names, real place names tied to specific communities, or real cultural/spiritual terms without care — favor general terms (kāinga, whare, pā, kūmara, waka) which are widely and appropriately used in general educational contexts
- This is a fictionalized, general population-growth game inspired by the shape of New Zealand's history — not a documentary or educational history resource

---

## 10. Pacing Notes (for a multi-week playthrough)

| Stage | Approx. real-time span | Timer scale |
|---|---|---|
| Early Chapter 1 | First session | Seconds–minutes |
| Mid Chapter 1 | Days 1–4 | Minutes–~1 hour |
| Turning point | ~End of week 1 | Scripted event |
| Early Chapter 2 | Week 1–2 | Minutes–hours |
| Township growth | Week 2–3 | Hours |
| Modern endgame | Week 3+ | Several hours–a day |

Tune actual numbers during build/playtesting — this table is a target shape, not fixed values.

---

## 11. Suggested File/Code Structure

```
/index.html          — page shell, loads PixiJS from cdnjs, mounts canvas + UI panel
/game/
  main.js            — app init, game loop (ticker), offline-progress calculation
  state.js           — game state object, save/load via storage API
  scene.js           — PixiJS scene setup, layers, building sprite management
  buildings.js        — building definitions (cost, timer, unlocks, sprite)
  resources.js        — resource definitions and generation rules
  milestones.js       — milestone thresholds and unlock effects
  events.js           — turning-point event + chapter transition scripting
  ui.js               — HTML/CSS side panel rendering and button bindings
/style.css
```

(A single-file version is also fine for portability — this structure is a suggestion for readability if the AI coding tool splits things up.)

---

## 12. Advanced Features & AI Capability Roadmap

The following features were previously marked as deferred, optional, or constrained by asset availability, but are **fully achievable and supported for implementation**:

| Feature / System | Previous GDD Status | AI Implementation Capability & Method | Feasibility |
|---|---|---|---|
| **Storybook Art & Sprites** | "Primitive shapes only; we don't have art assets" | **Gemini Image Generator (`generate_image`)**: Generate custom, consistent 2D storybook assets, parallax landscapes, building evolution sprites (Whare, Pā, Marae, Colonial Cottages, Mills, Town Hall, Modern Skyline), and turning-point event artwork. | **Fully Feasible (Active)** |
| **Dynamic Day/Night & Lighting** | "Optional, nice-to-have" | **PixiJS ColorMatrixFilter & Alpha Overlays**: Smoothly shifts ambient lighting across Dawn, Midday, Golden Hour, Dusk, and Starry Night (with twinkling stars and glowing settlement fire embers). | **Fully Feasible (Active)** |
| **Procedural Sound & Music Engine** | "Stretch goal (not required for v1)" | **Web Audio API Synthesis**: Zero external audio downloads. Generates procedural coastal waves, wind breeze, native birdsong synth, wood construction strikes, harvest sounds, and milestone chimes in pure JavaScript. | **Fully Feasible (Active)** |
| **Random & Seasonal Events** | "Stretch goal (not required for v1)" | **Interactive Event Dispatcher**: Triggers non-punishing narrative flavor events (e.g. Bumper Kūmara Harvest, Favorable Coastal Currents, Calm Seas) with modal prompts and temporary efficiency buffs. | **Fully Feasible (Active)** |
| **Photo Mode / Postcard Snapshot** | "Stretch goal (not required for v1)" | **Canvas Extraction & Postcard Generator**: Uses PixiJS canvas extraction (`extract.canvas`) to let players export a high-res screenshot with a vintage postcard border, settlement title, and timestamp. | **Fully Feasible (Active)** |
| **Historical Codex & Achievements** | "Stretch goal (separate list)" | **Codex & Badge Tracker Modal**: Separate UI modal tracking player milestones, time-based accomplishments, and unlocking respectful historical context snippets. | **Fully Feasible (Active)** |
| **Save Import / Export** | Basic LocalStorage only | **Portable Save Strings**: Adds a one-click Base64/JSON export and import modal so players can backup or transfer their multi-week progress across browsers and devices. | **Fully Feasible (Active)** |

---

## 13. Summary & AI Implementation Scope

Build a rich, polished single-page idle/incremental web application called **Aotearoa: Generations**:
- **Engine:** PixiJS (2D WebGL) + Modern HTML5/CSS Glassmorphism UI panel.
- **Visuals:** Cohesive illustrated storybook landscape evolving continuously over two connected historical eras (Māori Settlement → Colonial Trade & Township → Modern Growth), enriched by **Gemini-generated art assets** and procedural particle effects.
- **Audio & Ambiance:** Web Audio API procedural sound synthesizer (waves, wind, birds, chimes, building effects) with dynamic day/night ambient color grading.
- **Core Loop:** Multi-week idle progression (crops, timber, population, voyages) paired with engaging active tasks, random positive events, milestone unlocks, and turning-point scripting.
- **Features Included:** Save system with offline progress calculation + save export/import, Photo Mode canvas export, and Historical Codex achievement tracker.
- **Ethos:** Fictionalized, atmospheric, respectful, and non-conflict-based, honoring the continuous coexistence and evolution of both eras in one shared landscape.

---

## 14. V1 Implementation Decisions (From /grill-me session)

The following architectural and design decisions were made for the initial vertical slice (V1):

1. **Architecture & Tech Stack:**
   - **Build Tool:** Vite with a modular vanilla JS architecture (enables easy dependency management for PixiJS and smooth local development).
   - **Scope:** Strict focus on Chapter 1 (Māori Era) mechanics: founding the settlement, basic resources (kai, rākau), population growth, and the core idle/active loop.
2. **Visuals & UI:**
   - **Development Sequence:** Build core mechanics, isometric grid, and UI first using simple colored placeholder shapes. Swap to AI-generated storybook assets once stable.
   - **Map Layout:** Procedurally generated starting map featuring a mix of empty grass tiles (for building) and forested tiles.
   - **UI Position:** A responsive glassmorphism side panel on desktop that collapses to a bottom sheet on mobile screens.
3. **Core Interaction:**
   - **Gathering & Harvesting:** Direct map interaction. Players click directly on map elements (like forest tiles or ready crops) rather than abstracted UI buttons.
   - **Worker Assignment:** Classic worker placement. Players manage a total population pool and assign specific numbers of villagers to distinct tasks (e.g., fishing, farming) to boost idle resource generation.
