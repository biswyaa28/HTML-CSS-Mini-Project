/* ═══════════════════════════════════════════════════════════
   LASER DEFENDER — Main Application Script
   Retro arcade space shooter built with vanilla JS.

   Features:
   - SPA navigation with VHS glitch transitions
   - HTML5 Canvas game engine with wave system
   - Web Audio API procedural sound effects
   - Leaderboard with localStorage persistence
   - Achievement system
   - Boot sequence & screen shake effects
   - Meteor shower random event
   ═══════════════════════════════════════════════════════════ */

// ─── Web Audio API Setup ─────────────────────────────────
// Lazy-initialise AudioContext on first user interaction
// to comply with browser autoplay policies.
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

/**
 * beep() — Generate a short procedural tone via Web Audio API.
 * @param {number} freq  - Frequency in Hz (default 440)
 * @param {number} dur   - Duration in seconds (default 0.1)
 * @param {string} type  - Oscillator waveform: "square", "sawtooth", etc.
 * @param {number} vol   - Volume 0–1 (default 0.12)
 */
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

/**
 * sfx — Collection of sound effect helper functions.
 * Each composes one or more beep() calls with staggered timing
 * to create distinct retro sound effects.
 */
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
  // Ascending scale — used for easter egg reveals
  easter: () =>
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((n, i) =>
      setTimeout(() => beep(n, 0.15), i * 80),
    ),
};

// ─── SPA Navigation ─────────────────────────────────────
// Cache page sections and nav links once at load time
// to avoid repeated DOM queries during navigation.
const _pageSections = document.querySelectorAll(".page-section");
const _navLinks = document.querySelectorAll("[data-section]");

/**
 * navigateTo() — Switch the visible page section (SPA-style).
 * Adds a brief VHS glitch transition effect before switching.
 * @param {string} section - Section name: "home", "about", "leaderboard", "game"
 */
function navigateTo(section) {
  // Apply VHS glitch effect to body for 300ms
  document.body.classList.add("vhs-glitch");
  setTimeout(() => {
    document.body.classList.remove("vhs-glitch");

    // Hide all sections, then show the target
    _pageSections.forEach((s) => s.classList.remove("active"));
    const el = document.getElementById("sec-" + section);
    if (el) {
      el.classList.add("active");
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    // Update active state on all nav links
    _navLinks.forEach((a) => a.classList.remove("active"));
    document
      .querySelectorAll(`[data-section="${section}"]`)
      .forEach((a) => a.classList.add("active"));

    // Section-specific initialisation
    if (section === "leaderboard") {
      renderLeaderboard();
      renderAchievements();
    }
    if (section === "home") {
      renderPersonalBest();
      renderHomeStats();
    }
    if (section === "game") {
      resetGame();
    }

    // Close mobile hamburger menu
    document.getElementById("navLinks")?.classList.remove("open");
    const h = document.getElementById("navHamburger");
    if (h) h.textContent = "☰";
  }, 300);
}

// Global click handler for all [data-section] navigation links
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-section]");
  if (link) {
    e.preventDefault();
    navigateTo(link.getAttribute("data-section"));
    sfx.click();
  }
});

// ─── Animated Counters ──────────────────────────────────
// Counts up stat values when they scroll into view.
// Uses IntersectionObserver for efficient visibility detection.
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

// ─── Leaderboard (localStorage persistence) ─────────────
const LB_KEY = "laserDefenderScores";

/** Retrieve the saved leaderboard array from localStorage */
const getBoard = () => {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || [];
  } catch {
    return [];
  }
};

/** Clear all saved scores */
const clearBoard = () => localStorage.removeItem(LB_KEY);

/**
 * saveScore() — Add a new score entry to the leaderboard.
 * Keeps top 20 scores sorted by score descending.
 */
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
  board.splice(20); // Keep top 20
  localStorage.setItem(LB_KEY, JSON.stringify(board));
}

