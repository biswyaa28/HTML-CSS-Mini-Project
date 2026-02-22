/* LASER DEFENDER */

// ─── Audio ──────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function beep(freq = 440, dur = 0.1, type = "square", vol = 0.12) {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

const sfx = {
  click: () => beep(800, 0.08),
  shoot: () => beep(1200, 0.05),
  hit: () => beep(300, 0.15, "sawtooth"),
  kill: () => {
    beep(500, 0.1);
    setTimeout(() => beep(700, 0.1), 50);
  },
  death: () => {
    beep(200, 0.3, "sawtooth");
    setTimeout(() => beep(150, 0.4, "sawtooth"), 100);
  },
  gameOver: () => {
    beep(400, 0.2);
    setTimeout(() => beep(300, 0.2), 200);
    setTimeout(() => beep(200, 0.4), 400);
  },
  start: () => {
    beep(800, 0.1);
    setTimeout(() => beep(1000, 0.1), 80);
    setTimeout(() => beep(1200, 0.15), 160);
  },
  wave: () => {
    beep(523, 0.08);
    setTimeout(() => beep(659, 0.08), 90);
    setTimeout(() => beep(784, 0.12), 180);
  },
  easter: () =>
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((n, i) =>
      setTimeout(() => beep(n, 0.15), i * 80),
    ),
};

// ─── SPA Navigation ─────────────────────────────────
// Cache page sections & nav links once
const _pageSections = document.querySelectorAll(".page-section");
const _navLinks = document.querySelectorAll("[data-section]");

function navigateTo(section) {
  _pageSections.forEach((s) => s.classList.remove("active"));
  const el = document.getElementById("sec-" + section);
  if (el) {
    el.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  _navLinks.forEach((a) => a.classList.remove("active"));
  document
    .querySelectorAll(`[data-section="${section}"]`)
    .forEach((a) => a.classList.add("active"));
  if (section === "leaderboard") {
    renderLeaderboard();
    renderAchievements();
  }
  if (section === "home") {
    renderPersonalBest();
    animateCounters();
  }
  if (section === "game") {
    resetGame();
  }
  document.getElementById("navLinks")?.classList.remove("open");
  const h = document.getElementById("navHamburger");
  if (h) h.textContent = "☰";
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-section]");
  if (link) {
    e.preventDefault();
    navigateTo(link.getAttribute("data-section"));
    sfx.click();
  }
});

// ─── Animated Counters ──────────────────────────────
function animateCounters() {
  document.querySelectorAll("[data-target]").forEach((el) => {
    const target = +el.dataset.target,
      suffix = el.dataset.suffix || "";
    let cur = 0;
    const inc = target / 125;
    const tick = () => {
      cur += inc;
      if (cur < target) {
        el.textContent = Math.floor(cur).toLocaleString() + suffix;
        requestAnimationFrame(tick);
      } else el.textContent = target.toLocaleString() + suffix;
    };
    new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting) {
          tick();
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 },
    ).observe(el);
  });
}

// ─── Leaderboard ────────────────────────────────────
const LB_KEY = "laserDefenderScores";
const getBoard = () => {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || [];
  } catch {
    return [];
  }
};
const clearBoard = () => localStorage.removeItem(LB_KEY);

function saveScore(name, score, stats = {}) {
  const board = getBoard();
  board.push({
    name: name || "PILOT",
    score,
    accuracy: stats.accuracy || 0,
    enemiesKilled: stats.enemiesKilled || 0,
    timeSurvived: stats.timeSurvived || 0,
    difficulty: stats.difficulty || "NORMAL",
    date: new Date().toLocaleDateString(),
  });
  board.sort((a, b) => b.score - a.score);
  board.splice(20);
  localStorage.setItem(LB_KEY, JSON.stringify(board));
}

