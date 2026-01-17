const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// UI elements
const ui = document.getElementById("ui");
const screenMenu = document.getElementById("screen-menu");
const screenDaily = document.getElementById("screen-daily");
const screenShop = document.getElementById("screen-shop");
const screenNft = document.getElementById("screen-nft");
const screenSettings = document.getElementById("screen-settings");

const btnPlay = document.getElementById("btnPlay");
const btnDaily = document.getElementById("btnDaily");
const btnShop = document.getElementById("btnShop");
const btnNft = document.getElementById("btnNft");
const btnSettings = document.getElementById("btnSettings");

const btnBackFromDaily = document.getElementById("btnBackFromDaily");
const btnBackFromShop = document.getElementById("btnBackFromShop");
const btnBackFromNft = document.getElementById("btnBackFromNft");
const btnBackFromSettings = document.getElementById("btnBackFromSettings");

const colorGrid = document.getElementById("colorGrid");
const selectedColorName = document.getElementById("selectedColorName");

const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");

// Game over overlay
const overlay = document.getElementById("overlay");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");

// ---------------------
// Storage helpers
// ---------------------
function saveString(key, val) { localStorage.setItem(key, String(val)); }
function loadString(key, fallback) {
  const v = localStorage.getItem(key);
  return v !== null ? v : fallback;
}
function saveNumber(key, val) { localStorage.setItem(key, String(val)); }
function loadNumber(key, fallback) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------
// Canvas sizing
// ---------------------
let viewW = 0;
let viewH = 0;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  viewW = rect.width;
  viewH = rect.height;

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  clampPlayer();
  player.y = viewH - 80;
});

resizeCanvas();

// ---------------------
// Player
// ---------------------
const player = {
  x: viewW / 2,
  y: viewH - 80,
  r: 18,
  speed: 320
};

function clampPlayer() {
  const minX = player.r + 10;
  const maxX = viewW - player.r - 10;
  if (player.x < minX) player.x = minX;
  if (player.x > maxX) player.x = maxX;
}

// ---------------------
// Input (touch/mouse)
// ---------------------
let moveDir = 0;

function setDirFromX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;          // X relativ zum Spielfeld
  moveDir = localX < (rect.width / 2) ? -1 : 1;
}

function stopMove() { moveDir = 0; }

// Touch
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  setDirFromX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  setDirFromX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopMove();
}, { passive: false });

// Mouse (PC)
canvas.addEventListener("mousedown", (e) => {
  if (state !== "playing") return;
  setDirFromX(e.clientX);
});
window.addEventListener("mouseup", () => stopMove());

// ---------------------
// Obstacles (Candles)
// ---------------------
const obstacles = [];

// Candle size (same for all)
const CANDLE_W = 34;
const CANDLE_H = 90;

const SPAWN_INTERVAL = 0.80;
let spawnTimer = SPAWN_INTERVAL;

const BASE_SPEED = 210;
let SPEED_INCREASE = loadNumber("speedIncrease", 2);

// Bonus candle chance (rare)
const BONUS_CHANCE = 0.10; // 10% (if you want rarer: 0.05 = 5%)
const BONUS_POINTS = 100;

function rand(min, max) { return Math.random() * (max - min) + min; }

function currentObstacleSpeed(timeAliveSeconds) {
  return BASE_SPEED + SPEED_INCREASE * timeAliveSeconds;
}

function spawnCandle(timeAliveSeconds) {
  const x = rand(10, viewW - CANDLE_W - 10);
  const y = -CANDLE_H - 10;

  const isBonus = Math.random() < BONUS_CHANCE; // rare green candle

  obstacles.push({
    x, y,
    w: CANDLE_W,
    h: CANDLE_H,
    speed: currentObstacleSpeed(timeAliveSeconds),
    isBonus
  });
}

// Collision circle vs rect
function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= (cr * cr);
}

// ---------------------
// Ball colors (Shop)
// ---------------------
const BALLS = [
  { name: "Gold", value: "#ffd400" },
  { name: "Red", value: "#ff4d4d" },
  { name: "Blue", value: "#4da6ff" },
  { name: "Green", value: "#4dff88" },
  { name: "Purple", value: "#a24dff" },
  { name: "White", value: "#ffffff" },
];

let ballColor = loadString("ballColor", "#ffd400");

function buildBallGrid() {
  colorGrid.innerHTML = "";

  for (const b of BALLS) {
    const btn = document.createElement("button");
    btn.className = "ball-btn";

    const preview = document.createElement("div");
    preview.className = "ball-preview";
    preview.style.background = b.value;

    btn.appendChild(preview);

    if (b.value === ballColor) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      ballColor = b.value;
      saveString("ballColor", ballColor);
      selectedColorName.textContent = b.name;
      buildBallGrid();
    });

    colorGrid.appendChild(btn);
  }

  const current = BALLS.find(x => x.value === ballColor);
  selectedColorName.textContent = current ? current.name : "Custom";
}

