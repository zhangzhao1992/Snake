const board = document.querySelector("#board");
const ctx = board.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const speedEl = document.querySelector("#speed");
const playerNameInput = document.querySelector("#playerName");
const leaderboardList = document.querySelector("#leaderboardList");
const leaderboardStatus = document.querySelector("#leaderboardStatus");
const clearScoresBtn = document.querySelector("#clearScoresBtn");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const restartBtn = document.querySelector("#restartBtn");

const cells = 24;
const startSnake = [
  { x: 8, y: 12 },
  { x: 7, y: 12 },
  { x: 6, y: 12 },
];
const apiBase = window.SNAKE_API_BASE || "";

let snake;
let food;
let direction;
let queuedDirection;
let score;
let best = Number(localStorage.getItem("snake-best") || 0);
let level;
let moveDelay;
let lastMoveAt;
let animationId;
let state;
let touchStart = null;
let leaderboard = loadLeaderboard();
let onlineLeaderboard = false;

const savedPlayerName = localStorage.getItem("snake-player-name");
if (savedPlayerName) playerNameInput.value = savedPlayerName;
best = getBestScore();
bestEl.textContent = best;
renderLeaderboard();
fetchLeaderboard();

function resetGame() {
  snake = startSnake.map((part) => ({ ...part }));
  direction = { x: 1, y: 0 };
  queuedDirection = { ...direction };
  score = 0;
  level = 1;
  moveDelay = 150;
  lastMoveAt = 0;
  state = "ready";
  placeFood();
  updateStats();
  draw();
  showOverlay("准备开始", "按空格、回车或点击开始。手机可滑动或使用方向键。", "开始游戏");
}

function startGame() {
  if (state === "running") return;
  if (state === "gameover") resetGame();
  state = "running";
  hideOverlay();
  lastMoveAt = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function pauseGame() {
  if (state === "running") {
    state = "paused";
    pauseBtn.textContent = "继续";
    showOverlay("已暂停", "点击继续、按空格或回车回到棋盘。", "继续游戏");
    return;
  }

  if (state === "paused" || state === "ready") {
    pauseBtn.textContent = "暂停";
    startGame();
  }
}

function endGame() {
  state = "gameover";
  saveScore();
  best = getBestScore();
  updateStats();
  showOverlay("游戏结束", `本局得分 ${score}。`, "再玩一局");
}

function loop(now) {
  if (state !== "running") return;
  if (now - lastMoveAt >= moveDelay) {
    step();
    lastMoveAt = now;
  }
  draw();
  animationId = requestAnimationFrame(loop);
}

function step() {
  direction = queuedDirection;
  const head = snake[0];
  const next = wrap({ x: head.x + direction.x, y: head.y + direction.y });

  if (snake.some((part) => part.x === next.x && part.y === next.y)) {
    endGame();
    return;
  }

  snake.unshift(next);

  if (next.x === food.x && next.y === food.y) {
    score += 10;
    level = 1 + Math.floor(score / 50);
    moveDelay = Math.max(62, 150 - (level - 1) * 9);
    placeFood();
  } else {
    snake.pop();
  }

  updateStats();
}

function wrap(point) {
  return {
    x: (point.x + cells) % cells,
    y: (point.y + cells) % cells,
  };
}

function placeFood() {
  const free = [];
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      if (!snake?.some((part) => part.x === x && part.y === y)) {
        free.push({ x, y });
      }
    }
  }
  food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
}

function setDirection(next) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const candidate = directions[next];
  if (!candidate) return;

  const reversing = candidate.x + direction.x === 0 && candidate.y + direction.y === 0;
  if (!reversing) queuedDirection = candidate;
  if (state === "ready") startGame();
}

function draw() {
  const size = board.width;
  const unit = size / cells;
  ctx.clearRect(0, 0, size, size);
  drawGrid(unit);
  drawFood(unit);
  drawSnake(unit);
}

function drawGrid(unit) {
  ctx.fillStyle = "#101912";
  ctx.fillRect(0, 0, board.width, board.height);

  ctx.strokeStyle = "rgba(242, 246, 236, 0.055)";
  ctx.lineWidth = 1;
  for (let i = 1; i < cells; i += 1) {
    const line = Math.round(i * unit) + 0.5;
    ctx.beginPath();
    ctx.moveTo(line, 0);
    ctx.lineTo(line, board.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, line);
    ctx.lineTo(board.width, line);
    ctx.stroke();
  }
}

