/* LASER DEFENDER — by Biswyaa | B.Tech CSE */

// ─── Audio ───────────────────────────────────────────────────────────────────
// We use the Web Audio API to generate retro beep sounds without any audio files

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function beep(freq = 440, dur = 0.1, type = "square", vol = 0.12) {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + dur,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

// Sound effects object — each function plays a short sequence of beeps
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
};

// ─── SPA Navigation ──────────────────────────────────────────────────────────
// Single Page App — we show/hide sections instead of loading new pages

const pageSections = document.querySelectorAll(".page-section");
const allNavLinks = document.querySelectorAll("[data-section]");

function navigateTo(section) {
  // Hide all sections, then show the selected one
  pageSections.forEach((s) => s.classList.remove("active"));
  const target = document.getElementById("sec-" + section);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // Update nav link styles
  allNavLinks.forEach((a) => a.classList.remove("active"));
  document
    .querySelectorAll(`[data-section="${section}"]`)
    .forEach((a) => a.classList.add("active"));

  // Run section-specific logic
  if (section === "leaderboard") {
    renderLeaderboard();
    renderAchievements();
  }
  if (section === "home") {
    renderPersonalBest();
    animateCounters();
  }
  if (section === "game") resetGame();

  // Close mobile menu if open
  document.getElementById("navLinks")?.classList.remove("open");
  const hamburger = document.getElementById("navHamburger");
  if (hamburger) hamburger.textContent = "☰";
}

// Listen for clicks on any element with data-section attribute
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-section]");
  if (link) {
    e.preventDefault();
    navigateTo(link.getAttribute("data-section"));
    sfx.click();
  }
});

// ─── Animated Counters ───────────────────────────────────────────────────────
// Counts numbers up from 0 to their target value for a cool effect

function animateCounters() {
  document.querySelectorAll("[data-target]").forEach((el) => {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || "";
    let current = 0;
    const increment = target / 80; // how much to add each frame

    function tick() {
      current += increment;
      if (current < target) {
        el.textContent = Math.floor(current).toLocaleString() + suffix;
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString() + suffix; // set exact final value
      }
    }

    tick();
  });
}

// ─── Leaderboard (localStorage) ──────────────────────────────────────────────
const LB_KEY = "laserDefenderScores";

function getBoard() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || [];
  } catch {
    return [];
  }
}

const clearBoard = () => localStorage.removeItem(LB_KEY);

function saveScore(name, score, stats = {}) {
  const board = getBoard();
  board.push({
    name: name || "PILOT",
    score,
    accuracy: stats.accuracy || 0,
    enemiesKilled: stats.enemiesKilled || 0,
    difficulty: stats.difficulty || "NORMAL",
    date: new Date().toLocaleDateString(),
  });
  board.sort((a, b) => b.score - a.score); // sort highest first
  board.splice(20); // keep only top 20
  localStorage.setItem(LB_KEY, JSON.stringify(board));
}