function renderLeaderboard() {
  const board = getBoard(),
    el = document.getElementById("leaderboardContent"),
    sg = document.getElementById("statsGrid");
  if (!el) return;
  if (!board.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🕹️</div><p style="font-family:'Press Start 2P',cursive;font-size:.8rem;color:var(--gold)">NO SCORES YET</p><p>Play the game and set your first high score!</p><a href="#" data-section="game" class="action-btn" style="margin-top:1rem;display:inline-block">▶ START MISSION</a></div>`;
    if (sg)
      sg.innerHTML = [
        "GAMES PLAYED",
        "BEST SCORE",
        "AVG ACCURACY",
        "TOTAL KILLS",
      ]
        .map(
          (l) =>
            `<div class="stat-card"><div class="stat-value" style="font-size:1.5rem">—</div><div class="stat-label">${l}</div></div>`,
        )
        .join("");
    return;
  }
  const icon = (i) => (i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`);
  const cls = (i) => (i < 3 ? `rank-${i + 1}` : "");
  el.innerHTML = `<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Pilot</th><th>Score</th><th>Acc</th><th>Kills</th><th>Mode</th><th>Date</th></tr></thead><tbody>${board.map((e, i) => `<tr class="fade-in-up"><td class="rank ${cls(i)}">${icon(i)}</td><td>${e.name}</td><td class="player-score">${e.score.toLocaleString()}</td><td>${e.accuracy}%</td><td>${e.enemiesKilled || 0}</td><td class="text-cyan">${e.difficulty || "NORMAL"}</td><td style="color:#888">${e.date}</td></tr>`).join("")}</tbody></table>`;
  if (sg) {
    const t = board.length,
      b = board[0].score;
    const a = Math.round(board.reduce((s, e) => s + (e.accuracy || 0), 0) / t);
    const k = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0);
    sg.innerHTML = [
      [t, "GAMES PLAYED"],
      [b, "BEST SCORE"],
      [a, "AVG ACCURACY", "%"],
      [k, "TOTAL KILLS"],
    ]
      .map(
        ([v, l, s]) =>
          `<div class="stat-card fade-in-up"><div class="stat-value" data-target="${v}"${s ? ` data-suffix="${s}"` : ""}>${v}</div><div class="stat-label">${l}</div></div>`,
      )
      .join("");
    animateCounters();
  }
}

// ─── Achievements ───────────────────────────────────
function renderAchievements() {
  const grid = document.getElementById("achievementGrid");
  if (!grid) return;
  const board = getBoard(),
    best = board[0]?.score || 0;
  const kills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0),
    games = board.length;
  grid.innerHTML = [
    ["🚀", "FIRST FLIGHT", "Play your first game", games >= 1],
    ["💯", "CENTURY", "Score 100+", best >= 100],
    ["⭐", "RISING STAR", "Score 500+", best >= 500],
    ["🔥", "ON FIRE", "Score 1,000+", best >= 1000],
    ["💎", "DIAMOND", "Score 5,000+", best >= 5000],
    ["👾", "HUNTER", "Destroy 50 enemies", kills >= 50],
    ["🎯", "MARKSMAN", "Destroy 200 enemies", kills >= 200],
    [
      "💀",
      "HARD CORE",
      "Score on HARD",
      board.some((e) => e.difficulty === "HARD"),
    ],
    ["🏆", "VETERAN", "Play 10+ games", games >= 10],
    [
      "🕵️",
      "SECRET AGENT",
      "Find the Konami code",
      !!localStorage.getItem("konamiFound"),
    ],
  ]
    .map(
      ([i, n, d, ok]) =>
        `<div class="achievement-badge ${ok ? "unlocked" : "locked"} fade-in-up"><div class="achievement-icon">${i}</div><div class="achievement-name">${n}</div><p class="achievement-desc">${d}</p></div>`,
    )
    .join("");
}

