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

Each turn has two mandatory steps:

1. **Place your mark.** Click any empty white sticker — your X or O is painted
   onto it.
2. **Make one cube move.** Perform exactly one quarter-turn of a face, either by
   **dragging a layer of the cube** or by clicking one of the **move buttons**
   (U, U′, D, D′, L, L′, R, R′, F, F′, B, B′).

Because marks are painted on the stickers, they travel with the cube when a face
turns. Play then passes to the other player.

### Winning

Get **3 of your marks in a line** — row, column, or diagonal — on any single
3×3 face. Victory is checked **only after your cube move finishes**, so the
rotation itself can complete (or break) a line. Watch out: a careless turn can
even hand your opponent a line.

## Controls

- **Rotate / inspect the cube:** drag empty space around the cube.
- **Place a mark:** click an empty sticker (during the *place* phase).
- **Turn a layer:** drag a sticker in the direction you want it to rotate
  (during the *move* phase), or use the move buttons.
- **Restart:** the button in the top bar or on the winner screen.

## Project structure

| File         | Responsibility                                                        |
| ------------ | --------------------------------------------------------------------- |
| `index.html` | Markup, HUD, move-button palette, and the Three.js import map.        |
| `main.js`    | Scene, cube model, face-turn engine, input, win detection, game state.|
| `style.css`  | HUD overlay and button styling.                                       |