/**
 * renderLeaderboard() — Build the leaderboard HTML table
 * from localStorage data and inject it into the DOM.
 * Also computes aggregate stats (games played, best score, etc).
 */
function renderLeaderboard() {
  const board = getBoard(),
    el = document.getElementById("leaderboardContent"),
    sg = document.getElementById("statsGrid");
  if (!el) return;

  // Empty state — no scores yet
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

  // Rank icon and CSS class helpers
  const icon = (i) => (i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`);
  const cls = (i) => (i < 3 ? `rank-${i + 1}` : "");

  // Render the score table
  el.innerHTML = `<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Pilot</th><th>Score</th><th>Acc</th><th>Kills</th><th>Mode</th><th>Date</th></tr></thead><tbody>${board.map((e, i) => `<tr class="fade-in-up"><td class="rank ${cls(i)}">${icon(i)}</td><td>${e.name}</td><td class="player-score">${e.score.toLocaleString()}</td><td>${e.accuracy}%</td><td>${e.enemiesKilled || 0}</td><td class="text-cyan">${e.difficulty || "NORMAL"}</td><td style="color:#888">${e.date}</td></tr>`).join("")}</tbody></table>`;

  // Render aggregate stats
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

// ─── Achievements ───────────────────────────────────────
// Renders a grid of achievement badges, marking each
// as unlocked or locked based on player progress.
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

// ─── Personal Best Banner ───────────────────────────────
// Updates the hero banner with the player's top score,
// or shows "NO SCORE YET" for new players.
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

// ─── Home Page Stats ─────────────────────────────────────
// Populates the home "BATTLE STATS" grid with real data from localStorage.
function renderHomeStats() {
  const grid = document.getElementById("homeStatsGrid");
  if (!grid) return;
  const board = getBoard();
  const games = board.length;
  const best = board[0]?.score || 0;
  const kills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0);
  const acc = games > 0
    ? Math.round(board.reduce((s, e) => s + (e.accuracy || 0), 0) / games)
    : 0;

  grid.innerHTML = [
    [games, "GAMES PLAYED"],
    [best, "BEST SCORE"],
    [kills, "ENEMIES DESTROYED"],
    [acc, "AVG ACCURACY", "%"],
  ]
    .map(
      ([v, l, s]) =>
        `<div class="stat-card fade-in-up"><div class="stat-value" data-target="${v}"${s ? ` data-suffix="${s}"` : ""}>0</div><div class="stat-label">${l}</div></div>`,
    )
    .join("");
  animateCounters();
}

// ─── Typewriter Effect ──────────────────────────────────
// Types out text character-by-character into an element.
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

// ─── Toast Notification ─────────────────────────────────
// Shows a floating notification banner that auto-dismisses.
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

// ─── Easter Eggs ────────────────────────────────────────
// Konami code sequence tracker
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

// Terminal dot click sequence (R-Y-G) for hack easter egg
let dotSeq = [],
  dotTimer = null;
const DOT_ORDER = ["dot-red", "dot-yellow", "dot-green"];

document.addEventListener("click", (e) => {
  // Terminal dot hack sequence
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

  // Footer click — fun toast message
  if (e.target.closest(".footer-bottom p")) {
    beep(400, 0.06);
    toast("🫡 Built at 2am with chai & determination");
  }
});

/**
 * runHackSequence() — Terminal dot easter egg.
 * Clicking red-yellow-green dots triggers a fake hacking animation
 * that awards +500 bonus points.
 */
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

// ─── Idle UFO Easter Egg ────────────────────────────────
// After 18s of no interaction, a UFO flies across the screen.
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

// ─── Scroll-to-Top Button ───────────────────────────────
// Dynamically creates a fixed "TOP" button that appears on scroll.
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
   HTML5 Canvas-based space shooter with wave system,
   collision detection, particles, and difficulty scaling.
   ═══════════════════════════════════════════════ */
const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d");

// ─── Cached DOM Elements ─────────────────────────────────
// Cache game UI elements to avoid DOM lookups in the hot loop.
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

// ─── Background Gradient (pre-cached) ────────────────────
const bgGradient = ctx.createLinearGradient(0, 0, 0, 800);
bgGradient.addColorStop(0, "#0f1a0f");
bgGradient.addColorStop(1, "#081008");

// ─── Color Palette Constants ─────────────────────────────
const C = {
  pBody: "#7ec8a0",    // Player body
  pDark: "#5fa880",    // Player shadow
  pHi: "#a2dbb8",      // Player highlight
  bullet: "#f5e6a3",   // Bullet fill
  bulletSh: "#e0cc80",  // Bullet shadow
  enemy: "#e88d8d",    // Normal enemy
  eDark: "#cc6666",    // Enemy shadow
  eHi: "#f0b6c5",      // Enemy highlight
  particle: "#f7c5a8", // Explosion particles
  star: "#d4cce0",     // Background stars
  bgTop: "#0f1a0f",    // Canvas gradient top
  bgBot: "#081008",    // Canvas gradient bottom
  meteor: "#ff6633",   // Meteor shower color
};

// ─── Game State Variables ────────────────────────────────
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

// Meteor shower state
let meteorActive = false;
let meteorTimer = 0;
let meteors = [];
let lastMeteorCheck = 0;

// ─── Star Field Initialisation ───────────────────────────
// Pre-populate 60 stars with random positions and speeds.
for (let i = 0; i < 60; i++)
  stars.push({
    x: Math.random() * 600,
    y: Math.random() * 800,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 2 + 0.5,
  });

// ─── Input Handling ──────────────────────────────────────
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  // Prevent spacebar from scrolling the page when the game section is active
  if (e.key === " " && document.getElementById("sec-game")?.classList.contains("active")) {
    e.preventDefault();
  }

  // Konami code detection
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      triggerKonami();
      konamiIdx = 0;
    }
  } else konamiIdx = 0;

  // Pause toggle (Escape or P)
  if (
    (e.key === "Escape" || e.key === "p" || e.key === "P") &&
    gameStarted &&
    gameRunning
  )
    togglePause();
});
document.addEventListener("keyup", (e) => (keys[e.key] = false));

// Canvas click to shoot
canvas.addEventListener("click", () => {
  if (gameStarted) shoot();
});

/**
 * triggerKonami() — Konami code easter egg.
 * Awards +1000 bonus points and shows a celebratory overlay.
 */
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

// ─── Game Lifecycle ──────────────────────────────────────

/**
 * startGame() — Begin a new game with the selected difficulty.
 * Sets lives, spawn rate, speed multiplier, and player speed.
 */
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
  // Apply any stored bonus points (from easter eggs)
  konamiBonus = +(localStorage.getItem("laserDefenderBonus") || 0);
  if (konamiBonus > 0) {
    score = konamiBonus;
    DOM.score.textContent = score;
    localStorage.removeItem("laserDefenderBonus");
    konamiBonus = 0;
  }
  // Reset meteor state
  meteorActive = false;
  meteorTimer = 0;
  meteors = [];
  lastMeteorCheck = 0;

  gameLoop();
  idleRunning = false;
}

/** togglePause() — Pause/unpause the game, preserving elapsed time. */
function togglePause() {
  gamePaused = !gamePaused;
  DOM.pauseOverlay.style.display = gamePaused ? "flex" : "none";
  gamePaused
    ? ((elapsedTime = Date.now() - startTime), beep(400, 0.1))
    : ((startTime = Date.now() - elapsedTime), beep(600, 0.05));
}

/**
 * shoot() — Fire a bullet from the player's current position.
 * Rate-limited to 150ms between shots.
 */
function shoot() {
  if (!gameRunning || gamePaused) return;
  const now = Date.now();
  if (now - lastShot < 150) return;
  lastShot = now;
  bullets.push({ x: player.x + 24, y: player.y, w: 8, h: 16, speed: 14 });
  shotsFired++;
  sfx.shoot();
}

/** spawnEnemy() — Create a new enemy at a random x position above the canvas. */
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

/**
 * boom() — Spawn explosion particles at a given position.
 * Creates 12 particles with random velocities that fade over time.
 */
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

/** collides() — AABB rectangle collision test between two objects. */
function collides(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** flash() — Briefly scale up a HUD element for visual feedback. */
function flash(id) {
  const el = DOM[id] || document.getElementById(id);
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 200);
}

/** fmtTime() — Format milliseconds as "M:SS" string. */
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * pixRect() — Draw a pixel-art style rectangle with highlight/shadow edges.
 * Gives sprites a 3D extruded look.
 */
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

// ─── Screen Shake ────────────────────────────────────────
/**
 * onHit() — Trigger a screen shake on the game container.
 * Called when the player takes damage from an enemy collision.
 */
function onHit() {
  DOM.gameContainer.classList.add("screen-shake");
  setTimeout(() => DOM.gameContainer.classList.remove("screen-shake"), 200);
}

// ─── Meteor Shower Event ─────────────────────────────────
/**
 * triggerMeteorShower() — Random gameplay event.
 * Flashes a warning, then spawns 15-20 fast small meteors
 * over 5 seconds. Awards bonus points for surviving.
 */
function triggerMeteorShower() {
  if (meteorActive) return;
  meteorActive = true;
  meteorTimer = Date.now();

  // Flash warning text on canvas
  const warn = document.createElement("div");
  warn.className = "wave-clear-notify";
  warn.innerHTML = `⚠ INCOMING!<br><span style="font-size:9px;color:#ff6633">METEOR SHOWER!</span>`;
  warn.style.borderColor = "#ff6633";
  warn.style.color = "#ff6633";
  DOM.gameContainer.appendChild(warn);
  setTimeout(() => warn.remove(), 1500);

  beep(150, 0.3, "sawtooth");
  setTimeout(() => beep(200, 0.2, "sawtooth"), 150);
}

/** spawnMeteor() — Create a single fast meteor object. */
function spawnMeteor() {
  meteors.push({
    x: Math.random() * 580,
    y: -20,
    w: 16,
    h: 16,
    speed: 6 + Math.random() * 4,
    health: 1,
  });
}

/**
 * updateMeteors() — Process meteor movement and collisions.
 * Called each frame during an active meteor shower.
 */
function updateMeteors() {
  if (!meteorActive) return;

  const elapsed = Date.now() - meteorTimer;

  // Spawn meteors for 5 seconds
  if (elapsed < 5000 && frame % 8 === 0) {
    spawnMeteor();
  }

  // End shower after 6 seconds (5s spawning + 1s cleanup)
  if (elapsed > 6000 && meteors.length === 0) {
    meteorActive = false;
    score += 50;
    DOM.score.textContent = score;
    flash("score");
    toast("☄ Meteor shower survived! +50 bonus");
  }

  // Move meteors and check collisions
  for (let mi = meteors.length - 1; mi >= 0; mi--) {
    const m = meteors[mi];
    m.y += m.speed;

    // Bullet-meteor collision
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.dead) continue;
      if (collides(b, m)) {
        b.dead = true;
        shotsHit++;
        m.health--;
        if (m.health <= 0) {
          boom(m.x + 8, m.y + 8, C.meteor);
          score += 5;
          DOM.score.textContent = score;
          sfx.hit();
          m.dead = true;
          break;
        }
      }
    }

    // Meteor-player collision
    if (!m.dead && collides(m, player)) {
      boom(player.x + 24, player.y + 16, "#ff6633");
      lives--;
      DOM.lives.textContent = lives;
      flash("lives");
      sfx.death();
      onHit();
      m.dead = true;
      if (lives <= 0) endGame();
    }

    // Remove off-screen meteors
    if (m.y > 820) m.dead = true;
  }

  // Clean up dead meteors
  let mWrite = 0;
  for (let i = 0; i < meteors.length; i++) {
    if (!meteors[i].dead) meteors[mWrite++] = meteors[i];
  }
  meteors.length = mWrite;
}

/** drawMeteors() — Render all active meteors on the canvas. */
function drawMeteors() {
  for (let i = 0; i < meteors.length; i++) {
    const m = meteors[i];
    ctx.fillStyle = C.meteor;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = "#ff4400";
    ctx.fillRect(m.x + 2, m.y + 2, m.w - 4, m.h - 4);
    // Trailing glow
    ctx.fillStyle = "rgba(255, 102, 51, 0.3)";
    ctx.fillRect(m.x + 4, m.y - 6, m.w - 8, 6);
  }
}

// ─── Drawing Functions ───────────────────────────────────

/** drawPlayer() — Render the player ship sprite on the canvas. */
function drawPlayer() {
  const { x, y, w, h } = player;
  // Main body
  pixRect(x + 4, y + 8, w - 8, h - 12, C.pBody, C.pDark, C.pHi);
  // Cockpit
  ctx.fillStyle = "#5fa880";
  ctx.fillRect(x + 18, y + 4, 12, 8);
  // Wings
  pixRect(x, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0");
  pixRect(x + w - 8, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0");
  // Engine glow (pulsing)
  const a = 0.6 + Math.sin(frame * 0.3) * 0.4;
  ctx.fillStyle = `rgba(247,197,168,${a})`;
  ctx.fillRect(x + 18, y + h, 12, 4);
  ctx.fillStyle = `rgba(245,230,163,${a})`;
  ctx.fillRect(x + 20, y + h + 4, 8, 2);
}

/** drawEnemy() — Render an enemy sprite with eyes and mouth. */
function drawEnemy(e) {
  const { x, y, w, h } = e,
    f = e.type === "fast";
  // Body with type-dependent color
  pixRect(
    x + 2,
    y + 2,
    w - 4,
    h - 4,
    f ? "#f0b6c5" : C.enemy,
    f ? "#d890a0" : C.eDark,
    f ? "#f8d4de" : C.eHi,
  );
  // Eyes
  ctx.fillStyle = "#f5e6a3";
  ctx.fillRect(x + 10, y + 12, 8, 8);
  ctx.fillRect(x + w - 18, y + 12, 8, 8);
  // Pupils
  ctx.fillStyle = "#1e1830";
  ctx.fillRect(x + 14, y + 16, 4, 4);
  ctx.fillRect(x + w - 14, y + 16, 4, 4);
  // Mouth
  ctx.fillRect(x + 14, y + 30, 20, 4);
}

// ─── Game Loop (Update + Draw) ───────────────────────────

/** update() — Main game logic tick. Runs every frame. */
function update() {
  if (!gameRunning || gamePaused) return;
  frame++;
  elapsedTime = Date.now() - startTime;
  DOM.timeDisplay.textContent = fmtTime(elapsedTime);

  // Player movement (arrow keys or WASD)
  if (keys["ArrowLeft"] || keys["a"])
    player.x = Math.max(0, player.x - player.speed);
  if (keys["ArrowRight"] || keys["d"])
    player.x = Math.min(552, player.x + player.speed);
  if (keys[" "]) shoot();

  // Move bullets upward, filter out off-screen
  let bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].y -= bullets[i].speed;
    if (bullets[i].y > -20) {
      bullets[bWrite++] = bullets[i];
    }
  }
  bullets.length = bWrite;

  // Spawn enemies at the configured rate
  if (frame % enemySpawnRate === 0) spawnEnemy();

  // Scroll star field
  for (let i = 0; i < stars.length; i++) {
    stars[i].y += stars[i].speed;
    if (stars[i].y > 800) {
      stars[i].y = 0;
      stars[i].x = Math.random() * 600;
    }
  }

  // Enemy-bullet and enemy-player collision detection
  for (let ei = 0; ei < enemies.length; ei++) {
    const e = enemies[ei];
    e.y += e.speed;
    // Check all bullets against this enemy
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
          // Check for wave advancement
          if (killsThisWave >= KILLS_PER_WAVE) {
            killsThisWave = 0;
            waveNumber++;
            DOM.waveDisplay.textContent = waveNumber;
            flash("waveDisplay");
            // Scale difficulty with wave number
            const wb = Math.min(waveNumber - 1, 9);
            enemySpawnRate = Math.max(
              20,
              ({ easy: 80, hard: 40 }[difficulty] || 60) - wb * 3,
            );
            enemySpeedMult =
              ({ easy: 0.7, hard: 1.5 }[difficulty] || 1) + wb * 0.08;
            // Show wave clear notification
            const n = document.createElement("div");
            n.className = "wave-clear-notify";
            n.innerHTML = `WAVE ${waveNumber}<br><span style="font-size:9px;color:#98d8c8">ENEMIES FASTER!</span>`;
            DOM.gameContainer.appendChild(n);
            setTimeout(() => n.remove(), 2100);
            sfx.wave();
          }
          break; // Bullet consumed
        }
      }
    }
    // Enemy-player collision (costs a life)
    if (!e.dead && collides(e, player)) {
      boom(player.x + 24, player.y + 16, "#f5e6a3");
      lives--;
      DOM.lives.textContent = lives;
      flash("lives");
      sfx.death();
      onHit(); // Trigger screen shake
      e.dead = true;
      if (lives <= 0) endGame();
    }
  }

  // Clean up dead bullets
  bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    if (!bullets[i].dead) bullets[bWrite++] = bullets[i];
  }
  bullets.length = bWrite;

  // Clean up dead/off-screen enemies
  let eWrite = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].dead && enemies[i].y < 850) enemies[eWrite++] = enemies[i];
  }
  enemies.length = eWrite;

  // Update particles (gravity + fade)
  let pWrite = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2; // Gravity
    p.life--;
    if (p.life > 0) particles[pWrite++] = p;
  }
  particles.length = pWrite;

  // Meteor shower — random chance every ~45 seconds of gameplay
  if (!meteorActive && elapsedTime > 10000) {
    // Check roughly every second
    if (frame - lastMeteorCheck > 60) {
      lastMeteorCheck = frame;
      // ~2.2% chance per check = roughly every 45s
      if (Math.random() < 0.022) {
        triggerMeteorShower();
      }
    }
  }
  updateMeteors();
}

/** draw() — Render the entire game scene to the canvas. */
function draw() {
  // Clear canvas with background gradient
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);

  // Draw star field
  ctx.fillStyle = C.star;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  // Draw player ship
  if (gameStarted) drawPlayer();

  // Draw bullets
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ctx.fillStyle = C.bullet;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = C.bulletSh;
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  }

  // Draw enemies
  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);

  // Draw meteors
  drawMeteors();

  // Draw explosion particles with fading alpha
  if (particles.length > 0) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 25;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // Dim overlay when paused
  if (gamePaused) {
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(0, 0, 600, 800);
  }
}

/** gameLoop() — Main requestAnimationFrame loop. */
function gameLoop() {
  update();
  draw();
  if (gameStarted) requestAnimationFrame(gameLoop);
}

/**
 * drawIdleBackground() — Animate the starfield when no game is running.
 * Shows a gentle star scroll on the difficulty selection screen.
 */
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

// ─── Game Over & Score Saving ────────────────────────────

/** endGame() — Stop the game, compute final stats, and show game over screen. */
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

/** saveAndRestart() — Save the score to leaderboard then restart. */
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

/** restartOnly() — Restart without saving the score. */
function restartOnly() {
  beep(600, 0.1);
  resetGame();
}

/**
 * resetGame() — Reset all game state to initial values
 * and show the difficulty selection screen.
 */
function resetGame() {
  player = { x: 275, y: 720, w: 48, h: 32, speed: 6 };
  bullets = [];
  enemies = [];
  particles = [];
  meteors = [];
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
  meteorActive = false;
  meteorTimer = 0;
  lastMeteorCheck = 0;
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

// ─── Fake BIOS Boot Sequence ─────────────────────────────
/**
 * runBootSequence() — Displays a green-on-black BIOS terminal
 * that types out ~8 lines before fading out to reveal the site.
 * Runs on every page load / refresh.
 */
function runBootSequence() {
  const bootScreen = document.getElementById("bootScreen");
  if (!bootScreen) return;

  const lines = [
    "BIOS v2.187 — LASER DEFENDER SYSTEMS",
    "Copyright (c) 2187 Emerald Corp.",
    "",
    "Memory check... 640K OK",
    "Detecting peripherals... JOYSTICK OK",
    "LOADING SECTOR 7G... OK",
    "Initializing CRT display driver...",
    "",
    "> BOOT COMPLETE. LAUNCHING laser_defender.exe",
  ];

  const container = document.getElementById("bootLines");
  let i = 0;

  // Type out each line with staggered delays
  function addLine() {
    if (i < lines.length) {
      const p = document.createElement("p");
      p.textContent = lines[i];
      // Style empty lines as spacers
      if (lines[i] === "") p.style.height = "0.6rem";
      p.style.animationDelay = "0s";
      container.appendChild(p);
      // Typing beep for non-empty lines
      if (lines[i]) beep(100 + Math.random() * 100, 0.02, "square", 0.05);
      i++;
      setTimeout(addLine, 300 + Math.random() * 150);
    } else {
      // All lines typed — fade out after a brief pause
      setTimeout(() => {
        bootScreen.classList.add("fade-out");
        setTimeout(() => {
          bootScreen.classList.add("hidden");
        }, 600);
      }, 800);
    }
  }

  addLine();
}

/* ═══════════════════════════════════════════════
   INITIALISATION — Runs on DOMContentLoaded
   Sets up event listeners, starts boot sequence,
   and initialises all subsystems.
   ═══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Run the boot sequence first (blocks visually, not JS)
  runBootSequence();

  // Hamburger menu toggle (mobile navigation)
  const hamburger = document.getElementById("navHamburger"),
    navLinks = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.textContent = navLinks.classList.contains("open") ? "✕" : "☰";
    sfx.click();
  });

  // Initialise homepage stats and scroll-to-top button
  renderHomeStats();
  initScrollTop();
  renderPersonalBest();
  renderAchievements();

  // Reset idle timer on any user interaction
  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, resetIdleTimer, { passive: true }),
  );
  resetIdleTimer();

  // Clear scores button handler
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("Clear all scores?")) {
      clearBoard();
      renderLeaderboard();
      beep(200, 0.3, "sawtooth");
    }
  });

  // Start the hero typewriter effect after a brief delay
  const hero = document.getElementById("heroTypewriter");
  if (hero) {
    hero.textContent = "";
    setTimeout(() => typewriter(hero, hero.dataset.text || "", 25), 800);
  }

  // Start the idle starfield animation on the game canvas
  drawIdleBackground();

  // Click ripple effect — spawns a pixel burst at the mouse position
  document.addEventListener("mousedown", (e) => {
    const ripple = document.createElement("div");
    ripple.className = "click-ripple";
    ripple.style.left = e.clientX + "px";
    ripple.style.top = e.clientY + "px";
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 350);
  });

  // Fade in the page body
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity .4s ease-in";
  requestAnimationFrame(() => (document.body.style.opacity = "1"));
});
