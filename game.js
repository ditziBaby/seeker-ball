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

// Shop controls (NEW)
const xpBalanceEl = document.getElementById("xpBalance");
const buyBtn = document.getElementById("buyBtn");
const shopInfo = document.getElementById("shopInfo");

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
function saveJSON(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }
function loadJSON(key, fallback) {
  const v = localStorage.getItem(key);
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
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
  player.y = viewH - 90;
});

resizeCanvas();

// ---------------------
// Playfield layout (right price scale area)
// ---------------------
const PRICE_SCALE_W = 56;
const PADDING = 12;
function playW() { return Math.max(0, viewW - PRICE_SCALE_W); }

// ---------------------
// XP System (NEW)
// ---------------------
let totalXP = loadNumber("totalXP", 0);

// XP earn rates
const XP_PER_SEC = 1;        // XP pro Sekunde
const GREEN_BONUS_XP = 6;    // XP Bonus bei grüner Kerze

function updateShopXPUI() {
  if (xpBalanceEl) xpBalanceEl.textContent = String(totalXP);
}

function addXP(amount) {
  totalXP += amount;
  saveNumber("totalXP", totalXP);
  updateShopXPUI();
}

// ---------------------
// Player
// ---------------------
const player = {
  x: 0,
  y: 0,
  r: 18,
  speed: 320
};

function clampPlayer() {
  const minX = player.r + PADDING;
  const maxX = playW() - player.r - PADDING;
  if (player.x < minX) player.x = minX;
  if (player.x > maxX) player.x = maxX;
}

// ---------------------
// Input (touch/mouse)
// ---------------------
let moveDir = 0;

function setDirFromX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  moveDir = localX < (playW() / 2) ? -1 : 1;
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

const CANDLE_W = 34;
const CANDLE_H = 90;

const SPAWN_INTERVAL = 0.80;
let spawnTimer = SPAWN_INTERVAL;

const BASE_SPEED = 220;
let SPEED_INCREASE = loadNumber("speedIncrease", 2);

// Green candles (rare) = XP bonus
const GREEN_CHANCE = 0.06;

function rand(min, max) { return Math.random() * (max - min) + min; }
function currentSpeed(t) { return BASE_SPEED + SPEED_INCREASE * t; }