// ---------------------
// UI Screens / State
// ---------------------
let state = "menu"; // menu | daily | shop | nft | settings | playing | gameover

function showOnly(screen) {
  screenMenu.classList.add("hidden");
  screenDaily.classList.add("hidden");
  screenShop.classList.add("hidden");
  screenNft.classList.add("hidden");
  screenSettings.classList.add("hidden");
  screen.classList.remove("hidden");
}

function openMenu() {
  state = "menu";
  overlay.classList.add("hidden");
  ui.classList.remove("hidden");
  showOnly(screenMenu);
  stopMove();
}

function openDaily() {
  state = "daily";
  overlay.classList.add("hidden");
  ui.classList.remove("hidden");
  showOnly(screenDaily);
  stopMove();
}

function openShop() {
  state = "shop";
  overlay.classList.add("hidden");
  ui.classList.remove("hidden");
  buildBallGrid();
  showOnly(screenShop);
  stopMove();
}

function openNft() {
  state = "nft";
  overlay.classList.add("hidden");
  ui.classList.remove("hidden");
  showOnly(screenNft);
  stopMove();
}

function openSettings() {
  state = "settings";
  overlay.classList.add("hidden");
  ui.classList.remove("hidden");
  speedSlider.value = String(SPEED_INCREASE);
  speedValue.textContent = String(SPEED_INCREASE);
  showOnly(screenSettings);
  stopMove();
}

function startGame() {
  resetGame();
  state = "playing";
  ui.classList.add("hidden");
  overlay.classList.add("hidden");
}

// Buttons
btnPlay.addEventListener("click", startGame);
btnDaily.addEventListener("click", openDaily);
btnShop.addEventListener("click", openShop);
btnNft.addEventListener("click", openNft);
btnSettings.addEventListener("click", openSettings);

btnBackFromDaily.addEventListener("click", openMenu);
btnBackFromShop.addEventListener("click", openMenu);
btnBackFromNft.addEventListener("click", openMenu);
btnBackFromSettings.addEventListener("click", openMenu);

// Settings slider
speedSlider.addEventListener("input", () => {
  SPEED_INCREASE = Number(speedSlider.value);
  speedValue.textContent = String(SPEED_INCREASE);
  saveNumber("speedIncrease", SPEED_INCREASE);
});

// Game over overlay buttons
restartBtn.addEventListener("click", () => startGame());
menuBtn.addEventListener("click", () => openMenu());

// ---------------------
// Game Loop / Score
// ---------------------
let last = performance.now();
let timeAlive = 0;
let score = 0;

function resetGame() {
  obstacles.length = 0;
  spawnTimer = SPAWN_INTERVAL;
  timeAlive = 0;
  score = 0;

  player.x = viewW / 2;
  player.y = viewH - 80;
  moveDir = 0;

  last = performance.now();
}

function update(dt) {
  if (state !== "playing") return;

  timeAlive += dt;
  score += dt * 10; // simple time score

  // Move player
  player.x += moveDir * player.speed * dt;
  clampPlayer();

  // Spawn candles
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnCandle(timeAlive);
    spawnTimer = SPAWN_INTERVAL;
  }

  // Move candles
  for (const o of obstacles) {
    o.y += o.speed * dt;
  }

  // Remove off-screen
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].y > viewH + 120) obstacles.splice(i, 1);
  }

  // Collision:
  // - red candle => game over
  // - green candle => bonus points + remove candle
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (circleRectCollision(player.x, player.y, player.r, o.x, o.y, o.w, o.h)) {
      if (o.isBonus) {
        score += BONUS_POINTS;
        obstacles.splice(i, 1); // collect bonus
      } else {
        state = "gameover";
        stopMove();
        overlay.classList.remove("hidden");
      }
      break;
    }
  }
}

function drawCandle(o) {
  // Body color
  const body = o.isBonus ? "#22c55e" : "#ff3b3b"; // green / red
  const edge = o.isBonus ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.25)";

  // Candle body
  ctx.fillStyle = body;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  // Border / edge
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);

  // Wick (NOW SAME COLOR as candle, not black)
  const midX = o.x + o.w / 2;
  ctx.strokeStyle = body;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(midX, o.y - 14);
  ctx.lineTo(midX, o.y + o.h + 14);
  ctx.stroke();
}

function draw() {
  // Background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, viewW, viewH);

  // Candles
  for (const o of obstacles) drawCandle(o);

  // Player ball
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = ballColor;
  ctx.fill();

  // HUD
  if (state === "playing") {
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText("Seeker Ball", 16, 28);
    ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, 16, 50);
    ctx.fillText(`Score: ${Math.floor(score)}`, 16, 72);
    ctx.fillText(`Speed: ${Math.round(currentObstacleSpeed(timeAlive))}`, 16, 94);
    ctx.fillText(`Green candle = +${BONUS_POINTS}`, 16, 116);
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Start in menu
openMenu();
