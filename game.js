const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// UI elements
const ui = document.getElementById("ui");
const screenMenu = document.getElementById("screen-menu");
const screenShop = document.getElementById("screen-shop");
const screenSettings = document.getElementById("screen-settings");

const btnPlay = document.getElementById("btnPlay");
const btnShop = document.getElementById("btnShop");
const btnSettings = document.getElementById("btnSettings");

const btnBackFromShop = document.getElementById("btnBackFromShop");
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
    moveDir = clientX < (viewW / 2) ? -1 : 1;
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
// Obstacles (all equal size)
// ---------------------
const obstacles = [];
const OBS_W = 100;
const OBS_H = 22;

const SPAWN_INTERVAL = 0.85;
let spawnTimer = SPAWN_INTERVAL;

// Difficulty settings
const BASE_SPEED = 210;
// SPEED_INCREASE is controlled by slider and saved
let SPEED_INCREASE = loadNumber("speedIncrease", 2);

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function currentObstacleSpeed(timeAliveSeconds) {
    return BASE_SPEED + SPEED_INCREASE * timeAliveSeconds;
}

function spawnObstacle(timeAliveSeconds) {
    const x = rand(10, viewW - OBS_W - 10);
    const y = -OBS_H - 10;

    obstacles.push({
        x, y,
        w: OBS_W,
        h: OBS_H,
        speed: currentObstacleSpeed(timeAliveSeconds)
    });
}

// ---------------------
// Collision circle vs rect
// ---------------------
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
const COLORS = [
    { name: "Gold", value: "#ffd400" },
    { name: "Red", value: "#ff4d4d" },
    { name: "Blue", value: "#4da6ff" },
    { name: "Green", value: "#4dff88" },
    { name: "Purple", value: "#a24dff" },
    { name: "White", value: "#ffffff" },
];

let ballColor = loadString("ballColor", "#ffd400");

function buildColorGrid() {
    colorGrid.innerHTML = "";

    for (const c of COLORS) {
        const btn = document.createElement("button");
        btn.className = "color-btn";
        btn.style.background = c.value;

        if (c.value === ballColor) btn.classList.add("selected");

        btn.addEventListener("click", () => {
            ballColor = c.value;
            saveString("ballColor", ballColor);
            selectedColorName.textContent = c.name;
            buildColorGrid(); // refresh selection border
        });

        colorGrid.appendChild(btn);
    }

    const current = COLORS.find(x => x.value === ballColor);
    selectedColorName.textContent = current ? current.name : "Custom";
}

// ---------------------
// Simple storage helpers
// ---------------------
function saveString(key, val) {
    localStorage.setItem(key, String(val));
}
function loadString(key, fallback) {
    const v = localStorage.getItem(key);
    return v !== null ? v : fallback;
}
function saveNumber(key, val) {
    localStorage.setItem(key, String(val));
}
function loadNumber(key, fallback) {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// ---------------------
// UI Screens
// ---------------------
let state = "menu"; // menu | shop | settings | playing | gameover

function showOnly(screen) {
    screenMenu.classList.add("hidden");
    screenShop.classList.add("hidden");
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

function openShop() {
    state = "shop";
    overlay.classList.add("hidden");
    ui.classList.remove("hidden");
    buildColorGrid();
    showOnly(screenShop);
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
btnShop.addEventListener("click", openShop);
btnSettings.addEventListener("click", openSettings);

btnBackFromShop.addEventListener("click", openMenu);
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
// Game State / Loop
// ---------------------
let last = performance.now();
let timeAlive = 0;

function resetGame() {
    obstacles.length = 0;
    spawnTimer = SPAWN_INTERVAL;
    timeAlive = 0;

    player.x = viewW / 2;
    player.y = viewH - 80;
    moveDir = 0;

    last = performance.now();
}

function update(dt) {
    if (state !== "playing") return;

    timeAlive += dt;

    // Move player
    player.x += moveDir * player.speed * dt;
    clampPlayer();

    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle(timeAlive);
        spawnTimer = SPAWN_INTERVAL;
    }

    // Move obstacles
    for (const o of obstacles) {
        o.y += o.speed * dt;
    }

    // Remove off-screen
    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].y > viewH + 50) obstacles.splice(i, 1);
    }

    // Collision
    for (const o of obstacles) {
        if (circleRectCollision(player.x, player.y, player.r, o.x, o.y, o.w, o.h)) {
            state = "gameover";
            stopMove();
            overlay.classList.remove("hidden");
            break;
        }
    }
}

function draw() {
    // Background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, viewW, viewH);

    // Obstacles
    ctx.fillStyle = "#ff4d4d";
    for (const o of obstacles) {
        ctx.fillRect(o.x, o.y, o.w, o.h);
    }

    // Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fillStyle = ballColor;
    ctx.fill();

    // HUD (only during play)
    if (state === "playing") {
        ctx.fillStyle = "#fff";
        ctx.font = "16px Arial";
        ctx.fillText("Seeker Ball", 20, 30);
        ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, 20, 52);
        ctx.fillText(`Speed: ${Math.round(currentObstacleSpeed(timeAlive))}`, 20, 74);
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

// Start on menu
openMenu();
