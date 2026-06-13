import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ============================================================
   Rubik's Tic-Tac-Toe
   - 3x3x3 cube: black body, all-white stickers.
   - Each turn: place a mark on an empty sticker, then make one
     90-degree face turn. Win = 3 in a row on a single face.
   - Victory is only checked AFTER the turn animation completes.
   ============================================================ */

// ---------- Tunables ----------
const CELL = 1;              // spacing between cubie centers
const BODY = 0.92;          // cubie body size (gaps form the black grid)
const STICKER = 0.82;       // sticker quad size
const STICKER_OFFSET = 0.47; // distance of sticker from cubie center
const TURN_MS = 220;        // face-turn animation duration
const DRAG_THRESHOLD = 9;   // px before a sticker drag becomes a layer turn
const X_COLOR = "#ff5d5d";
const O_COLOR = "#5db4ff";

// ---------- Scene / renderer ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.2, 4.0, 6.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 16;
controls.target.set(0, 0, 0);

// Lights so white stickers read clearly from every orbit angle.
scene.add(new THREE.HemisphereLight(0xffffff, 0x383840, 1.05));
const dir1 = new THREE.DirectionalLight(0xffffff, 0.7);
dir1.position.set(6, 8, 6);
scene.add(dir1);
const dir2 = new THREE.DirectionalLight(0xffffff, 0.35);
dir2.position.set(-6, -4, -5);
scene.add(dir2);

const cubeRoot = new THREE.Group(); // never rotates; orbit is camera-only
scene.add(cubeRoot);

// ---------- Game state ----------
const state = {
  currentPlayer: "X",
  phase: "PLACE",      // "PLACE" | "MOVE"
  gameOver: false,
  winner: null,
};
let isAnimating = false;
let activeTurn = null;

let cubies = [];        // array of cubie Groups
let stickerMeshes = []; // raycast targets

// ---------- Sticker textures (white sticker + optional X/O mark) ----------
function makeStickerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext("2d"), tex };
}

function drawSticker(sd) {
  const ctx = sd.ctx;
  const S = 128;
  // White sticker face with a faint rounded inset.
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = "#f5f5f2";
  roundRect(ctx, 4, 4, S - 8, S - 8, 14);
  ctx.fill();

  if (!sd.mark) {
    sd.tex.needsUpdate = true;
    return;
  }
  ctx.lineCap = "round";
  if (sd.mark === "X") {
    ctx.strokeStyle = X_COLOR;
    ctx.lineWidth = 16;
    const p = 34;
    ctx.beginPath();
    ctx.moveTo(p, p); ctx.lineTo(S - p, S - p);
    ctx.moveTo(S - p, p); ctx.lineTo(p, S - p);
    ctx.stroke();
  } else {
    ctx.strokeStyle = O_COLOR;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  sd.tex.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Build the cube ----------
const NORMALS = [
  { axis: "x", val: 1, n: new THREE.Vector3(1, 0, 0) },
  { axis: "x", val: -1, n: new THREE.Vector3(-1, 0, 0) },
  { axis: "y", val: 1, n: new THREE.Vector3(0, 1, 0) },
  { axis: "y", val: -1, n: new THREE.Vector3(0, -1, 0) },
  { axis: "z", val: 1, n: new THREE.Vector3(0, 0, 1) },
  { axis: "z", val: -1, n: new THREE.Vector3(0, 0, -1) },
];

const bodyGeo = new RoundedBoxGeometry(BODY, BODY, BODY, 4, 0.09);
const stickerGeo = new THREE.PlaneGeometry(STICKER, STICKER);
const PLUS_Z = new THREE.Vector3(0, 0, 1);

function buildCube() {
  disposeCube();
  cubies = [];
  stickerMeshes = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // omit invisible core

        const cubie = new THREE.Group();
        cubie.position.set(x * CELL, y * CELL, z * CELL);
        cubie.userData.logical = { x, y, z };

        const body = new THREE.Mesh(
          bodyGeo,
          new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0.05 })
        );
        cubie.add(body);

        const coord = { x, y, z };
        for (const face of NORMALS) {
          if (coord[face.axis] !== face.val) continue;
          const sd = makeStickerTexture();
          const mat = new THREE.MeshStandardMaterial({ map: sd.tex, roughness: 0.45, metalness: 0 });
          const sticker = new THREE.Mesh(stickerGeo, mat);
          sticker.position.copy(face.n).multiplyScalar(STICKER_OFFSET);
          sticker.quaternion.setFromUnitVectors(PLUS_Z, face.n);
          sticker.userData = {
            mark: null,
            localNormal: face.n.clone(),
            ...sd,
            cubie,
          };
          drawSticker(sticker.userData);
          cubie.add(sticker);
          stickerMeshes.push(sticker);
        }

        cubeRoot.add(cubie);
        cubies.push(cubie);
      }
    }
  }
}

