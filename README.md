# Rubik's Tic-Tac-Toe

A browser game that fuses a 3×3 Rubik's Cube with Tic-Tac-Toe. The cube has a
black body and all-white stickers, and is fully rotatable so you can inspect
every side. Built with [Three.js](https://threejs.org/) — no build step.

## How to run

The game uses ES modules and an import map, so it must be served over HTTP
(not opened as a `file://`). From the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a modern browser.

(Any static server works, e.g. `npx serve`.)

## How to play

Two players share one screen. **Player 1 is X**, **Player 2 is O**.

On your turn:

- **Placing your mark is your move.** Click any empty white sticker — your X or O
  is painted onto it, and your turn ends. Play passes to the other player.
- **Turning a face is optional.** Before you place, you may turn faces of the
  cube as much as you like — by **dragging a layer** or clicking the **move
  buttons** (U, U′, D, D′, L, L′, R, R′, F, F′, B, B′). You're never required to.

Because marks are painted on the stickers, they travel with the cube when a face
turns.

### Winning

Get **3 of your marks in a line** — row, column, or diagonal — on any single
3×3 face. A win is checked after every change to the board (a placement *or* an
optional face turn), so a turn can complete a line — but watch out, a careless
turn can also hand your opponent one.

## Controls

- **Rotate / inspect the cube:** drag empty space around the cube.
- **Place a mark (ends your turn):** click an empty sticker.
- **Turn a layer (optional):** drag a sticker in the direction you want it to
  rotate, or use the move buttons.
- **Restart:** the button in the top bar or on the winner screen.

## Project structure

| File         | Responsibility                                                        |
| ------------ | --------------------------------------------------------------------- |
| `index.html` | Markup, HUD, move-button palette, and the Three.js import map.        |
| `main.js`    | Scene, cube model, face-turn engine, input, win detection, game state.|
| `style.css`  | HUD overlay and button styling.                                       |