function renderLeaderboard() {
  const board = getBoard();
  const el = document.getElementById("leaderboardContent");
  const sg = document.getElementById("statsGrid");
  if (!el) return;

  if (!board.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🕹️</div>
        <p style="font-family:'Press Start 2P',cursive;font-size:.8rem;color:var(--gold)">NO SCORES YET</p>
        <p>Play the game and set your first high score!</p>
        <a href="#" data-section="game" class="action-btn" style="margin-top:1rem;display:inline-block">▶ START MISSION</a>
      </div>`;
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

  // Medal icons for top 3
  const medal = (i) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

  el.innerHTML = `
    <table class="leaderboard-table">
      <thead><tr><th>Rank</th><th>Pilot</th><th>Score</th><th>Acc</th><th>Kills</th><th>Mode</th><th>Date</th></tr></thead>
      <tbody>
        ${board
          .map(
            (entry, i) => `
          <tr>
            <td class="rank ${i < 3 ? "rank-" + (i + 1) : ""}">${medal(i)}</td>
            <td>${entry.name}</td>
            <td class="player-score">${entry.score.toLocaleString()}</td>
            <td>${entry.accuracy}%</td>
            <td>${entry.enemiesKilled || 0}</td>
            <td style="color:#89d4cf">${entry.difficulty || "NORMAL"}</td>
            <td style="color:#888">${entry.date}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;

  // Show player's overall stats
  if (sg) {
    const total = board.length;
    const best = board[0].score;
    const avgAcc = Math.round(
      board.reduce((s, e) => s + (e.accuracy || 0), 0) / total,
    );
    const totalKills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0);

    sg.innerHTML = [
      [total, "GAMES PLAYED", ""],
      [best, "BEST SCORE", ""],
      [avgAcc, "AVG ACCURACY", "%"],
      [totalKills, "TOTAL KILLS", ""],
    ]
      .map(
        ([v, l, s]) =>
          `<div class="stat-card fade-in-up">
         <div class="stat-value" data-target="${v}"${s ? ` data-suffix="${s}"` : ""}>${v}</div>
         <div class="stat-label">${l}</div>
       </div>`,
      )
      .join("");
    animateCounters();
  }
}

// ─── Achievements ─────────────────────────────────────────────────────────────
function renderAchievements() {
  const grid = document.getElementById("achievementGrid");
  if (!grid) return;

  const board = getBoard();
  const best = board[0]?.score || 0;
  const kills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0);
  const games = board.length;

  const achievements = [
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
      "Score on HARD mode",
      board.some((e) => e.difficulty === "HARD"),
    ],
    ["🏆", "VETERAN", "Play 10+ games", games >= 10],
  ];

  grid.innerHTML = achievements
    .map(
      ([icon, name, desc, unlocked]) => `
    <div class="achievement-badge ${unlocked ? "unlocked" : "locked"}">
      <div class="achievement-icon">${icon}</div>
      <div class="achievement-name">${name}</div>
      <p class="achievement-desc">${desc}</p>
    </div>`,
    )
    .join("");
}

// ─── Personal Best ────────────────────────────────────────────────────────────
function renderPersonalBest() {
  const banner = document.getElementById("personalBestBanner");
  if (!banner) return;

  const board = getBoard();
  if (board.length) {
    const best = board[0];
    banner.innerHTML = `
      <span class="pb-label">🏆 YOUR BEST</span>
      <span class="pb-value">${best.score.toLocaleString()}</span>
      <span class="pb-label">BY ${best.name}</span>
      <span class="pb-label">${best.difficulty || "NORMAL"}</span>`;
    banner.classList.remove("no-score");
  } else {
    banner.innerHTML = `<span class="pb-label">NO SCORE YET — </span>
      <a href="#" data-section="game" style="color:var(--green);font-family:'Press Start 2P',cursive;font-size:.55rem">PLAY NOW ▶</a>`;
    banner.classList.add("no-score");
  }
}

// ─── Typewriter Effect ────────────────────────────────────────────────────────
function typewriter(el, text, speed = 35) {
  el.textContent = "";
  el.classList.add("typewriter-active");
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(timer);
      el.classList.remove("typewriter-active");
    }
  }, speed);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME ENGINE
   ═══════════════════════════════════════════════════════════════════════════════ */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Cache DOM elements we update every frame
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

// Game color palette
const C = {
  pBody: "#7ec8a0", // player body color
  pDark: "#5fa880",
  pHi: "#a2dbb8",
  bullet: "#f5e6a3", // bullet color
  enemy: "#e88d8d", // normal enemy
  eDark: "#cc6666",
  eHi: "#f0b6c5",
  particle: "#f7c5a8", // explosion particles
  star: "#d4cce0", // background stars
};

// Pre-create the background gradient once (reused every frame)
const bgGradient = ctx.createLinearGradient(0, 0, 0, 800);
bgGradient.addColorStop(0, "#0f1a0f");
bgGradient.addColorStop(1, "#081008");

// Game state variables
let player, bullets, enemies, particles;
let stars = [];
let score,
  lives,
  keys = {};
let gameRunning, gamePaused, gameStarted, frame;
let waveNumber, killsThisWave, shotsFired, shotsHit, enemiesKilled;
let startTime, elapsedTime;
let difficulty,
  enemySpawnRate,
  enemySpeedMult,
  lastShot = 0;
let idleRunning = true;

const KILLS_PER_WAVE = 8; // kills needed to advance to next wave

// Create background stars
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * 600,
    y: Math.random() * 800,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 2 + 0.5,
  });
}

// ─── Input Handling ───────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  // ESC or P toggles pause
  if (
    (e.key === "Escape" || e.key === "p" || e.key === "P") &&
    gameStarted &&
    gameRunning
  ) {
    togglePause();
  }
});
document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});
canvas.addEventListener("click", () => {
  if (gameStarted) shoot();
});

// ─── Game Functions ───────────────────────────────────────────────────────────

function startGame(diff) {
  difficulty = diff;
  sfx.start();

  // Difficulty settings
  const settings = {
    easy: { lives: 5, spawnRate: 80, speedMult: 0.7, playerSpeed: 7 },
    normal: { lives: 3, spawnRate: 60, speedMult: 1.0, playerSpeed: 6 },
    hard: { lives: 1, spawnRate: 40, speedMult: 1.5, playerSpeed: 5 },
  };
  const s = settings[diff];
  lives = s.lives;
  enemySpawnRate = s.spawnRate;
  enemySpeedMult = s.speedMult;
  player.speed = s.playerSpeed;

  DOM.lives.textContent = lives;
  DOM.modeDisplay.textContent = diff.toUpperCase();
  DOM.difficultyScreen.style.display = "none";

  gameStarted = true;
  gameRunning = true;
  startTime = Date.now();
  waveNumber = 1;
  killsThisWave = 0;
  DOM.waveDisplay.textContent = "1";

  gameLoop();
  idleRunning = false;
}

function togglePause() {
  gamePaused = !gamePaused;
  DOM.pauseOverlay.style.display = gamePaused ? "flex" : "none";
  if (gamePaused) {
    elapsedTime = Date.now() - startTime; // save elapsed time
    beep(400, 0.1);
  } else {
    startTime = Date.now() - elapsedTime; // restore start time offset
    beep(600, 0.05);
  }
}

function shoot() {
  if (!gameRunning || gamePaused) return;
  const now = Date.now();
  if (now - lastShot < 150) return; // cooldown: max one bullet per 150ms
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

// Create explosion particles at (x, y)
function boom(x, y, color) {
  for (let i = 0; i < 12; i++) {
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
}

// AABB collision detection
function collides(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Flash a UI element briefly when it changes
function flash(id) {
  const el = DOM[id] || document.getElementById(id);
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 200);
}

// Format milliseconds as M:SS
function fmtTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Draw a pixelated rectangle with a bevel highlight/shadow effect
function pixRect(x, y, w, h, mainColor, darkColor, lightColor) {
  ctx.fillStyle = mainColor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = lightColor;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = darkColor;
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x + w - 3, y, 3, h);
}

// Draw the player spaceship
function drawPlayer() {
  const { x, y, w, h } = player;
  pixRect(x + 4, y + 8, w - 8, h - 12, C.pBody, C.pDark, C.pHi); // main body
  ctx.fillStyle = "#5fa880";
  ctx.fillRect(x + 18, y + 4, 12, 8); // cockpit
  pixRect(x, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0"); // left wing
  pixRect(x + w - 8, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0"); // right wing
  const thrusterAlpha = 0.6 + Math.sin(frame * 0.3) * 0.4; // pulsing thruster
  ctx.fillStyle = `rgba(247,197,168,${thrusterAlpha})`;
  ctx.fillRect(x + 18, y + h, 12, 4);
}

// Draw an enemy alien
function drawEnemy(e) {
  const { x, y, w, h } = e;
  const isFast = e.type === "fast"; // fast enemies are pink
  pixRect(
    x + 2,
    y + 2,
    w - 4,
    h - 4,
    isFast ? "#f0b6c5" : C.enemy,
    isFast ? "#d890a0" : C.eDark,
    isFast ? "#f8d4de" : C.eHi,
  );
  ctx.fillStyle = "#f5e6a3"; // eyes (white)
  ctx.fillRect(x + 10, y + 12, 8, 8);
  ctx.fillRect(x + w - 18, y + 12, 8, 8);
  ctx.fillStyle = "#1e1830"; // pupils
  ctx.fillRect(x + 14, y + 16, 4, 4);
  ctx.fillRect(x + w - 14, y + 16, 4, 4);
  ctx.fillRect(x + 14, y + 30, 20, 4); // creepy grin
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

function update() {
  if (!gameRunning || gamePaused) return;
  frame++;
  elapsedTime = Date.now() - startTime;
  DOM.timeDisplay.textContent = fmtTime(elapsedTime);

  // Move player left/right
  if (keys["ArrowLeft"] || keys["a"])
    player.x = Math.max(0, player.x - player.speed);
  if (keys["ArrowRight"] || keys["d"])
    player.x = Math.min(552, player.x + player.speed);
  if (keys[" "]) shoot();

  // Move bullets upward, remove ones that go off-screen
  bullets.forEach((b) => {
    b.y -= b.speed;
  });
  bullets = bullets.filter((b) => b.y > -20);

  // Spawn a new enemy every N frames
  if (frame % enemySpawnRate === 0) spawnEnemy();

  // Scroll stars downward (parallax background)
  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > 800) {
      s.y = 0;
      s.x = Math.random() * 600;
    }
  });

  // Move enemies and check collisions
  enemies.forEach((enemy) => {
    enemy.y += enemy.speed;

    // Check if any bullet hit this enemy
    bullets.forEach((bullet) => {
      if (bullet.dead || !collides(bullet, enemy)) return;
      bullet.dead = true;
      shotsHit++;
      enemy.health--;
      sfx.hit();

      if (enemy.health <= 0) {
        boom(enemy.x + 24, enemy.y + 24, C.particle);
        score += enemy.type === "fast" ? 20 : 10;
        enemiesKilled++;
        killsThisWave++;
        DOM.score.textContent = score;
        flash("score");
        sfx.kill();
        enemy.dead = true;

        // Advance to next wave when enough enemies are killed
        if (killsThisWave >= KILLS_PER_WAVE) {
          killsThisWave = 0;
          waveNumber++;
          DOM.waveDisplay.textContent = waveNumber;
          flash("waveDisplay");

          // Increase difficulty each wave
          const wavesCompleted = Math.min(waveNumber - 1, 9);
          enemySpawnRate = Math.max(
            20,
            ({ easy: 80, hard: 40 }[difficulty] || 60) - wavesCompleted * 3,
          );
          enemySpeedMult =
            ({ easy: 0.7, hard: 1.5 }[difficulty] || 1) + wavesCompleted * 0.08;

          // Show wave clear notification
          const notice = document.createElement("div");
          notice.className = "wave-clear-notify";
          notice.innerHTML = `WAVE ${waveNumber}<br><span style="font-size:9px;color:#98d8c8">ENEMIES FASTER!</span>`;
          DOM.gameContainer.appendChild(notice);
          setTimeout(() => notice.remove(), 2100);
          sfx.wave();
        }
      }
    });

    // Enemy reached player — lose a life
    if (!enemy.dead && collides(enemy, player)) {
      boom(player.x + 24, player.y + 16, "#f5e6a3");
      lives--;
      DOM.lives.textContent = lives;
      flash("lives");
      sfx.death();
      enemy.dead = true;
      if (lives <= 0) endGame();
    }
  });

  // Remove dead bullets, dead/off-screen enemies
  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => !e.dead && e.y < 850);

  // Update particles
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life--;
  });
  particles = particles.filter((p) => p.life > 0);
}

function draw() {
  // Clear canvas with dark background gradient
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);

  // Draw stars
  ctx.fillStyle = C.star;
  stars.forEach((s) => ctx.fillRect(s.x, s.y, s.size, s.size));

  // Draw player
  if (gameStarted) drawPlayer();

  // Draw bullets
  ctx.fillStyle = C.bullet;
  bullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));

  // Draw enemies
  enemies.forEach((e) => drawEnemy(e));

  // Draw explosion particles (with fading alpha)
  particles.forEach((p) => {
    ctx.globalAlpha = p.life / 25;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1; // reset alpha
}

function gameLoop() {
  update();
  draw();
  if (gameStarted) requestAnimationFrame(gameLoop);
}

// Idle animation — slowly scrolling stars before game starts
function drawIdleBackground() {
  if (!idleRunning) return;
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = C.star;
  stars.forEach((s) => {
    s.y += s.speed * 0.3;
    if (s.y > 800) {
      s.y = 0;
      s.x = Math.random() * 600;
    }
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  requestAnimationFrame(drawIdleBackground);
}

function endGame() {
  gameRunning = false;
  elapsedTime = Date.now() - startTime;
  sfx.gameOver();

  const accuracy =
    shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  DOM.finalScore.textContent = score;
  DOM.finalKills.textContent = enemiesKilled;
  DOM.finalAccuracy.textContent = accuracy + "%";
  DOM.finalTime.textContent = fmtTime(elapsedTime);
  DOM.finalDifficulty.textContent = difficulty.toUpperCase();
  DOM.finalWave.textContent = waveNumber;
  DOM.gameOverEl.style.display = "block";
  DOM.savedMsg.textContent = "";
}

function saveAndRestart() {
  const name = DOM.playerName.value.trim() || "PILOT";
  const accuracy =
    shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  saveScore(name, score, {
    accuracy,
    enemiesKilled,
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
  // Reset player
  player = { x: 275, y: 720, w: 48, h: 32, speed: 6 };

  // Reset arrays
  bullets = [];
  enemies = [];
  particles = [];

  // Reset stats
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

  // Reset UI
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
  // Mobile hamburger menu
  const hamburger = document.getElementById("navHamburger");
  const navLinksEl = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => {
    navLinksEl.classList.toggle("open");
    hamburger.textContent = navLinksEl.classList.contains("open") ? "✕" : "☰";
    sfx.click();
  });

  // Start up
  animateCounters();
  renderPersonalBest();
  renderAchievements();

  // Clear scores button
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("Clear all scores?")) {
      clearBoard();
      renderLeaderboard();
      beep(200, 0.3, "sawtooth");
    }
  });

  // Typewriter effect on homepage
  const heroText = document.getElementById("heroTypewriter");
  if (heroText) {
    heroText.textContent = "";
    setTimeout(
      () => typewriter(heroText, heroText.dataset.text || "", 25),
      800,
    );
  }

  // Start idle background animation
  drawIdleBackground();
});