// ─── Personal Best ──────────────────────────────────
function renderPersonalBest() {
  const banner = document.getElementById("personalBestBanner");
  if (!banner) return;
  const board = getBoard();
  if (board.length) {
    const b = board[0];
    banner.innerHTML = `<span class="pb-label">🏆 YOUR BEST</span><span class="pb-value">${b.score.toLocaleString()}</span><span class="pb-label">BY ${b.name}</span><span class="pb-value text-cyan" style="font-size:.65rem">${b.difficulty || "NORMAL"}</span>`;
    banner.classList.remove("no-score");
  } else {
    banner.innerHTML = `<span class="pb-label">NO SCORE YET —</span><a href="#" data-section="game" style="color:var(--emerald);font-family:'Press Start 2P',cursive;font-size:.55rem">PLAY NOW ▶</a>`;
    banner.classList.add("no-score");
  }
}

// ─── Typewriter ─────────────────────────────────────
function typewriter(el, text, speed = 35) {
  el.textContent = "";
  el.classList.add("typewriter-active");
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) {
      clearInterval(t);
      el.classList.remove("typewriter-active");
    }
  }, speed);
}

// ─── Toast ──────────────────────────────────────────
function toast(msg, ms = 4000) {
  document.getElementById("eggToast")?.remove();
  const el = document.createElement("div");
  el.id = "eggToast";
  el.textContent = msg;
  el.style.cssText = `position:fixed;top:4.5rem;left:50%;transform:translateX(-50%);background:rgba(18,16,28,.97);border:2px solid var(--lavender);color:var(--iron);font-family:'VT323',monospace;font-size:1.2rem;padding:.6rem 1.4rem;z-index:99997;white-space:nowrap;animation:fadeInUp .3s ease-out;box-shadow:0 4px 12px rgba(196,183,235,.25)`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .4s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 450);
  }, ms);
}

// ─── Easter Eggs ────────────────────────────────────
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let konamiIdx = 0;
let dotSeq = [],
  dotTimer = null;
const DOT_ORDER = ["dot-red", "dot-yellow", "dot-green"];

document.addEventListener("click", (e) => {
  const dot = e.target.closest(".terminal-dot");
  if (dot) {
    const cls = DOT_ORDER.find((c) => dot.classList.contains(c));
    if (cls) {
      clearTimeout(dotTimer);
      dotSeq.push(cls);
      dotTimer = setTimeout(() => {
        dotSeq = [];
      }, 3000);
      if (dotSeq.every((c, i) => c === DOT_ORDER[i]) && dotSeq.length <= 3) {
        if (dotSeq.length === 3) {
          dotSeq = [];
          runHackSequence();
        }
      } else dotSeq = [];
    }
  }
  if (e.target.closest(".footer-bottom p")) {
    beep(400, 0.06);
    toast("🫡 Built at 2am with chai & determination");
  }
});

function runHackSequence() {
  const tw = document.querySelector(".terminal-window");
  if (!tw) return;
  const body = tw.querySelector(".terminal-body"),
    orig = body.innerHTML;
  const lines = [
    "> INITIALIZING BREACH...",
    "> BYPASSING FIREWALL [██████████] ✓",
    "> ACCESSING MAINFRAME...",
    "> +500 POINTS DEPOSITED ✓",
    "> CONNECTION TERMINATED.",
  ];
  body.innerHTML = `<div style="text-align:left;padding:.5rem 0"><p style="font-family:'Press Start 2P',cursive;font-size:.55rem;color:var(--mint);margin-bottom:1rem">ACCESS GRANTED 🟢</p><div id="hackLines" style="font-size:1.1rem;color:var(--mint);line-height:2"></div></div>`;
  const container = document.getElementById("hackLines");
  let i = 0;
  beep(200, 0.05);
  const tick = setInterval(() => {
    if (i < lines.length) {
      const p = document.createElement("p");
      p.textContent = lines[i];
      p.style.color = lines[i].includes("✓") ? "#f0c85a" : "var(--mint)";
      container.appendChild(p);
      beep(300 + Math.random() * 200, 0.03);
      i++;
    } else {
      clearInterval(tick);
      const prev = +(localStorage.getItem("laserDefenderBonus") || 0);
      localStorage.setItem("laserDefenderBonus", String(prev + 500));
      localStorage.setItem("hackFound", "1");
      setTimeout(() => {
        body.innerHTML = orig;
        toast("💾 +500 bonus points banked!");
      }, 2500);
    }
  }, 350);
}

