# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based MMORPG management simulation game built with vanilla HTML5/CSS/JavaScript — no build tools, no frameworks, no npm. The player acts as a world manager overseeing autonomous NPCs with jobs, economies, and social behavior.

## Running the Game

Open `index.html` directly in a browser — no server required. For development, a local file server avoids CORS issues if modules are split into separate files:

```bash
# Python (any directory)
python -m http.server 8080

# Node (if available)
npx serve .
```

## Architecture

### Module Responsibilities

The game is structured as cooperating modules that share a single `World` state object:

- **`main.js`** — entry point; owns the `requestAnimationFrame` game loop; calls batch-update functions on each module at controlled tick intervals (not every frame)
- **`world.js`** — holds global state (NPCs array, time, policies, economy snapshot); exposes event hooks other modules subscribe to
- **`npc.js`** — NPC class and state machine (idle → work → socialize → sleep); batch-updates all NPCs in chunks per tick to cap CPU cost; uses an object pool to avoid GC churn
- **`economy.js`** — supply/demand model; shop price adjustment; NPC income/spend; reads NPC states from `world.js`
- **`ui.js`** — all DOM reads/writes; only updates changed values (dirty-flag pattern) to avoid unnecessary reflows; never called inside the hot game loop

### NPC State Machine

Each NPC cycles through states driven by the world clock:

```
sleep → work → socialize → sleep
```

Politician NPCs have an additional `govern` state that fires periodically and mutates world policies based on happiness/economy thresholds.

### Performance Contract

- NPC logic runs in **batches** (e.g., 20 NPCs per frame) rather than all at once.
- UI updates are **decoupled** from the game loop — fire on a slower interval or on state change.
- No per-frame DOM writes. All UI reads world state snapshots.
- Object pooling: NPC objects are reused, not garbage-collected.

### Time System

The world clock drives NPC schedules and the day/night cycle. Wall-clock milliseconds are mapped to in-game hours. Modules subscribe to time-of-day events (`onDawn`, `onDusk`, `onHour`) rather than polling.

### Economy Model

Supply and demand are tracked per good. Shop prices adjust each in-game day. NPC spending is gated by their current wallet balance and happiness. Tax policy (set by player or politician NPCs) drains wallets and funds public services.

## Key Design Constraints

- **Target: 100+ NPCs on low-spec devices** — always profile before adding per-NPC per-frame work.
- Single `index.html` is the canonical deliverable; JS modules may be embedded as `<script>` blocks or separate files loaded via `<script type="module">`.
- No external dependencies. If a utility is needed, inline it.
- Canvas or `div`-grid rendering only — no WebGL, no SVG animation loops.
