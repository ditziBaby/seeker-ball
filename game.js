const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Overlay & Button
const overlay = document.getElementById("overlay");
const restartBtn = document.getElementById("restartBtn");

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
// Spieler (Ball)
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
// Input (Touch / Maus)
// ---------------------
let moveDir = 0;

function setDirFromX(clientX) {
    moveDir = clientX < (viewW / 2) ? -1 : 1;
}
function stopMove() { moveDir = 0; }

// Touch
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    setDirFromX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    setDirFromX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    stopMove();
}, { passive: false });

// Maus (PC)
canvas.addEventListener("mousedown", (e) => setDirFromX(e.clientX));
window.addEventListener("mouseup", () => stopMove());

// ---------------------
// Hindernisse
// ---------------------
const obstacles = [];

// Alle Balken gleich groß
const OBS_W = 100;
const OBS_H = 22;

// Spawn
const SPAWN_INTERVAL = 0.85;
let spawnTimer = SPAWN_INTERVAL;

// Geschwindigkeit (fair, langsam steigend)
const BASE_SPEED = 210;
const SPEED_INCREASE = 2;

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
        x,
        y,
        w: OBS_W,
        h: OBS_H,
        speed: currentObstacleSpeed(timeAliveSeconds)
    });
}

// ---------------------
// Kollision Ball vs Balken
// ---------------------
function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (cr * cr);
}

// ---------------------
// Game State
// ---------------------
let last = performance.now();
let timeAlive = 0;
let gameOver = false;

// Reset
function resetGame() {
    overlay.classList.add("hidden");
    obstacles.length = 0;
    spawnTimer = SPAWN_INTERVAL;
    timeAlive = 0;
    gameOver = false;

    player.x = viewW / 2;
    player.y = viewH - 80;
    moveDir = 0;

    last = performance.now();
}

// ---------------------
// Update & Draw
// ---------------------
function update(dt) {
    if (gameOver) return;

    timeAlive += dt;

    // Spieler bewegen
    player.x += moveDir * player.speed * dt;
    clampPlayer();

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle(timeAlive);
        spawnTimer = SPAWN_INTERVAL;
    }

    // Hindernisse bewegen
    for (const o of obstacles) {
        o.y += o.speed * dt;
    }

    // Entfernen
    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].y > viewH + 50) obstacles.splice(i, 1);
    }

    // Kollision
    for (const o of obstacles) {
        if (circleRectCollision(player.x, player.y, player.r, o.x, o.y, o.w, o.h)) {
            gameOver = true;
            moveDir = 0;
            overlay.classList.remove("hidden");
            break;
        }
    }
}

function draw() {
    // Hintergrund
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, viewW, viewH);

    // Hindernisse
    ctx.fillStyle = "#ff4d4d";
    for (const o of obstacles) {
        ctx.fillRect(o.x, o.y, o.w, o.h);
    }

    // Spieler
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd400";
    ctx.fill();

    // UI
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText("Seeker Ball", 20, 30);
    ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, 20, 52);
    ctx.fillText(`Speed: ${Math.round(currentObstacleSpeed(timeAlive))}`, 20, 74);
}

function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ---------------------
// Restart Button
// ---------------------
restartBtn.addEventListener("click", () => resetGame());
restartBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    resetGame();
}, { passive: false });