function spawnCandle(timeAliveSeconds) {
  const x = rand(PADDING, playW() - CANDLE_W - PADDING);
  const y = -CANDLE_H - 20;
  const isGreen = Math.random() < GREEN_CHANCE;

  obstacles.push({
    x, y, w: CANDLE_W, h: CANDLE_H,
    speed: currentSpeed(timeAliveSeconds),
    isGreen
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
// Balls (Shop) - ONLY WHITE FREE + manual buy (NEW)
// ---------------------
// type: solid | goldFX | rainbowFX
const BALLS = [
  { id: "white",  name: "White",  type: "solid",     value: "#ffffff", cost: 0 },     // ✅ nur der ist free

  // normale Farben (stark steigende Preise)
  { id: "red",    name: "Red",    type: "solid",     value: "#ff4d4d", cost: 50 },
  { id: "blue",   name: "Blue",   type: "solid",     value: "#4da6ff", cost: 100 },
  { id: "green",  name: "Green",  type: "solid",     value: "#4dff88", cost: 200 },
  { id: "purple", name: "Purple", type: "solid",     value: "#a24dff", cost: 400 },
  { id: "gold",   name: "Gold",   type: "solid",     value: "#ffd400", cost: 800 },

  // beste Skins (nur Optik)
  { id: "best_gold",    name: "Best (Gold Shimmer)", type: "goldFX",    value: "#ffd400", cost: 5000 },
  { id: "best_rainbow", name: "Best (Rainbow)",      type: "rainbowFX", value: "#ffffff", cost: 5000 },
];

// Owned items (persisted)
let owned = loadJSON("ownedBalls", null);
if (!owned) owned = {};
// ensure white is owned
owned["white"] = true;
saveJSON("ownedBalls", owned);

// equipped ball (must be owned)
let selectedBallId = loadString("selectedBallId", "white");
if (!owned[selectedBallId]) selectedBallId = "white";
saveString("selectedBallId", selectedBallId);

// shop selection (can be not owned)
let shopSelectedId = selectedBallId;

function getBallById(id) {
  return BALLS.find(b => b.id === id) || BALLS[0];
}
function isOwned(id) {
  return !!owned[id];
}

function setEquipped(id) {
  selectedBallId = id;
  saveString("selectedBallId", selectedBallId);
}

function refreshShopControls() {
  updateShopXPUI();

  const b = getBallById(shopSelectedId);
  const ownedNow = isOwned(b.id);

  if (!shopInfo || !buyBtn) return;

  if (ownedNow) {
    shopInfo.textContent = `${b.name} owned ✅`;
    buyBtn.disabled = true;
    buyBtn.textContent = "Owned";
  } else {
    shopInfo.textContent = `${b.name} costs ${b.cost} XP`;
    buyBtn.disabled = totalXP < b.cost;
    buyBtn.textContent = `Buy (${b.cost} XP)`;
  }

  // show what is equipped
  const equipped = getBallById(selectedBallId);
  selectedColorName.textContent = `Equipped: ${equipped.name}`;
}

function buildBallGrid() {
  colorGrid.innerHTML = "";

  for (const b of BALLS) {
    const btn = document.createElement("button");
    btn.className = "ball-btn";

    const preview = document.createElement("div");
    preview.className = "ball-preview";

    if (b.type === "solid") {
      preview.style.background = b.value;
    } else if (b.type === "goldFX") {
      preview.style.background = "linear-gradient(135deg, #b8860b, #ffd700, #fff1a8, #c99700)";
    } else {
      preview.style.background = "conic-gradient(from 0deg, #ff4d4d, #ffd400, #4dff88, #4da6ff, #a24dff, #ff4d4d)";
    }

    btn.appendChild(preview);

    // visual states
    if (b.id === selectedBallId) btn.classList.add("selected");
    if (!isOwned(b.id)) btn.classList.add("locked");
    if (b.id === shopSelectedId) btn.style.outline = "2px solid rgba(255,255,255,0.35)";

    btn.addEventListener("click", () => {
      shopSelectedId = b.id;

      // If owned: clicking equips immediately (still manual buying for locked)
      if (isOwned(b.id)) {
        setEquipped(b.id);
      }
      buildBallGrid();
      refreshShopControls();
    });

    colorGrid.appendChild(btn);
  }

  refreshShopControls();
}

if (buyBtn) {
  buyBtn.addEventListener("click", () => {
    const b = getBallById(shopSelectedId);
    if (isOwned(b.id)) return;
    if (totalXP < b.cost) return;

    // manual purchase
    totalXP -= b.cost;
    saveNumber("totalXP", totalXP);

    owned[b.id] = true;
    saveJSON("ownedBalls", owned);

    // auto-equip after purchase (still a manual action because user pressed Buy)
    setEquipped(b.id);

    buildBallGrid();
    refreshShopControls();
  });
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

  // keep selection on equipped
  shopSelectedId = selectedBallId;

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
// TradingView-like background (grid + ghost candles + price scale)
// ---------------------
let bgScroll = 0;
const GRID_MINOR = 24;
const GRID_MAJOR_EVERY = 5;
const GRID_MAJOR = GRID_MINOR * GRID_MAJOR_EVERY;

function mod(a, n) { return ((a % n) + n) % n; }

function drawGhostCandle(x, y, w, h, alpha = 0.10) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#2b3446";
  ctx.fillRect(x, y, w, h);

  const midX = x + w / 2;
  ctx.strokeStyle = "#2b3446";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(midX, y - 10);
  ctx.lineTo(midX, y + h + 10);
  ctx.stroke();
  ctx.restore();
}

function drawPriceScale() {
  const x0 = playW();
  const w = PRICE_SCALE_W;

  ctx.fillStyle = "rgba(6,10,18,0.88)";
  ctx.fillRect(x0, 0, w, viewH);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, 0);
  ctx.lineTo(x0 + 0.5, viewH);
  ctx.stroke();

  const steps = 6;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const topPrice = 120;
  const bottomPrice = 80;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = 10 + t * (viewH - 20);
    const price = Math.round(topPrice - t * (topPrice - bottomPrice));

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(x0 + 6, y + 0.5);
    ctx.lineTo(x0 + 14, y + 0.5);
    ctx.stroke();

    ctx.fillText(String(price), x0 + w - 6, y);
  }
}

function drawBackground(speedPxPerSec, dt) {
  bgScroll -= speedPxPerSec * dt;
  if (Math.abs(bgScroll) > 1000000) bgScroll = 0;

  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(0, 0, viewW, viewH);

  const usableW = playW();
  const yOffMinor = -mod(bgScroll, GRID_MINOR);
  const yOffMajor = -mod(bgScroll, GRID_MAJOR);

  // Vertical lines
  for (let x = 0; x <= usableW; x += GRID_MINOR) {
    const isMajor = (x % GRID_MAJOR) === 0;
    ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, viewH);
    ctx.stroke();
  }

  // Horizontal lines (scroll)
  for (let y = yOffMinor; y <= viewH; y += GRID_MINOR) {
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(usableW, y + 0.5);
    ctx.stroke();
  }
  for (let y = yOffMajor; y <= viewH; y += GRID_MAJOR) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(usableW, y + 0.5);
    ctx.stroke();
  }

  // Ghost candles
  const lanes = 6;
  const period = 260;
  for (let i = 0; i < lanes; i++) {
    const x = (i + 1) * (usableW / (lanes + 1)) - 10;
    const seed = i * 71;
    const y = mod((bgScroll * 0.9) + seed * 13, period) - 120;
    const h = 60 + (seed % 3) * 24;
    drawGhostCandle(x, y, 20, h, 0.10);
    drawGhostCandle(x, y + period, 20, h, 0.10);
    drawGhostCandle(x, y + period * 2, 20, h, 0.10);
  }

  // Vignette
  const g = ctx.createRadialGradient(usableW * 0.5, viewH * 0.55, 50, usableW * 0.5, viewH * 0.55, Math.max(viewW, viewH));
  g.addColorStop(0, "rgba(255,255,255,0.02)");
  g.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, usableW, viewH);

  drawPriceScale();
}