function disposeCube() {
  for (const c of cubies) {
    cubeRoot.remove(c);
    c.traverse((o) => {
      if (o.isMesh) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
  cubies = [];
  stickerMeshes = [];
}

// ---------- Snapping (prevents float drift across turns) ----------
function snapCubie(cubie) {
  cubie.position.set(
    Math.round(cubie.position.x / CELL) * CELL,
    Math.round(cubie.position.y / CELL) * CELL,
    Math.round(cubie.position.z / CELL) * CELL
  );
  // Snap quaternion: round the rotation matrix entries to the nearest
  // of {-1,0,1} (their exact values after any multiple of 90 degrees).
  const m = new THREE.Matrix4().makeRotationFromQuaternion(cubie.quaternion);
  const e = m.elements;
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i]);
  cubie.quaternion.setFromRotationMatrix(m);

  cubie.userData.logical = {
    x: Math.round(cubie.position.x / CELL),
    y: Math.round(cubie.position.y / CELL),
    z: Math.round(cubie.position.z / CELL),
  };
}

// ---------- Face turns ----------
function turnLayer(axis, layerCoord, dir) {
  if (isAnimating) return Promise.resolve();
  const layer = cubies.filter((c) => c.userData.logical[axis] === layerCoord);
  if (layer.length !== 9) {
    console.error("Layer filter returned", layer.length, "cubies (expected 9)");
  }
  isAnimating = true;
  updatePaletteEnabled();

  const pivot = new THREE.Group();
  cubeRoot.add(pivot);
  layer.forEach((c) => pivot.attach(c));

  return new Promise((resolve) => {
    activeTurn = {
      pivot, axis, layer,
      target: dir * Math.PI / 2,
      start: performance.now(),
      resolve,
    };
  });
}

function finalizeTurn() {
  const t = activeTurn;
  t.pivot.rotation[t.axis] = t.target;
  t.pivot.updateMatrixWorld(true);
  t.layer.forEach((c) => {
    cubeRoot.attach(c);
    snapCubie(c);
  });
  cubeRoot.remove(t.pivot);
  const resolve = t.resolve;
  activeTurn = null;
  isAnimating = false;
  resolve();
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------- Win detection (run only after a completed turn) ----------
const FACES = [
  { n: new THREE.Vector3(1, 0, 0), u: "z", v: "y" },
  { n: new THREE.Vector3(-1, 0, 0), u: "z", v: "y" },
  { n: new THREE.Vector3(0, 1, 0), u: "x", v: "z" },
  { n: new THREE.Vector3(0, -1, 0), u: "x", v: "z" },
  { n: new THREE.Vector3(0, 0, 1), u: "x", v: "y" },
  { n: new THREE.Vector3(0, 0, -1), u: "x", v: "y" },
];

function snapVec(v) {
  return new THREE.Vector3(Math.round(v.x), Math.round(v.y), Math.round(v.z));
}

function faceGrid(face) {
  const grid = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  for (const cubie of cubies) {
    const logical = cubie.userData.logical;
    for (const child of cubie.children) {
      if (!child.userData || !child.userData.localNormal) continue;
      const wn = snapVec(child.userData.localNormal.clone().applyQuaternion(cubie.quaternion));
      if (wn.x === face.n.x && wn.y === face.n.y && wn.z === face.n.z) {
        const row = logical[face.v] + 1;
        const col = logical[face.u] + 1;
        grid[row][col] = child.userData.mark;
      }
    }
  }
  return grid;
}

function gridWinners(g) {
  const lines = [];
  for (let i = 0; i < 3; i++) {
    lines.push([g[i][0], g[i][1], g[i][2]]);
    lines.push([g[0][i], g[1][i], g[2][i]]);
  }
  lines.push([g[0][0], g[1][1], g[2][2]]);
  lines.push([g[0][2], g[1][1], g[2][0]]);
  const winners = new Set();
  for (const [a, b, c] of lines) {
    if (a && a === b && b === c) winners.add(a);
  }
  return winners;
}

function checkWin() {
  const all = new Set();
  for (const face of FACES) {
    for (const w of gridWinners(faceGrid(face))) all.add(w);
  }
  if (all.size === 0) return null;
  // Active player takes precedence on a simultaneous completion.
  if (all.has(state.currentPlayer)) return state.currentPlayer;
  return all.values().next().value;
}

// ---------- Turn flow ----------
function placeMark(sticker) {
  sticker.userData.mark = state.currentPlayer;
  drawSticker(sticker.userData);
  state.phase = "MOVE";
  updateHUD();
}

async function performMove(axis, layerCoord, dir) {
  if (state.phase !== "MOVE" || isAnimating || state.gameOver) return;
  await turnLayer(axis, layerCoord, dir);
  afterMove();
}

function afterMove() {
  const w = checkWin();
  if (w) {
    state.gameOver = true;
    state.winner = w;
    showWinner(w);
  } else {
    state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
    state.phase = "PLACE";
  }
  updateHUD();
}

// ---------- Pointer input ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ptr = {
  down: false, sticker: null, cubie: null, worldNormal: null,
  startX: 0, startY: 0, lastX: 0, lastY: 0, canTurn: false, consumed: false,
};

function pickSticker(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(stickerMeshes, false);
  return hits.length ? hits[0] : null;
}

// Capture phase: runs before OrbitControls so we can suppress orbit
// when a sticker drag should turn a layer instead.
renderer.domElement.addEventListener(
  "pointerdown",
  (e) => {
    if (e.button !== 0) return;
    const hit = pickSticker(e.clientX, e.clientY);
    ptr.down = true;
    ptr.consumed = false;
    ptr.startX = ptr.lastX = e.clientX;
    ptr.startY = ptr.lastY = e.clientY;

    if (hit) {
      ptr.sticker = hit.object;
      ptr.cubie = hit.object.userData.cubie;
      ptr.worldNormal = snapVec(
        hit.object.userData.localNormal.clone().applyQuaternion(ptr.cubie.quaternion)
      );
      // Only steal the gesture from orbit when a layer turn is actually allowed.
      ptr.canTurn = state.phase === "MOVE" && !isAnimating && !state.gameOver;
      controls.enabled = !ptr.canTurn;
    } else {
      ptr.sticker = null;
      ptr.canTurn = false;
      controls.enabled = true; // orbit the camera
    }
  },
  { capture: true }
);

window.addEventListener("pointermove", (e) => {
  if (!ptr.down) return;
  ptr.lastX = e.clientX;
  ptr.lastY = e.clientY;
  if (!ptr.sticker || !ptr.canTurn || ptr.consumed) return;

  const dx = e.clientX - ptr.startX;
  const dy = e.clientY - ptr.startY;
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

  ptr.consumed = true;
  const turn = computeTurnFromDrag(ptr.worldNormal, ptr.cubie, dx, dy);
  if (turn) performMove(turn.axis, turn.layerCoord, turn.dir);
});

window.addEventListener("pointerup", () => {
  if (ptr.down && ptr.sticker && !ptr.consumed) {
    const dist = Math.hypot(ptr.lastX - ptr.startX, ptr.lastY - ptr.startY);
    if (dist < DRAG_THRESHOLD &&
        state.phase === "PLACE" && !isAnimating && !state.gameOver &&
        !ptr.sticker.userData.mark) {
      placeMark(ptr.sticker);
    }
  }
  controls.enabled = true;
  ptr.down = false;
  ptr.sticker = null;
  ptr.consumed = false;
  ptr.canTurn = false;
});

// Map a screen drag on a sticker to a layer turn.
function computeTurnFromDrag(n, cubie, dx, dy) {
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  // Screen drag -> world direction (screen y is downward).
  const d = right.multiplyScalar(dx).add(up.multiplyScalar(-dy));
  d.addScaledVector(n, -d.dot(n)); // project onto the face plane
  if (d.lengthSq() < 1e-6) return null;
  d.normalize();

  // Rotating about (n x d) moves the grabbed point in the drag direction.
  const rot = new THREE.Vector3().crossVectors(n, d);
  const ax = Math.abs(rot.x), ay = Math.abs(rot.y), az = Math.abs(rot.z);
  let axis, comp;
  if (ax >= ay && ax >= az) { axis = "x"; comp = rot.x; }
  else if (ay >= az) { axis = "y"; comp = rot.y; }
  else { axis = "z"; comp = rot.z; }

  const layerCoord = cubie.userData.logical[axis];
  // Only the 6 outer faces are legal moves (no middle-slice turns), so a drag
  // that would spin the central slice is ignored — grab an edge/corner piece
  // or use the move buttons instead.
  if (layerCoord === 0) return null;

  return { axis, layerCoord, dir: comp >= 0 ? 1 : -1 };
}

// ---------- HUD / UI ----------
const turnMark = document.getElementById("turn-mark");
const turnText = document.getElementById("turn-text");
const phaseText = document.getElementById("phase-text");
const palette = document.getElementById("move-palette");
const moveButtons = Array.from(document.querySelectorAll(".move-btn"));
const winnerOverlay = document.getElementById("winner-overlay");
const winnerText = document.getElementById("winner-text");

const MOVES = {
  "U": ["y", 1, -1],  "U'": ["y", 1, 1],
  "D": ["y", -1, 1],  "D'": ["y", -1, -1],
  "R": ["x", 1, -1],  "R'": ["x", 1, 1],
  "L": ["x", -1, 1],  "L'": ["x", -1, -1],
  "F": ["z", 1, -1],  "F'": ["z", 1, 1],
  "B": ["z", -1, 1],  "B'": ["z", -1, -1],
};

moveButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = MOVES[btn.dataset.move];
    if (m) performMove(m[0], m[1], m[2]);
  });
});