let idleTimer = null,
  ufoActive = false;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (ufoActive) return;
    ufoActive = true;
    const ufo = document.createElement("div");
    ufo.innerHTML = "🛸";
    ufo.style.cssText = `position:fixed;top:${20 + Math.random() * 40}%;left:-80px;font-size:2.5rem;z-index:9997;pointer-events:none;animation:ufoFly 5s linear forwards`;
    document.body.appendChild(ufo);
    toast("👀 Was that a UFO?!", 2500);
    setTimeout(() => {
      ufo.remove();
      ufoActive = false;
      resetIdleTimer();
    }, 5200);
  }, 18000);
}

function initScrollTop() {
  const btn = document.createElement("button");
  btn.className = "scroll-top-btn";
  btn.textContent = "▲ TOP";
  document.body.appendChild(btn);
  window.addEventListener("scroll", () =>
    btn.classList.toggle("visible", window.scrollY > 400),
  );
  btn.addEventListener("click", () => {
    sfx.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ═══════════════════════════════════════════════
   GAME ENGINE
   ═══════════════════════════════════════════════ */
const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d");

// ─── Cached DOM elements for the hot game loop ──────
const DOM = {
  score: document.getElementById("score"),
  lives: document.getElementById("lives"),
  waveDisplay: document.getElementById("waveDisplay"),
  timeDisplay: document.getElementById("timeDisplay"),
  modeDisplay: document.getElementById("modeDisplay"),
  difficultyScreen: document.getElementById("difficultyScreen"),
  pauseOverlay: document.getElementById("pauseOverlay"),
  gameOverEl: document.getElementById("gameOver"),
  finalScore: document.getElementById("finalScore"),
  finalKills: document.getElementById("finalKills"),
  finalAccuracy: document.getElementById("finalAccuracy"),
  finalTime: document.getElementById("finalTime"),
  finalDifficulty: document.getElementById("finalDifficulty"),
  finalWave: document.getElementById("finalWave"),
  savedMsg: document.getElementById("savedMsg"),
  playerName: document.getElementById("playerName"),
  gameContainer: document.getElementById("gameContainer"),
};

// ─── Pre-create & cache the background gradient ─────
const bgGradient = ctx.createLinearGradient(0, 0, 0, 800);
bgGradient.addColorStop(0, "#0f1a0f");
bgGradient.addColorStop(1, "#081008");

const C = {
  pBody: "#7ec8a0",
  pDark: "#5fa880",
  pHi: "#a2dbb8",
  bullet: "#f5e6a3",
  bulletSh: "#e0cc80",
  enemy: "#e88d8d",
  eDark: "#cc6666",
  eHi: "#f0b6c5",
  particle: "#f7c5a8",
  star: "#d4cce0",
  bgTop: "#0f1a0f",
  bgBot: "#081008",
};

let player,
  bullets,
  enemies,
  particles,
  stars = [];
let score,
  lives,
  keys = {};
let gameRunning, gamePaused, gameStarted, frame;
let waveNumber,
  killsThisWave,
  shotsFired,
  shotsHit,
  enemiesKilled,
  startTime,
  elapsedTime;
let difficulty,
  enemySpawnRate,
  enemySpeedMult,
  konamiBonus,
  lastShot = 0,
  idleRunning = true;
const KILLS_PER_WAVE = 8;

for (let i = 0; i < 60; i++)
  stars.push({
    x: Math.random() * 600,
    y: Math.random() * 800,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 2 + 0.5,
  });

document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      triggerKonami();
      konamiIdx = 0;
    }
  } else konamiIdx = 0;
  if (
    (e.key === "Escape" || e.key === "p" || e.key === "P") &&
    gameStarted &&
    gameRunning
  )
    togglePause();
});
document.addEventListener("keyup", (e) => (keys[e.key] = false));
canvas.addEventListener("click", () => {
  if (gameStarted) shoot();
});