// ---------------------
// Drawing helpers
// ---------------------
function drawCandle(o) {
  const body = o.isGreen ? "#22c55e" : "#ff3b3b";

  ctx.fillStyle = body;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);

  const midX = o.x + o.w / 2;
  ctx.strokeStyle = body;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(midX, o.y - 14);
  ctx.lineTo(midX, o.y + o.h + 14);
  ctx.stroke();
}

// Ball rotation (existing)
let ballRot = 0;

// Rolling texture (NEW, we discussed)
let rollTex = 0;
let rollTexSmooth = 0;

function drawBallSeam(x, y, r) {
  // Ultra smooth forward roll:
  // uses rollTexSmooth (continuous, smoothed) and avoids % jump

  ctx.save();

  // clip to ball
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Spacing of bands
  const spacing = r * 0.55;

  // Continuous offset (no sin, no back/forth)
 const offRaw = rollTexSmooth * 0.35;
 const off = ((offRaw % spacing) + spacing) % spacing; // ✅ wrap 0..spacing (keine Unsichtbarkeit)


  ctx.lineWidth = 2;

  // Draw enough bands so no gaps show
  for (let k = -10; k <= 10; k++) {
    const yy = y + k * spacing - off;

    // fade bands near edges for smooth look
    const dist = Math.abs((yy - y) / r);
    const alpha = Math.max(0, 0.22 * (1 - dist));
    if (alpha <= 0.01) continue;

    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, yy, r * 0.95, r * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // One darker seam for strong rolling cue
  const seamY = y - off * 0.9;
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(x, seamY, r * 0.94, r * 0.22, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawBallSolid(x, y, r, color, rot) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.15, color);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // UPDATED (we discussed): no rot param here
  drawBallSeam(x, y, r);
}

function drawBallGoldShimmer(x, y, r, t, rot) {
  const base = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  base.addColorStop(0, "#fff6c9");
  base.addColorStop(0.25, "#ffd700");
  base.addColorStop(1, "#8a6b00");

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // shimmer sweep
  const angle = (t * 1.4) % (Math.PI * 2);
  const dx = Math.cos(angle) * r * 0.9;
  const dy = Math.sin(angle) * r * 0.9;

  const shimmer = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
  shimmer.addColorStop(0.00, "rgba(255,255,255,0)");
  shimmer.addColorStop(0.48, "rgba(255,255,255,0.00)");
  shimmer.addColorStop(0.50, "rgba(255,255,255,0.65)");
  shimmer.addColorStop(0.52, "rgba(255,255,255,0.00)");
  shimmer.addColorStop(1.00, "rgba(255,255,255,0)");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = shimmer;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // UPDATED (we discussed): no rot param here
  drawBallSeam(x, y, r);
}

function drawBallRainbow(x, y, r, t, rot) {
  const hue = (t * 80) % 360;
  const c1 = `hsl(${hue}, 90%, 60%)`;
  const c2 = `hsl(${(hue + 120) % 360}, 90%, 60%)`;
  const c3 = `hsl(${(hue + 240) % 360}, 90%, 60%)`;

  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
  g.addColorStop(0.00, "#ffffff");
  g.addColorStop(0.20, c1);
  g.addColorStop(0.55, c2);
  g.addColorStop(1.00, c3);

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // UPDATED (we discussed): no rot param here
  drawBallSeam(x, y, r);
}

// ---------------------
// Game Loop
// ---------------------
let last = performance.now();
let timeAlive = 0;
let score = 0;

function resetGame() {
  obstacles.length = 0;
  spawnTimer = SPAWN_INTERVAL;
  timeAlive = 0;
  score = 0;
  bgScroll = 0;
  ballRot = 0;
  rollTex = 0;
  rollTexSmooth = 0;

  player.x = playW() / 2;
  player.y = viewH - 90;
  moveDir = 0;

  last = performance.now();
}

function update(dt) {
  if (state !== "playing") return;

  timeAlive += dt;
  score += dt * 10;

  // XP gain over time (stored)
  addXP(XP_PER_SEC * dt);

  // Player move
  player.x += moveDir * player.speed * dt;
  clampPlayer();

  // Spawn candles
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnCandle(timeAlive);
    spawnTimer = SPAWN_INTERVAL;
  }

  // Move candles
  const spd = currentSpeed(timeAlive);
  for (const o of obstacles) o.y += spd * dt;

  // Ball rolling forward: rotation based on forward speed
  ballRot += (spd * dt) / Math.max(8, player.r);

  // Rolling texture (NEW): smooth forward scrolling
  rollTex += spd * dt;
  const SMOOTH = 0.08; // kleiner = smoother
  rollTexSmooth += (rollTex - rollTexSmooth) * SMOOTH;

  // Remove off-screen
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].y > viewH + 140) obstacles.splice(i, 1);
  }

  // Collision:
  // red -> game over
  // green -> XP bonus and remove
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (circleRectCollision(player.x, player.y, player.r, o.x, o.y, o.w, o.h)) {
      if (o.isGreen) {
        addXP(GREEN_BONUS_XP);
        obstacles.splice(i, 1);
      } else {
        state = "gameover";
        stopMove();
        overlay.classList.remove("hidden");
      }
      break;
    }
  }
}

function drawHUD(spd) {
  // HUD box
  const x = 10, y = 8, w = 190, h = 78;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, w, h);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "14px Arial";
  ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, x + 10, y + 24);
  ctx.fillText(`Score: ${Math.floor(score)}`, x + 10, y + 44);
  ctx.fillText(`XP: ${Math.floor(totalXP)}`, x + 10, y + 64);
  ctx.fillText(`Speed: ${Math.round(spd)}`, x + 110, y + 64);
}

function draw(dt) {
  const spd = currentSpeed(timeAlive);
  drawBackground(spd, dt);

  // Candles
  for (const o of obstacles) drawCandle(o);

  // Ball
  const b = getBallById(selectedBallId);
  const t = timeAlive;

  if (b.type === "solid") drawBallSolid(player.x, player.y, player.r, b.value, ballRot);
  else if (b.type === "goldFX") drawBallGoldShimmer(player.x, player.y, player.r, t, ballRot);
  else drawBallRainbow(player.x, player.y, player.r, t, ballRot);

  if (state === "playing") drawHUD(spd);
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ---------------------
// UI Screens / State
// ---------------------
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

  updateShopXPUI();
  shopSelectedId = selectedBallId;

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

// Start in menu
openMenu();
updateShopXPUI();