function drawFood(unit) {
  const centerX = food.x * unit + unit / 2;
  const centerY = food.y * unit + unit / 2;
  const radius = unit * 0.31;

  ctx.fillStyle = "#ff6b5f";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(centerX - radius * 0.32, centerY - radius * 0.36, radius * 0.23, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(unit) {
  snake.forEach((part, index) => {
    const inset = index === 0 ? unit * 0.12 : unit * 0.16;
    const x = part.x * unit + inset;
    const y = part.y * unit + inset;
    const size = unit - inset * 2;

    ctx.fillStyle = index === 0 ? "#7be58b" : index % 2 ? "#52bf69" : "#43ad5f";
    roundRect(x, y, size, size, unit * 0.18);
    ctx.fill();

    if (index === 0) drawEyes(part, unit);
  });
}

function drawEyes(head, unit) {
  const eyeRadius = unit * 0.055;
  const baseX = head.x * unit + unit / 2;
  const baseY = head.y * unit + unit / 2;
  const sideX = direction.y !== 0 ? unit * 0.16 : 0;
  const sideY = direction.x !== 0 ? unit * 0.16 : 0;
  const forwardX = direction.x * unit * 0.18;
  const forwardY = direction.y * unit * 0.18;

  ctx.fillStyle = "#0b1710";
  ctx.beginPath();
  ctx.arc(baseX + sideX + forwardX, baseY + sideY + forwardY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(baseX - sideX + forwardX, baseY - sideY + forwardY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function updateStats() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  speedEl.textContent = `${level}x`;
}

function getPlayerName() {
  const name = playerNameInput.value.trim().replace(/\s+/g, " ");
  return name || "玩家1";
}

function loadLeaderboard() {
  try {
    const records = JSON.parse(localStorage.getItem("snake-leaderboard") || "[]");
    return normalizeRecords(records);
  } catch {
    return [];
  }
}

function saveLeaderboard() {
  localStorage.setItem("snake-leaderboard", JSON.stringify(leaderboard));
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((item) => item?.name && Number.isFinite(Number(item?.score)))
    .map((item) => ({
      name: String(item.name).trim().slice(0, 16) || "玩家1",
      score: Math.max(0, Math.floor(Number(item.score))),
      date: item.date || new Date().toISOString(),
    }))
    .sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date))
    .slice(0, 50);
}

function getBestScore() {
  const legacyBest = Number(localStorage.getItem("snake-best") || 0);
  const boardBest = leaderboard.reduce((max, item) => Math.max(max, item.score), 0);
  return Math.max(legacyBest, boardBest);
}

async function fetchLeaderboard() {
  try {
    const response = await fetch(`${apiBase}/api/scores`, { cache: "no-store" });
    if (!response.ok) throw new Error("排行榜读取失败");
    const data = await response.json();
    leaderboard = normalizeRecords(data.scores);
    onlineLeaderboard = true;
    saveLeaderboard();
    best = getBestScore();
    updateStats();
    renderLeaderboard();
  } catch {
    onlineLeaderboard = false;
    renderLeaderboard();
  }
}

async function saveScore() {
  const name = getPlayerName();
  localStorage.setItem("snake-player-name", name);

  const record = {
    name,
    score,
    date: new Date().toISOString(),
  };

  leaderboard = normalizeRecords([...leaderboard, record]);
  saveLeaderboard();
  renderLeaderboard();

  try {
    const response = await fetch(`${apiBase}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error("分数提交失败");
    const data = await response.json();
    leaderboard = normalizeRecords(data.scores);
    onlineLeaderboard = true;
    saveLeaderboard();
    best = getBestScore();
    updateStats();
    renderLeaderboard();
  } catch {
    onlineLeaderboard = false;
    renderLeaderboard();
  }
}

function renderLeaderboard() {
  const topScores = leaderboard.slice(0, 10);
  leaderboardList.replaceChildren();
  leaderboardStatus.textContent = onlineLeaderboard ? "在线" : "本机";

  if (topScores.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "还没有分数";
    leaderboardList.append(empty);
    return;
  }

  topScores.forEach((record, index) => {
    const item = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = record.name;

    const points = document.createElement("span");
    points.className = "points";
    points.textContent = record.score;

    item.append(rank, name, points);
    leaderboardList.append(item);
  });
}

function showOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
  pauseBtn.textContent = "暂停";
}

function handleKey(event) {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (keyMap[event.key]) {
    event.preventDefault();
    setDirection(keyMap[event.key]);
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (state === "running") pauseGame();
    else startGame();
  }
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? "right" : "left");
  } else {
    setDirection(dy > 0 ? "down" : "up");
  }
}

startBtn.addEventListener("click", () => {
  if (state === "paused") pauseGame();
  else startGame();
});
pauseBtn.addEventListener("click", pauseGame);
restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});
document.addEventListener("keydown", handleKey);
board.addEventListener("touchstart", handleTouchStart, { passive: true });
board.addEventListener("touchend", handleTouchEnd, { passive: true });
document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => setDirection(button.dataset.dir));
});
playerNameInput.addEventListener("change", () => {
  playerNameInput.value = getPlayerName();
  localStorage.setItem("snake-player-name", playerNameInput.value);
});
playerNameInput.addEventListener("keydown", (event) => {
  event.stopPropagation();
});
clearScoresBtn.addEventListener("click", fetchLeaderboard);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

resetGame();