function triggerKonami() {
  sfx.easter();
  localStorage.setItem("laserDefenderBonus", "1000");
  localStorage.setItem("konamiFound", "1");
  const ov = document.createElement("div");
  ov.className = "easter-egg-overlay";
  ov.innerHTML = `<div class="easter-egg-content"><h2>🎮 SECRET UNLOCKED!</h2><p>You found the Konami Code!</p><p style="font-size:3rem;margin:1rem 0">⬆⬆⬇⬇⬅➡⬅➡🅱🅰</p><p style="color:var(--gold);font-family:'Press Start 2P',cursive;font-size:.7rem">+1000 BONUS POINTS!</p><button class="action-btn" style="margin-top:1.5rem" onclick="this.closest('.easter-egg-overlay').remove()">AWESOME!</button></div>`;
  document.body.appendChild(ov);
  setTimeout(() => ov.parentElement && ov.remove(), 8000);
}

function startGame(diff) {
  difficulty = diff;
  sfx.start();
  [lives, enemySpawnRate, enemySpeedMult, player.speed] = {
    easy: [5, 80, 0.7, 7],
    normal: [3, 60, 1, 6],
    hard: [1, 40, 1.5, 5],
  }[diff];
  DOM.lives.textContent = lives;
  DOM.modeDisplay.textContent = diff.toUpperCase();
  DOM.difficultyScreen.style.display = "none";
  gameStarted = true;
  gameRunning = true;
  startTime = Date.now();
  waveNumber = 1;
  killsThisWave = 0;
  DOM.waveDisplay.textContent = "1";
  konamiBonus = +(localStorage.getItem("laserDefenderBonus") || 0);
  if (konamiBonus > 0) {
    score = konamiBonus;
    DOM.score.textContent = score;
    localStorage.removeItem("laserDefenderBonus");
    konamiBonus = 0;
  }
  gameLoop();
  idleRunning = false;
}

function togglePause() {
  gamePaused = !gamePaused;
  DOM.pauseOverlay.style.display = gamePaused ? "flex" : "none";
  gamePaused
    ? ((elapsedTime = Date.now() - startTime), beep(400, 0.1))
    : ((startTime = Date.now() - elapsedTime), beep(600, 0.05));
}

function shoot() {
  if (!gameRunning || gamePaused) return;
  const now = Date.now();
  if (now - lastShot < 150) return;
  lastShot = now;
  bullets.push({ x: player.x + 24, y: player.y, w: 8, h: 16, speed: 14 });
  shotsFired++;
  sfx.shoot();
}

function spawnEnemy() {
  enemies.push({
    x: Math.random() * 552,
    y: -50,
    w: 48,
    h: 48,
    speed: (2 + Math.random() * 3) * enemySpeedMult,
    health: 2,
    type: Math.random() > 0.7 ? "fast" : "normal",
  });
}

function boom(x, y, color) {
  for (let i = 0; i < 12; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 25,
      color,
      size: Math.random() * 4 + 2,
    });
}
function collides(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
function flash(id) {
  const el = DOM[id] || document.getElementById(id);
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 200);
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function pixRect(x, y, w, h, main, dark, light) {
  ctx.fillStyle = main;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x + w - 3, y, 3, h);
}

