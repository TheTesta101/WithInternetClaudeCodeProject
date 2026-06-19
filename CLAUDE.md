# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page browser game — a 3×3 Rubik's Cube fused with Tic-Tac-Toe — built
with Three.js. **No build step, no package manager, no framework.** The entire
app is three static files: `index.html`, `main.js`, `style.css`.

## Running it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

It **must be served over HTTP**, not opened as `file://` — the ES-module import
map and `<script type="module">` entry point are blocked under the `file://`
origin. Three.js is loaded from a CDN (`unpkg`) via the import map in
`index.html`, pinned to `three@0.160.0`; bumping that version means editing both
the `"three"` and `"three/addons/"` entries.

There is no lint config and no committed test suite. The game is verified by
loading the served page in a headless browser and driving the `window.__rttt`
debug hook (see below); WebGL works headless with Chromium under
`--use-gl=swiftshader`.

## Architecture (all in `main.js`)

### Two coordinate systems — keep them in sync
This is the central invariant. Every cubie has **logical integer coords**
`{x,y,z} ∈ {-1,0,1}` in `userData.logical` (the source of truth for "which
cubies are in a layer") *and* a **world transform** (Three.js matrices). After
every face turn, `snapCubie()` rounds position and the rotation-matrix entries
to exact grid values and recomputes `logical` from the snapped transform. This
prevents floating-point drift from accumulating across many turns — never trust
raw float positions; re-derive logical state after each turn.

### Object hierarchy
`scene → cubeRoot → 26 cubie Groups → (body mesh + sticker meshes)`.
- `cubeRoot` **never rotates**; whole-cube inspection is camera-only via
  `OrbitControls`.
- The invisible center cubie is omitted (26, not 27), so the **middle slice has
  8 cubies, not 9** — relevant for any per-layer assertions.
- Each sticker is a child of its cubie and carries its mark as a per-sticker
  `CanvasTexture` (`drawSticker`). Because stickers are children, marks travel
  with the cubie automatically through rotations — there is no separate bookkeeping.

### Face turns — `turnLayer(axis, layerCoord, dir)`
Selects the 9 cubies whose `logical[axis] === layerCoord`, reparents them to a
transient `pivot` group with **`Object3D.attach` (not `add`)** to preserve world
transforms, animates `pivot.rotation[axis]` in the rAF loop (`activeTurn`), then
`finalizeTurn` reparents back (again `attach`), calls `snapCubie`, and resolves.
Only the **6 outer faces** are legal moves (no middle slices) — see the `MOVES`
table mapping the 12 buttons to `(axis, layerCoord, dir)`.

### Input state machine
A **capture-phase** `pointerdown` listener runs *before* OrbitControls so it can
suppress orbit when needed:
- drag on a sticker → layer turn (`computeTurnFromDrag`: rotation axis =
  `n × dragDir` snapped to the nearest cardinal axis; a drag mapping to the
  central slice, `layerCoord === 0`, is rejected since slices aren't legal).
- plain click on a sticker → place a mark.
- drag on empty background → camera orbit.

### Win detection — `faceGrid` / `checkWin`
Run after **every board change**. For each of the 6 world face directions, gather
outward-facing stickers (`localNormal.applyQuaternion(cubie.quaternion)`, snapped
to a cardinal), arrange into a 3×3 grid by the cubie's two free logical coords,
and scan all 8 lines (rows, cols, diagonals). Active player wins ties.

### Game flow
Placing a mark **is** the move: it ends the turn and switches `currentPlayer`.
Turning a face is **optional** and does **not** switch the player. A win is
checked after both placements and optional turns.

### Debug hook
`window.__rttt` exposes `{ state, cubies, stickers, isAnimating, turnLayer,
performMove, placeMark, checkWin, faceGrid, FACES, snapVec, drawSticker, restart }`
for console inspection and headless testing.

## Git

Development branch: `claude/adoring-hamilton-l57m47`. Do not push elsewhere
without explicit instruction.