function updatePaletteEnabled() {
  const enabled = state.phase === "MOVE" && !isAnimating && !state.gameOver;
  palette.classList.toggle("disabled", !enabled);
  moveButtons.forEach((b) => (b.disabled = !enabled));
}

function updateHUD() {
  turnMark.textContent = state.currentPlayer;
  turnMark.classList.toggle("o", state.currentPlayer === "O");
  turnText.textContent = "Player " + state.currentPlayer;
  phaseText.textContent =
    state.phase === "PLACE" ? "Place your mark on an empty sticker" : "Make one cube move";
  updatePaletteEnabled();
}

function showWinner(w) {
  winnerText.textContent = "Player " + w + " wins!";
  winnerOverlay.classList.remove("hidden");
}

function restart() {
  buildCube();
  state.currentPlayer = "X";
  state.phase = "PLACE";
  state.gameOver = false;
  state.winner = null;
  isAnimating = false;
  activeTurn = null;
  winnerOverlay.classList.add("hidden");
  updateHUD();
}

document.getElementById("restart-btn").addEventListener("click", restart);
document.getElementById("winner-restart").addEventListener("click", restart);

// ---------- Resize ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------- Render loop ----------
function animate(now) {
  requestAnimationFrame(animate);
  if (activeTurn) {
    const t = Math.min(1, (now - activeTurn.start) / TURN_MS);
    activeTurn.pivot.rotation[activeTurn.axis] = activeTurn.target * easeInOut(t);
    if (t >= 1) finalizeTurn();
  }
  controls.update();
  renderer.render(scene, camera);
}

// ---------- Boot ----------
buildCube();
resize();
updateHUD();
requestAnimationFrame(animate);

// Debug hook (harmless): lets you inspect/drive the game from the console.
window.__rttt = {
  state,
  get cubies() { return cubies; },
  get stickers() { return stickerMeshes; },
  get isAnimating() { return isAnimating; },
  turnLayer, performMove, placeMark, checkWin, faceGrid, FACES, snapVec, drawSticker, restart,
};