function drawPlayer() {
  const { x, y, w, h } = player;
  pixRect(x + 4, y + 8, w - 8, h - 12, C.pBody, C.pDark, C.pHi);
  ctx.fillStyle = "#5fa880";
  ctx.fillRect(x + 18, y + 4, 12, 8);
  pixRect(x, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0");
  pixRect(x + w - 8, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0");
  const a = 0.6 + Math.sin(frame * 0.3) * 0.4;
  ctx.fillStyle = `rgba(247,197,168,${a})`;
  ctx.fillRect(x + 18, y + h, 12, 4);
  ctx.fillStyle = `rgba(245,230,163,${a})`;
  ctx.fillRect(x + 20, y + h + 4, 8, 2);
}

function drawEnemy(e) {
  const { x, y, w, h } = e,
    f = e.type === "fast";
  pixRect(
    x + 2,
    y + 2,
    w - 4,
    h - 4,
    f ? "#f0b6c5" : C.enemy,
    f ? "#d890a0" : C.eDark,
    f ? "#f8d4de" : C.eHi,
  );
  ctx.fillStyle = "#f5e6a3";
  ctx.fillRect(x + 10, y + 12, 8, 8);
  ctx.fillRect(x + w - 18, y + 12, 8, 8);
  ctx.fillStyle = "#1e1830";
  ctx.fillRect(x + 14, y + 16, 4, 4);
  ctx.fillRect(x + w - 14, y + 16, 4, 4);
  ctx.fillRect(x + 14, y + 30, 20, 4);
}

function update() {
  if (!gameRunning || gamePaused) return;
  frame++;
  elapsedTime = Date.now() - startTime;
  DOM.timeDisplay.textContent = fmtTime(elapsedTime);

  if (keys["ArrowLeft"] || keys["a"])
    player.x = Math.max(0, player.x - player.speed);
  if (keys["ArrowRight"] || keys["d"])
    player.x = Math.min(552, player.x + player.speed);
  if (keys[" "]) shoot();

  // Filter bullets in-place (avoid creating new array every frame)
  let bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].y -= bullets[i].speed;
    if (bullets[i].y > -20) {
      bullets[bWrite++] = bullets[i];
    }
  }
  bullets.length = bWrite;

  if (frame % enemySpawnRate === 0) spawnEnemy();

  // Stars — use for loop
  for (let i = 0; i < stars.length; i++) {
    stars[i].y += stars[i].speed;
    if (stars[i].y > 800) {
      stars[i].y = 0;
      stars[i].x = Math.random() * 600;
    }
  }

  // Enemy update — mark bullets to remove instead of splice inside forEach
  for (let ei = 0; ei < enemies.length; ei++) {
    const e = enemies[ei];
    e.y += e.speed;
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.dead) continue;
      if (collides(b, e)) {
        b.dead = true;
        shotsHit++;
        e.health--;
        sfx.hit();
        if (e.health <= 0) {
          boom(e.x + 24, e.y + 24, C.particle);
          score += e.type === "fast" ? 20 : 10;
          enemiesKilled++;
          killsThisWave++;
          DOM.score.textContent = score;
          flash("score");
          sfx.kill();
          e.dead = true;
          if (killsThisWave >= KILLS_PER_WAVE) {
            killsThisWave = 0;
            waveNumber++;
            DOM.waveDisplay.textContent = waveNumber;
            flash("waveDisplay");
            const wb = Math.min(waveNumber - 1, 9);
            enemySpawnRate = Math.max(
              20,
              ({ easy: 80, hard: 40 }[difficulty] || 60) - wb * 3,
            );
            enemySpeedMult =
              ({ easy: 0.7, hard: 1.5 }[difficulty] || 1) + wb * 0.08;
            const n = document.createElement("div");
            n.className = "wave-clear-notify";
            n.innerHTML = `WAVE ${waveNumber}<br><span style="font-size:9px;color:#98d8c8">ENEMIES FASTER!</span>`;
            DOM.gameContainer.appendChild(n);
            setTimeout(() => n.remove(), 2100);
            sfx.wave();
          }
          break; // bullet is consumed, stop checking other bullets
        }
      }
    }
    if (!e.dead && collides(e, player)) {
      boom(player.x + 24, player.y + 16, "#f5e6a3");
      lives--;
      DOM.lives.textContent = lives;
      flash("lives");
      sfx.death();
      e.dead = true;
      if (lives <= 0) endGame();
    }
  }

  // Clean up dead bullets and enemies in one pass
  bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    if (!bullets[i].dead) bullets[bWrite++] = bullets[i];
  }
  bullets.length = bWrite;

  let eWrite = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].dead && enemies[i].y < 850) enemies[eWrite++] = enemies[i];
  }
  enemies.length = eWrite;

  // Particles — update in-place
  let pWrite = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life--;
    if (p.life > 0) particles[pWrite++] = p;
  }
  particles.length = pWrite;
}

function draw() {
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = C.star;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  if (gameStarted) drawPlayer();
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ctx.fillStyle = C.bullet;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = C.bulletSh;
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  }
  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
  if (particles.length > 0) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 25;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  if (gamePaused) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(0, 0, 600, 800);
  }
}

function gameLoop() {
  update();
  draw();
  if (gameStarted) requestAnimationFrame(gameLoop);
}

function drawIdleBackground() {
  if (!idleRunning) return;
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = C.star;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.y += s.speed * 0.3;
    if (s.y > 800) {
      s.y = 0;
      s.x = Math.random() * 600;
    }
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  requestAnimationFrame(drawIdleBackground);
}

function endGame() {
  gameRunning = false;
  elapsedTime = Date.now() - startTime;
  sfx.gameOver();
  const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  DOM.finalScore.textContent = score;
  DOM.finalKills.textContent = enemiesKilled;
  DOM.finalAccuracy.textContent = acc + "%";
  DOM.finalTime.textContent = fmtTime(elapsedTime);
  DOM.finalDifficulty.textContent = difficulty.toUpperCase();
  DOM.finalWave.textContent = waveNumber;
  DOM.gameOverEl.style.display = "block";
  DOM.savedMsg.textContent = "";
}

function saveAndRestart() {
  const name = DOM.playerName.value.trim() || "PILOT";
  const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  saveScore(name, score, {
    accuracy: acc,
    enemiesKilled,
    timeSurvived: fmtTime(elapsedTime),
    difficulty: difficulty.toUpperCase(),
  });
  DOM.savedMsg.textContent = "✓ Score saved!";
  beep(800, 0.1);
  setTimeout(() => beep(1000, 0.1), 80);
  setTimeout(resetGame, 600);
}

function restartOnly() {
  beep(600, 0.1);
  resetGame();
}

function resetGame() {
  player = { x: 275, y: 720, w: 48, h: 32, speed: 6 };
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  lives = 3;
  gameRunning = false;
  gamePaused = false;
  gameStarted = false;
  frame = 0;
  shotsFired = 0;
  shotsHit = 0;
  enemiesKilled = 0;
  startTime = 0;
  elapsedTime = 0;
  waveNumber = 1;
  killsThisWave = 0;
  konamiBonus = 0;
  DOM.score.textContent = "0";
  DOM.lives.textContent = "3";
  DOM.waveDisplay.textContent = "1";
  DOM.gameOverEl.style.display = "none";
  DOM.pauseOverlay.style.display = "none";
  DOM.difficultyScreen.style.display = "flex";
  DOM.savedMsg.textContent = "";
  idleRunning = true;
  drawIdleBackground();
}

/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("navHamburger"),
    navLinks = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.textContent = navLinks.classList.contains("open") ? "✕" : "☰";
    sfx.click();
  });

  animateCounters();
  initScrollTop();
  renderPersonalBest();
  renderAchievements();
  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, resetIdleTimer, { passive: true }),
  );
  resetIdleTimer();

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("Clear all scores?")) {
      clearBoard();
      renderLeaderboard();
      beep(200, 0.3, "sawtooth");
    }
  });

  const hero = document.getElementById("heroTypewriter");
  if (hero) {
    hero.textContent = "";
    setTimeout(() => typewriter(hero, hero.dataset.text || "", 25), 800);
  }

  drawIdleBackground();
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity .4s ease-in";
  requestAnimationFrame(() => (document.body.style.opacity = "1"));
});
