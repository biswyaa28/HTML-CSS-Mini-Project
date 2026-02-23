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
//
// WHY LAZY? Modern browsers (Chrome 66+, Safari, Firefox) block audio playback
// until the user has interacted with the page (click, tap, keypress). Creating
// an AudioContext before that moment causes it to start in a "suspended" state,
// and any scheduled sounds are silently dropped. By deferring creation to the
// first call of beep() (which is always triggered by a user action like clicking
// a nav link or pressing spacebar), the context is born in the "running" state
// and audio works immediately — no resume() hack needed.
//
// We also fall back to the vendor-prefixed webkitAudioContext for older Safari.
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null; // Stays null until the first beep() call

/**
 * beep() — Generate a short procedural tone via Web Audio API.
 *
 * Audio signal chain:  Oscillator (o) ──▶ GainNode (g) ──▶ audioCtx.destination (speakers)
 *
 * The oscillator produces a raw waveform (square, sawtooth, etc.) at the given
 * frequency. The gain node controls volume and — critically — uses an
 * exponentialRampToValueAtTime() to decay the volume from `vol` down to near
 * silence (0.001) over `dur` seconds. This creates a short percussive envelope
 * that sounds like a retro blip rather than an abrupt click or pop.
 *
 * Why exponential and not linear? Exponential ramps mirror how humans perceive
 * loudness (logarithmically), so the decay sounds natural and smooth.
 *
 * The entire function is wrapped in try/catch because some browsers or privacy
 * extensions may block the Web Audio API entirely. The catch is intentionally
 * empty — silent failure is fine for optional sound effects.
 *
 * @param {number} freq  - Frequency in Hz (default 440 — concert A)
 * @param {number} dur   - Duration in seconds (default 0.1 — very short blip)
 * @param {string} type  - Oscillator waveform: "square" (8-bit retro), "sawtooth" (buzzy)
 * @param {number} vol   - Starting volume 0–1 (default 0.12 — quiet, non-intrusive)
 */
function beep(freq = 440, dur = 0.1, type = "square", vol = 0.12) {
  try {
    // Lazy-init: create AudioContext on first call (see note above about autoplay policy)
    if (!audioCtx) audioCtx = new AudioCtx();

    // Create the two nodes in our signal chain
    const o = audioCtx.createOscillator(), // Generates the raw tone
      g = audioCtx.createGain(); // Controls volume envelope

    o.type = type; // Waveform shape — "square" for classic 8-bit, "sawtooth" for harsher buzz
    o.frequency.setValueAtTime(freq, audioCtx.currentTime); // Set pitch immediately

    // Volume envelope: start at `vol`, then exponentially decay to near-zero
    // This gives each beep a sharp attack and smooth fade-out (percussive feel)
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

    // Wire up the signal chain: oscillator → gain → speakers
    o.connect(g);
    g.connect(audioCtx.destination);

    // Schedule the oscillator to play for exactly `dur` seconds then auto-dispose
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (_) {
    // Silently swallow errors — audio is optional; the game works fine without it
  }
}

/**
 * sfx — Collection of sound effect helper functions.
 *
 * Each function composes one or more beep() calls, often with staggered
 * setTimeout delays to create multi-note retro sound effects. The pattern is:
 *   - Single beep  = simple UI feedback (click, shoot)
 *   - Two beeps    = rising/falling interval (kill, death)
 *   - Three+ beeps = melodic phrase (gameOver, start, wave, easter)
 *
 * The frequency values are chosen by ear to sound "retro" — they are NOT
 * musical notes in any particular key (except `wave` and `easter` which
 * use C-major scale frequencies: C5=523, D5=587, E5=659, etc.).
 *
 * Sawtooth waveforms are used for "negative" sounds (hit, death) because
 * their harsher timbre signals damage. Square waves (default) are used for
 * "positive" or neutral sounds (click, shoot, start, wave).
 */
const sfx = {
  // UI click — short, high-pitched blip for button/link feedback
  click: () => beep(800, 0.08),

  // Player shoots — very short, high blip (fast so it doesn't lag repeated fire)
  shoot: () => beep(1200, 0.05),

  // Bullet hits enemy — low sawtooth buzz signals damage dealt
  hit: () => beep(300, 0.15, "sawtooth"),

  // Enemy destroyed — two-note rising interval (500→700 Hz) for a "success" feel
  kill: () => {
    beep(500, 0.1);
    setTimeout(() => beep(700, 0.1), 50); // 50ms delay creates a quick two-note chirp
  },

  // Player takes damage — two low sawtooth drones, descending (200→150 Hz)
  // The longer duration (0.3s, 0.4s) makes this feel heavy and painful
  death: () => {
    beep(200, 0.3, "sawtooth");
    setTimeout(() => beep(150, 0.4, "sawtooth"), 100);
  },

  // Game over — three-note descending scale (400→300→200 Hz)
  // Each note spaced 200ms apart creates a classic "wah wah wah" defeat jingle
  gameOver: () => {
    beep(400, 0.2);
    setTimeout(() => beep(300, 0.2), 200);
    setTimeout(() => beep(200, 0.4), 400); // Final note is longer for finality
  },

  // Game start — three-note ascending fanfare (800→1000→1200 Hz)
  // Rising pitch signals excitement / "let's go!"
  start: () => {
    beep(800, 0.1);
    setTimeout(() => beep(1000, 0.1), 80);
    setTimeout(() => beep(1200, 0.15), 160); // Final note slightly longer for emphasis
  },

  // Wave cleared — C-E-G major triad arpeggio (C5→E5→G5)
  // Musical chord creates a triumphant "level up" feel
  wave: () => {
    beep(523, 0.08); // C5
    setTimeout(() => beep(659, 0.08), 90); // E5
    setTimeout(() => beep(784, 0.12), 180); // G5
  },

  // Easter egg discovered — Full ascending C-major scale from C5 to C6
  // 8 notes spaced 80ms apart = ~640ms celebratory fanfare
  // Uses Array.forEach to schedule all 8 beeps in a single expression
  easter: () =>
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((n, i) =>
      setTimeout(() => beep(n, 0.15), i * 80),
    ),
};

// ─── SPA Navigation ─────────────────────────────────────
// This app uses Single Page Application (SPA) navigation — all "pages" are
// <section> elements in the same HTML document. Only one section has the
// "active" class at a time; the rest are hidden via CSS (display: none).
//
// Cache page sections and nav links once at load time
// to avoid repeated DOM queries on every navigation event.
const _pageSections = document.querySelectorAll(".page-section");
const _navLinks = document.querySelectorAll("[data-section]");

/**
 * navigateTo() — Switch the visible page section (SPA-style).
 *
 * The transition flow:
 *   1. Add "vhs-glitch" CSS class → triggers a CRT static / scanline animation
 *   2. Wait 300ms (the glitch plays during this window)
 *   3. Inside the setTimeout callback: swap sections, update nav, run init hooks
 *
 * The 300ms delay is deliberate — it matches the CSS animation duration for the
 * VHS glitch effect, so the actual content swap happens while the screen is
 * visually "distorted", masking the instant DOM change.
 *
 * @param {string} section - Section name: "home", "about", "leaderboard", "game"
 */
function navigateTo(section) {
  // Step 1: Trigger the VHS glitch CSS animation on the whole page body
  document.body.classList.add("vhs-glitch");

  // Step 2: After 300ms (glitch animation finishes), perform the actual section switch
  setTimeout(() => {
    document.body.classList.remove("vhs-glitch");

    // Step 3a: Hide ALL sections first, then show only the target section.
    // This ensures exactly one section is visible at a time.
    _pageSections.forEach((s) => s.classList.remove("active"));
    const el = document.getElementById("sec-" + section);
    if (el) {
      el.classList.add("active");
      // Scroll to top instantly — "instant" avoids a distracting smooth-scroll
      // animation that would conflict with the glitch transition
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    // Step 3b: Update nav link highlighting — remove "active" from all links,
    // then re-add it to links matching the current section.
    // Note: querySelectorAll is used (not _navLinks) because there may be
    // in-page links outside the nav bar that also use data-section.
    _navLinks.forEach((a) => a.classList.remove("active"));
    document
      .querySelectorAll(`[data-section="${section}"]`)
      .forEach((a) => a.classList.add("active"));

    // Step 3c: Section-specific initialisation hooks.
    // Certain sections need fresh data rendered when they become visible.
    if (section === "leaderboard") {
      renderLeaderboard(); // Rebuild score table from localStorage
      renderAchievements(); // Recheck achievement unlock conditions
    }
    if (section === "home") {
      renderPersonalBest(); // Update hero banner with latest high score
      renderHomeStats(); // Refresh the "BATTLE STATS" grid
    }
    if (section === "game") {
      resetGame(); // Reset all game state and show difficulty picker
    }

    // Step 3d: Close the mobile hamburger menu (if open) after navigation.
    // On mobile, the nav links slide out as a panel; we collapse it here so
    // the user sees the new section content rather than the menu overlay.
    document.getElementById("navLinks")?.classList.remove("open");
    const h = document.getElementById("navHamburger");
    if (h) h.textContent = "☰"; // Reset icon from "X" back to hamburger
  }, 300); // ← 300ms matches the VHS glitch CSS animation duration
}

// Global click handler for all [data-section] navigation links.
// Uses event delegation on `document` so that dynamically created links
// (e.g. the "PLAY NOW" link in the empty leaderboard state) also work
// without needing individual event listeners. closest() walks up the DOM
// tree to find the nearest ancestor with data-section, handling clicks
// on child elements (icons, text spans) inside the link.
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-section]");
  if (link) {
    e.preventDefault(); // Prevent the default anchor scroll/navigation
    navigateTo(link.getAttribute("data-section"));
    sfx.click(); // Audible feedback for navigation
  }
});

// ─── Animated Counters ──────────────────────────────────
// Counts up stat values (like "1,250" or "87%") from 0 to the target number
// with a smooth animation, but ONLY when the element scrolls into view.
//
// Why IntersectionObserver instead of scroll events?
//   - Scroll events fire on every pixel of scroll, hundreds of times per second.
//   - IntersectionObserver is browser-optimised: the callback only fires when
//     an element crosses the visibility threshold, with near-zero overhead.
//   - Once the counter has animated, we unobserve the element (fire-once pattern).
//
// The animation uses requestAnimationFrame for smooth 60fps counting.
// At ~125 frames (≈2 seconds at 60fps), the counter reaches its target.
function animateCounters() {
  document.querySelectorAll("[data-target]").forEach((el) => {
    const target = +el.dataset.target, // Final number to count up to (from data-target attr)
      suffix = el.dataset.suffix || ""; // Optional suffix like "%" (from data-suffix attr)
    let cur = 0;
    const inc = target / 125; // Increment per frame — reaches target in ~125 frames (~2.1s at 60fps)

    // Recursive rAF counter: adds `inc` each frame until it reaches `target`
    const tick = () => {
      cur += inc;
      if (cur < target) {
        el.textContent = Math.floor(cur).toLocaleString() + suffix;
        requestAnimationFrame(tick); // Schedule next frame
      } else el.textContent = target.toLocaleString() + suffix; // Snap to exact target on finish
    };

    // Create a per-element IntersectionObserver that fires `tick()` once
    // when 30% of the element is visible in the viewport
    new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting) {
          tick(); // Start the count-up animation
          obs.unobserve(el); // Stop observing — animation should only play once
        }
      },
      { threshold: 0.3 }, // 30% visibility threshold — triggers slightly before fully in view
    ).observe(el);
  });
}

// ─── Leaderboard (localStorage persistence) ─────────────
//
// Persistence pattern: JSON array stored under a single localStorage key.
//   - localStorage only stores strings, so we JSON.stringify on save and
//     JSON.parse on load.
//   - getBoard() always returns a valid array (empty on error or first visit).
//   - The board is sorted descending by score and capped at 20 entries so
//     localStorage usage stays small (~5-10KB max).
//   - Each entry is a plain object with: name, score, accuracy, enemiesKilled,
//     timeSurvived, difficulty, date.
const LB_KEY = "laserDefenderScores"; // localStorage key — namespaced to avoid collisions

/**
 * getBoard() — Retrieve the saved leaderboard array from localStorage.
 * Returns [] if the key is missing, corrupted, or localStorage is unavailable.
 * The try/catch handles: quota exceeded, disabled cookies, malformed JSON.
 */
const getBoard = () => {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || [];
  } catch {
    return []; // Graceful fallback: treat corrupted data as empty board
  }
};

/** clearBoard() — Remove the entire leaderboard from localStorage. */
const clearBoard = () => localStorage.removeItem(LB_KEY);

/**
 * saveScore() — Add a new score entry to the leaderboard.
 *
 * Flow: read existing board → push new entry → sort descending → trim to 20 → write back.
 * This read-modify-write pattern is safe for single-tab usage. (No locking needed
 * because the game runs in one tab and localStorage is synchronous.)
 *
 * @param {string} name  - Player name (defaults to "PILOT" if empty)
 * @param {number} score - Final score
 * @param {Object} stats - Additional stats: accuracy, enemiesKilled, timeSurvived, difficulty
 */
function saveScore(name, score, stats = {}) {
  const board = getBoard();
  board.push({
    name: name || "PILOT", // Default name if the player skipped the input
    score,
    accuracy: stats.accuracy || 0,
    enemiesKilled: stats.enemiesKilled || 0,
    timeSurvived: stats.timeSurvived || 0,
    difficulty: stats.difficulty || "NORMAL",
    date: new Date().toLocaleDateString(), // Human-readable date string (locale-dependent)
  });
  board.sort((a, b) => b.score - a.score); // Highest score first
  board.splice(20); // Cap at 20 entries — prevents unbounded localStorage growth
  localStorage.setItem(LB_KEY, JSON.stringify(board)); // Persist the updated board
}

/**
 * renderLeaderboard() — Build the leaderboard HTML table
 * from localStorage data and inject it into the DOM.
 *
 * This function is called every time the user navigates to the leaderboard
 * section, ensuring the display always reflects the latest saved data.
 *
 * Two DOM targets:
 *   - #leaderboardContent: the main score table (or empty-state placeholder)
 *   - #statsGrid: aggregate stats cards (games played, best score, etc.)
 *
 * The function also triggers animateCounters() on the stats grid so the
 * numbers count up with the scroll-into-view animation.
 */
function renderLeaderboard() {
  const board = getBoard(),
    el = document.getElementById("leaderboardContent"),
    sg = document.getElementById("statsGrid");
  if (!el) return; // Guard: element not in DOM (shouldn't happen, but defensive)

  // ── Empty state: no scores saved yet ──
  // Show a friendly call-to-action instead of an empty table.
  // The data-section="game" link works via event delegation (see global click handler).
  if (!board.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🕹️</div><p style="font-family:'Press Start 2P',cursive;font-size:.8rem;color:var(--gold)">NO SCORES YET</p><p>Play the game and set your first high score!</p><a href="#" data-section="game" class="action-btn" style="margin-top:1rem;display:inline-block">▶ START MISSION</a></div>`;
    // Show placeholder dashes for each stat when there's no data
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

  // ── Rank display helpers ──
  // Top 3 get medal emoji icons and special CSS classes for gold/silver/bronze styling
  const icon = (i) => (i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`);
  const cls = (i) => (i < 3 ? `rank-${i + 1}` : ""); // rank-1, rank-2, rank-3 CSS classes

  // ── Render the score table ──
  // Each row gets "fade-in-up" class for a staggered CSS entrance animation.
  // Scores are formatted with toLocaleString() for thousands separators (e.g. "1,250").
  el.innerHTML = `<table class="leaderboard-table"><thead><tr><th>Rank</th><th>Pilot</th><th>Score</th><th>Acc</th><th>Kills</th><th>Mode</th><th>Date</th></tr></thead><tbody>${board.map((e, i) => `<tr class="fade-in-up"><td class="rank ${cls(i)}">${icon(i)}</td><td>${e.name}</td><td class="player-score">${e.score.toLocaleString()}</td><td>${e.accuracy}%</td><td>${e.enemiesKilled || 0}</td><td class="text-cyan">${e.difficulty || "NORMAL"}</td><td style="color:#888">${e.date}</td></tr>`).join("")}</tbody></table>`;

  // ── Render aggregate stats cards ──
  // Compute summary statistics across ALL saved games (not just top score)
  if (sg) {
    const t = board.length, // Total games played (board length = number of saves)
      b = board[0].score; // Best score (board is sorted descending, so index 0 = best)
    const a = Math.round(board.reduce((s, e) => s + (e.accuracy || 0), 0) / t); // Mean accuracy
    const k = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0); // Sum of all kills

    // Build stat cards with data-target attributes so animateCounters() can
    // animate them from 0 to their final value on scroll-into-view
    sg.innerHTML = [
      [t, "GAMES PLAYED"],
      [b, "BEST SCORE"],
      [a, "AVG ACCURACY", "%"], // Has a suffix "%" appended after the number
      [k, "TOTAL KILLS"],
    ]
      .map(
        ([v, l, s]) =>
          `<div class="stat-card fade-in-up"><div class="stat-value" data-target="${v}"${s ? ` data-suffix="${s}"` : ""}>${v}</div><div class="stat-label">${l}</div></div>`,
      )
      .join("");
    animateCounters(); // Wire up the count-up animations on the newly created elements
  }
}

// ─── Achievements ───────────────────────────────────────
// Renders a grid of achievement badges, marking each
// as unlocked or locked based on player progress.
//
// Achievement data is NOT stored separately — unlock conditions are evaluated
// live from the leaderboard data every time this function is called. This means
// achievements are automatically consistent with leaderboard state and require
// no separate persistence logic.
//
// Each achievement is defined as a tuple: [icon, name, description, isUnlocked].
// The fourth element is a boolean expression evaluated against current stats.
function renderAchievements() {
  const grid = document.getElementById("achievementGrid");
  if (!grid) return;

  // Pull aggregate stats from the leaderboard for condition checks
  const board = getBoard(),
    best = board[0]?.score || 0; // Highest score ever (board[0] since sorted descending)
  const kills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0), // Total kills across all games
    games = board.length; // Number of games played (= number of saved scores)

  // Each entry: [emoji, title, description, unlockCondition]
  // The unlock condition is a live boolean — true = unlocked, false = locked
  grid.innerHTML = [
    ["🚀", "FIRST FLIGHT", "Play your first game", games >= 1],
    ["💯", "CENTURY", "Score 100+", best >= 100],
    ["⭐", "RISING STAR", "Score 500+", best >= 500],
    ["🔥", "ON FIRE", "Score 1,000+", best >= 1000],
    ["💎", "DIAMOND", "Score 5,000+", best >= 5000],
    ["👾", "HUNTER", "Destroy 50 enemies", kills >= 50], // Cumulative across all games
    ["🎯", "MARKSMAN", "Destroy 200 enemies", kills >= 200], // Cumulative across all games
    [
      "💀",
      "HARD CORE",
      "Score on HARD",
      board.some((e) => e.difficulty === "HARD"), // At least one game on HARD difficulty
    ],
    ["🏆", "VETERAN", "Play 10+ games", games >= 10],
    [
      "🕵️",
      "SECRET AGENT",
      "Find the Konami code",
      !!localStorage.getItem("konamiFound"), // Set by triggerKonami() — persists across sessions
    ],
  ]
    .map(
      ([i, n, d, ok]) =>
        // "unlocked" vs "locked" CSS class controls opacity, grayscale, and glow effects
        `<div class="achievement-badge ${ok ? "unlocked" : "locked"} fade-in-up"><div class="achievement-icon">${i}</div><div class="achievement-name">${n}</div><p class="achievement-desc">${d}</p></div>`,
    )
    .join("");
}

// ─── Personal Best Banner ───────────────────────────────
// Updates the hero banner with the player's top score,
// or shows "NO SCORE YET" for new players.
//
// Data flow: localStorage → getBoard() → board[0] (highest score) → DOM.
// This is called on every navigation to the home section, so it always
// reflects the latest data even after a new game is saved.
function renderPersonalBest() {
  const banner = document.getElementById("personalBestBanner");
  if (!banner) return;
  const board = getBoard();
  if (board.length) {
    // board[0] is the all-time best score (board is sorted descending)
    const b = board[0];
    banner.innerHTML = `<span class="pb-label">🏆 YOUR BEST</span><span class="pb-value">${b.score.toLocaleString()}</span><span class="pb-label">BY ${b.name}</span><span class="pb-value text-cyan" style="font-size:.65rem">${b.difficulty || "NORMAL"}</span>`;
    banner.classList.remove("no-score"); // Remove dim/muted styling
  } else {
    // No scores yet — show a call-to-action link to the game section
    banner.innerHTML = `<span class="pb-label">NO SCORE YET —</span><a href="#" data-section="game" style="color:var(--emerald);font-family:'Press Start 2P',cursive;font-size:.55rem">PLAY NOW ▶</a>`;
    banner.classList.add("no-score"); // Add dim/muted styling for empty state
  }
}

// ─── Home Page Stats ─────────────────────────────────────
// Populates the home "BATTLE STATS" grid with real data from localStorage.
//
// Data flow: localStorage → getBoard() → aggregate stats → DOM cards → animateCounters()
//
// This is separate from renderLeaderboard()'s stats grid because the home page
// shows different stat labels ("ENEMIES DESTROYED" vs "TOTAL KILLS") and
// initialises card values to "0" so the count-up animation always starts from zero.
function renderHomeStats() {
  const grid = document.getElementById("homeStatsGrid");
  if (!grid) return;

  // Read all saved games and compute aggregate stats
  const board = getBoard();
  const games = board.length; // Total games played
  const best = board[0]?.score || 0; // Highest single-game score
  const kills = board.reduce((s, e) => s + (e.enemiesKilled || 0), 0); // Sum of kills across all games
  const acc =
    games > 0
      ? Math.round(board.reduce((s, e) => s + (e.accuracy || 0), 0) / games) // Mean accuracy percentage
      : 0; // Avoid division by zero for new players

  // Build stat cards — initial text is "0" so animateCounters() can count up from 0 → target
  // data-target holds the final value; data-suffix holds an optional "%" for accuracy
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
  animateCounters(); // Wire up IntersectionObserver-based count-up animations
}

// ─── Typewriter Effect ──────────────────────────────────
// Types out text character-by-character into an element, simulating someone
// typing on a keyboard. Used on the hero section tagline for dramatic effect.
//
// Approach: setInterval fires every `speed` ms, appending one character per tick.
// Why setInterval instead of requestAnimationFrame? Because this is a fixed-rate
// text effect (35ms per character = ~29 chars/sec), not a visual animation that
// needs to match the display refresh rate. setInterval is simpler and more
// appropriate for timed text sequences.
//
// The "typewriter-active" CSS class can add a blinking cursor pseudo-element
// while typing is in progress, and is removed when the text is fully rendered.
function typewriter(el, text, speed = 35) {
  el.textContent = ""; // Clear any existing content before starting
  el.classList.add("typewriter-active"); // Enable blinking cursor CSS
  let i = 0; // Character index pointer
  const t = setInterval(() => {
    el.textContent += text[i++]; // Append next character
    if (i >= text.length) {
      clearInterval(t); // Stop the interval when all characters are typed
      el.classList.remove("typewriter-active"); // Remove blinking cursor
    }
  }, speed); // Default 35ms per character
}

// ─── Toast Notification ─────────────────────────────────
// Shows a floating notification banner that auto-dismisses after a timeout.
//
// Auto-dismiss pattern:
//   1. Create the toast and append to <body> with a fadeInUp CSS animation
//   2. After `ms` milliseconds, start a 400ms opacity fade-out transition
//   3. After the fade completes (450ms buffer), remove the DOM element entirely
//
// Only one toast is visible at a time — if a new toast is triggered while one
// is already showing, the old one is immediately removed (no stacking).
// The toast uses a fixed ID ("eggToast") so we can find and remove the existing one.
function toast(msg, ms = 4000) {
  document.getElementById("eggToast")?.remove(); // Remove any existing toast first
  const el = document.createElement("div");
  el.id = "eggToast"; // Fixed ID ensures only one toast exists at a time
  el.textContent = msg;
  // Inline styles create a fixed-position banner centered at top of viewport.
  // Uses the app's retro VT323 monospace font and theme colors (--lavender, --iron).
  el.style.cssText = `position:fixed;top:4.5rem;left:50%;transform:translateX(-50%);background:rgba(18,16,28,.97);border:2px solid var(--lavender);color:var(--iron);font-family:'VT323',monospace;font-size:1.2rem;padding:.6rem 1.4rem;z-index:99997;white-space:nowrap;animation:fadeInUp .3s ease-out;box-shadow:0 4px 12px rgba(196,183,235,.25)`;
  document.body.appendChild(el);

  // Auto-dismiss: after `ms`, fade out then remove from DOM
  setTimeout(() => {
    el.style.transition = "opacity .4s"; // Enable CSS transition for smooth fade
    el.style.opacity = "0"; // Trigger the fade-out
    setTimeout(() => el.remove(), 450); // Remove from DOM after fade completes (400ms + 50ms buffer)
  }, ms); // Default 4 seconds visible before fade begins
}

// ─── Easter Eggs ────────────────────────────────────────
//
// The app has three hidden easter eggs:
//   1. Konami Code (keyboard) — ↑↑↓↓←→←→BA awards +1000 points
//   2. Terminal Dot Hack (click) — clicking R→Y→G dots on terminal header runs fake hack sequence (+500 pts)
//   3. Idle UFO (passive) — 18 seconds of no interaction triggers a UFO flyby
//
// All easter egg points use a dual-path system:
//   - If a game is currently active (gameStarted && gameRunning): points are added
//     to the live `score` variable immediately and reflected on screen.
//   - If no game is active: points are "banked" in localStorage under the key
//     "laserDefenderBonus", and applied when the next game starts via startGame().
//   This ensures the player always receives their reward regardless of timing.

// Konami code sequence tracker.
// The classic cheat code: Up Up Down Down Left Right Left Right B A.
// konamiIdx tracks how far through the sequence the user has progressed.
// Any wrong key resets konamiIdx to 0, requiring the full sequence from scratch.
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
let konamiIdx = 0; // Current position in the KONAMI sequence (0 = no progress)

// Terminal dot click sequence tracker for the hack easter egg.
// The player must click the three terminal window dots in order: Red → Yellow → Green
// (like a traffic light turning green = "go" / "access granted").
//
// dotSeq accumulates clicked dot classes. dotTimer resets the sequence if the
// player takes more than 3 seconds between clicks (prevents accidental triggers).
let dotSeq = [], // Array of clicked dot CSS class names (e.g. ["dot-red", "dot-yellow"])
  dotTimer = null; // Timeout handle — resets dotSeq after 3s of inactivity
const DOT_ORDER = ["dot-red", "dot-yellow", "dot-green"]; // Required click order

document.addEventListener("click", (e) => {
  // ── Terminal dot hack sequence detection ──
  // When a terminal dot is clicked, check if it matches the next expected dot
  // in the DOT_ORDER sequence. If all 3 are clicked in order, trigger the hack.
  const dot = e.target.closest(".terminal-dot");
  if (dot) {
    // Identify which dot was clicked by checking its CSS class
    const cls = DOT_ORDER.find((c) => dot.classList.contains(c));
    if (cls) {
      clearTimeout(dotTimer); // Reset the 3-second inactivity timeout
      dotSeq.push(cls); // Record this click
      // Start a new 3-second timeout — if the player waits too long, reset progress
      dotTimer = setTimeout(() => {
        dotSeq = [];
      }, 3000);
      // Validate: each click so far must match DOT_ORDER at the same index
      if (dotSeq.every((c, i) => c === DOT_ORDER[i]) && dotSeq.length <= 3) {
        // All 3 dots clicked in correct order — trigger the easter egg!
        if (dotSeq.length === 3) {
          dotSeq = []; // Reset for potential re-trigger
          runHackSequence(); // Launch the fake hacking animation
        }
        // Otherwise, sequence is partially correct — keep waiting for more clicks
      } else dotSeq = []; // Wrong order — reset and start over
    }
  }

  // ── Footer click — fun toast message (minor easter egg / personality touch) ──
  if (e.target.closest(".footer-bottom p")) {
    beep(400, 0.06);
    toast("🫡 Built at 2am with chai & determination");
  }
});

/**
 * runHackSequence() — Terminal dot easter egg animation.
 *
 * Triggered by clicking the red → yellow → green dots on any terminal window
 * header. Replaces the terminal body content with a fake "hacking" sequence
 * (typed out line-by-line), then awards +500 bonus points.
 *
 * Animation flow:
 *   1. Save original terminal body HTML (to restore later)
 *   2. Replace body with "ACCESS GRANTED" header + empty container
 *   3. setInterval types out 5 "hacking" lines, one every 350ms
 *   4. After all lines are shown, award points and restore original content
 *
 * Point system (dual path):
 *   - During an active game: +500 added directly to `score` (immediate reward)
 *   - Outside of a game: +500 banked in localStorage "laserDefenderBonus"
 *     (applied at the start of the next game via startGame())
 *   This ensures the player always receives the reward regardless of when they
 *   discover the easter egg.
 */
function runHackSequence() {
  const tw = document.querySelector(".terminal-window");
  if (!tw) return;
  const body = tw.querySelector(".terminal-body"),
    orig = body.innerHTML; // Save original content to restore after animation

  // The 5 lines that will be "typed" one by one into the terminal
  const lines = [
    "> INITIALIZING BREACH...",
    "> BYPASSING FIREWALL [██████████] ✓",
    "> ACCESSING MAINFRAME...",
    "> +500 POINTS DEPOSITED ✓",
    "> CONNECTION TERMINATED.",
  ];

  // Replace terminal body with the hack animation UI
  body.innerHTML = `<div style="text-align:left;padding:.5rem 0"><p style="font-family:'Press Start 2P',cursive;font-size:.55rem;color:var(--mint);margin-bottom:1rem">ACCESS GRANTED 🟢</p><div id="hackLines" style="font-size:1.1rem;color:var(--mint);line-height:2"></div></div>`;
  const container = document.getElementById("hackLines");
  let i = 0;
  beep(200, 0.05); // Initial "access" beep

  // Type out one line every 350ms, with random-pitch beeps for each line
  const tick = setInterval(() => {
    if (i < lines.length) {
      const p = document.createElement("p");
      p.textContent = lines[i];
      // Lines with checkmarks (✓) are highlighted in gold to indicate success
      p.style.color = lines[i].includes("✓") ? "#f0c85a" : "var(--mint)";
      container.appendChild(p);
      beep(300 + Math.random() * 200, 0.03); // Random-pitch "data transfer" beep
      i++;
    } else {
      // All lines typed — award points and clean up
      clearInterval(tick);
      localStorage.setItem("hackFound", "1"); // Persist discovery for achievement tracking

      // Dual-path point system: in-game vs banked
      if (gameStarted && gameRunning) {
        // Game is active — add points directly to live score
        score += 500;
        DOM.score.textContent = score;
        flash("score"); // Visual feedback: brief scale-up animation on score HUD
        setTimeout(() => {
          body.innerHTML = orig; // Restore original terminal content
          toast("💾 +500 points added!");
        }, 2500); // Wait 2.5s so the player can read the hack lines
      } else {
        // No game active — bank the bonus for the next game start
        // Additive: if multiple bonuses are banked, they accumulate
        const prev = +(localStorage.getItem("laserDefenderBonus") || 0);
        localStorage.setItem("laserDefenderBonus", String(prev + 500));
        setTimeout(() => {
          body.innerHTML = orig; // Restore original terminal content
          toast("💾 +500 bonus points banked for next game!");
        }, 2500);
      }
    }
  }, 350); // 350ms between lines — fast enough to feel "hacky", slow enough to read
}

// ─── Idle UFO Easter Egg ────────────────────────────────
// Detects user inactivity and rewards idle visitors with a fun surprise.
//
// How idle detection works:
//   - resetIdleTimer() is called on every user interaction (mousemove, keydown,
//     scroll, click, touchstart) — see the DOMContentLoaded event listener setup.
//   - Each call clears the previous timeout and starts a fresh 18-second timer.
//   - If 18 seconds pass without ANY interaction, the timeout fires and a UFO
//     emoji flies across the screen using a CSS animation ("ufoFly").
//
// Why 18 seconds? It's long enough that active users never see it, but short
// enough that someone idly reading the about page or AFK might catch it.
// The UFO uses pointer-events:none so it doesn't interfere with clicks.
//
// The ufoActive flag prevents multiple UFOs from spawning simultaneously.
// After the 5-second flyby animation completes, the timer restarts so another
// UFO can appear after another 18s of inactivity.
let idleTimer = null, // setTimeout handle for the 18-second idle detection
  ufoActive = false; // Guard flag: true while a UFO is currently on screen

function resetIdleTimer() {
  clearTimeout(idleTimer); // Cancel any pending idle timeout
  idleTimer = setTimeout(() => {
    if (ufoActive) return; // Don't spawn a second UFO if one is already flying
    ufoActive = true;

    // Create the UFO element — a fixed-position emoji that flies left-to-right
    const ufo = document.createElement("div");
    ufo.innerHTML = "🛸";
    // Random vertical position between 20% and 60% of viewport height
    // pointer-events:none ensures the UFO doesn't block any clickable elements
    // "ufoFly" is a CSS @keyframes animation that moves from left:-80px to right of screen
    ufo.style.cssText = `position:fixed;top:${20 + Math.random() * 40}%;left:-80px;font-size:2.5rem;z-index:9997;pointer-events:none;animation:ufoFly 5s linear forwards`;
    document.body.appendChild(ufo);
    toast("👀 Was that a UFO?!", 2500); // Show a playful notification

    // Clean up after the 5s animation completes (200ms buffer for safety)
    setTimeout(() => {
      ufo.remove(); // Remove the UFO element from DOM
      ufoActive = false; // Allow future UFO spawns
      resetIdleTimer(); // Restart the idle timer for another potential UFO
    }, 5200); // 5000ms animation + 200ms buffer
  }, 18000); // 18 seconds of inactivity triggers the UFO
}

// ─── Scroll-to-Top Button ───────────────────────────────
// Dynamically creates a fixed-position "TOP" button that appears after
// scrolling down 400px. Created in JS (not HTML) because it's a progressive
// enhancement — if JS fails, no orphan button appears.
//
// The button uses CSS class toggling ("visible") to show/hide with a transition,
// rather than directly setting display/opacity, keeping the logic clean.
function initScrollTop() {
  const btn = document.createElement("button");
  btn.className = "scroll-top-btn"; // CSS handles position: fixed, opacity transition, etc.
  btn.textContent = "▲ TOP";
  document.body.appendChild(btn);
  // Toggle visibility based on scroll position (> 400px = show, <= 400px = hide)
  window.addEventListener("scroll", () =>
    btn.classList.toggle("visible", window.scrollY > 400),
  );
  btn.addEventListener("click", () => {
    sfx.click();
    window.scrollTo({ top: 0, behavior: "smooth" }); // Smooth scroll back to top
  });
}

/* ═══════════════════════════════════════════════
   GAME ENGINE
   HTML5 Canvas-based space shooter with wave system,
   collision detection, particles, and difficulty scaling.

   The game runs at ~60fps via requestAnimationFrame.
   Each frame calls update() (logic) then draw() (rendering).
   The canvas is a fixed 600x800 pixel surface — no responsive scaling.

   Key systems:
   - Wave system: every KILLS_PER_WAVE (8) kills, enemies get faster and spawn more often
   - Particle system: explosions are 12-particle bursts with gravity and fade
   - Meteor shower: random event after 10s that spawns fast small meteors for 5s
   - Screen shake: CSS class toggled on the game container for hit feedback
   ═══════════════════════════════════════════════ */

// Canvas element and 2D rendering context — all game graphics are drawn here
const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d"); // 2D context provides fillRect, fillStyle, globalAlpha, etc.

// ─── Cached DOM Elements ─────────────────────────────────
// Cache references to frequently-updated HUD and UI elements at init time.
// This avoids calling document.getElementById() on every frame in the game loop,
// which would cause unnecessary DOM lookups (~60 times/second). The DOM object
// acts as a namespace for all game-related UI element references.
const DOM = {
  score: document.getElementById("score"), // Score counter in HUD
  lives: document.getElementById("lives"), // Lives counter in HUD
  waveDisplay: document.getElementById("waveDisplay"), // Current wave number
  timeDisplay: document.getElementById("timeDisplay"), // Elapsed time "M:SS"
  modeDisplay: document.getElementById("modeDisplay"), // Difficulty label (EASY/NORMAL/HARD)
  difficultyScreen: document.getElementById("difficultyScreen"), // Pre-game difficulty picker overlay
  pauseOverlay: document.getElementById("pauseOverlay"), // "PAUSED" overlay
  gameOverEl: document.getElementById("gameOver"), // Game over stats screen
  finalScore: document.getElementById("finalScore"), // Final score on game over
  finalKills: document.getElementById("finalKills"), // Final kill count
  finalAccuracy: document.getElementById("finalAccuracy"), // Final accuracy %
  finalTime: document.getElementById("finalTime"), // Final survival time
  finalDifficulty: document.getElementById("finalDifficulty"), // Difficulty on game over
  finalWave: document.getElementById("finalWave"), // Final wave reached
  savedMsg: document.getElementById("savedMsg"), // "Score saved!" confirmation
  playerName: document.getElementById("playerName"), // Name input on game over screen
  gameContainer: document.getElementById("gameContainer"), // Wrapper div (for screen shake CSS)
};

// ─── Background Gradient (pre-cached) ────────────────────
// Create the canvas background gradient ONCE and reuse it every frame.
// createLinearGradient() is moderately expensive — calling it 60x/sec would
// create garbage objects and slow down the render loop. By caching it here,
// draw() just assigns ctx.fillStyle = bgGradient (a simple reference copy).
// The gradient runs vertically from top (#0f1a0f dark green) to bottom (#081008 near-black),
// simulating deep space with a subtle green tint matching the retro CRT theme.
const bgGradient = ctx.createLinearGradient(0, 0, 0, 800);
bgGradient.addColorStop(0, "#0f1a0f"); // Top: dark green-black (space "above")
bgGradient.addColorStop(1, "#081008"); // Bottom: near-black (deep space)

// ─── Color Palette Constants ─────────────────────────────
// All game colors in one place for easy theming and consistency.
//
// Naming convention:
//   p* = Player colors      e* = Enemy colors
//   *Dark = shadow/bottom edge   *Hi = highlight/top edge
//   *Sh = shadow variant
//
// The three-color sets (main/dark/highlight) are used by pixRect() to create
// the 3D extruded pixel-art look — highlight on top-left edges, shadow on
// bottom-right edges, main fill in the center.
//
// Color choices: greens for the player (friendly/hero), reds/pinks for enemies
// (danger), warm yellows for bullets and particles (energy/fire), cool lavender
// for stars (ambient space), orange for meteors (hazard warning).
const C = {
  pBody: "#7ec8a0", // Player body — mint green (hero color)
  pDark: "#5fa880", // Player shadow edge — darker green
  pHi: "#a2dbb8", // Player highlight edge — lighter green
  bullet: "#f5e6a3", // Bullet fill — warm yellow (laser energy)
  bulletSh: "#e0cc80", // Bullet shadow — slightly darker yellow
  enemy: "#e88d8d", // Normal enemy body — salmon red (danger)
  eDark: "#cc6666", // Enemy shadow edge — darker red
  eHi: "#f0b6c5", // Enemy highlight edge — pink (also used as "fast" enemy body color)
  particle: "#f7c5a8", // Explosion particle color — warm peach/orange
  star: "#d4cce0", // Background star color — cool lavender (subtle, non-distracting)
  bgTop: "#0f1a0f", // Canvas gradient top (not used directly — see bgGradient above)
  bgBot: "#081008", // Canvas gradient bottom (not used directly — see bgGradient above)
  meteor: "#ff6633", // Meteor shower color — bright orange-red (warning/hazard)
};

// ─── Game State Variables ────────────────────────────────
// All mutable game state lives here. These are reset by resetGame() at the
// start of each new game. Using `let` at module scope (not in a class) keeps
// the code simple — the game is single-instance, so there's no need for
// encapsulation or multiple game objects.

// Core entity arrays — each element is a plain object with x, y, w, h, speed, etc.
let player, // Single player object: {x, y, w, h, speed}
  bullets, // Array of bullet objects: {x, y, w, h, speed, dead?}
  enemies, // Array of enemy objects: {x, y, w, h, speed, health, type, dead?}
  particles, // Array of explosion particle objects: {x, y, vx, vy, life, color, size}
  stars = []; // Array of background star objects: {x, y, size, speed} — persists across games

// Scoring and lives
let score, // Current score (integer, displayed in HUD)
  lives, // Remaining lives (0 = game over)
  keys = {}; // Map of currently-pressed keyboard keys: {"ArrowLeft": true, " ": true, ...}

// Game lifecycle flags
let gameRunning, // true while the game loop is actively processing frames
  gamePaused, // true while paused (game loop runs but update() early-returns)
  gameStarted, // true after difficulty is selected (false on title/difficulty screen)
  frame; // Frame counter (incremented each update() call) — used for timed events

// Wave system — enemies get harder every KILLS_PER_WAVE kills
let waveNumber, // Current wave number (starts at 1, displayed in HUD)
  killsThisWave, // Kill count within the current wave (resets to 0 on wave advance)
  shotsFired, // Total shots fired this game (for accuracy calculation)
  shotsHit, // Total shots that hit an enemy (for accuracy calculation)
  enemiesKilled, // Total enemies destroyed this game
  startTime, // Date.now() timestamp when the game started (used for elapsed time)
  elapsedTime; // Milliseconds elapsed since game start (pauses when game is paused)

// Difficulty and balancing
let difficulty, // Current difficulty string: "easy", "normal", or "hard"
  enemySpawnRate, // Frames between enemy spawns (lower = more frequent, scales with wave)
  enemySpeedMult, // Multiplier applied to base enemy speed (scales with wave)
  konamiBonus, // Bonus points from easter eggs applied at game start
  lastShot = 0, // Timestamp of last shot fired (for rate-limiting, see shoot())
  idleRunning = true; // Whether the idle starfield animation is active (before game starts)

// Number of kills needed to advance to the next wave
const KILLS_PER_WAVE = 8;

// Meteor shower state — a random mid-game event (see triggerMeteorShower)
let meteorActive = false; // Whether a meteor shower is currently happening
let meteorTimer = 0; // Timestamp when the current shower started
let meteors = []; // Array of active meteor objects: {x, y, w, h, speed, health, dead?}
let lastMeteorCheck = 0; // Frame number of last random check (throttles checks to ~1/sec)

// ─── Star Field Initialisation ───────────────────────────
// Pre-populate 60 stars with random positions, sizes, and scroll speeds.
// Stars scroll downward (increasing y) to create the illusion of the player
// flying upward through space. When a star scrolls off the bottom (y > 800),
// it wraps to the top with a new random x position.
//
// Size range: 1–4px (small dots, like distant stars).
// Speed range: 0.5–2.5 px/frame (varying speeds create a parallax depth effect —
// faster stars appear "closer", slower stars appear further away).
//
// The stars array is initialized once here and persists across game resets
// (resetGame does NOT clear it), so the starfield is always present.
for (let i = 0; i < 60; i++)
  stars.push({
    x: Math.random() * 600, // Random x within canvas width (600px)
    y: Math.random() * 800, // Random y within canvas height (800px)
    size: Math.random() * 3 + 1, // 1–4px square
    speed: Math.random() * 2 + 0.5, // 0.5–2.5 px/frame scroll speed
  });

// ─── Input Handling ──────────────────────────────────────
// Keyboard input uses a "key map" pattern: keydown sets keys[key] = true,
// keyup sets it to false. The game loop reads this map each frame to determine
// continuous movement (e.g., holding ArrowLeft). This decouples input detection
// from the game loop timing — keys are polled, not event-driven.

document.addEventListener("keydown", (e) => {
  keys[e.key] = true; // Record that this key is currently held down

  // Prevent spacebar from scrolling the page when the game section is visible.
  // Without this, pressing Space to shoot would also scroll the page down,
  // since Space is the browser's default "scroll down" shortcut.
  // We only prevent it on the game section to avoid breaking normal page scrolling.
  if (
    e.key === " " &&
    document.getElementById("sec-game")?.classList.contains("active")
  ) {
    e.preventDefault();
  }

  // ── Konami code detection ──
  // Sequential matching: each keypress is compared against KONAMI[konamiIdx].
  // If it matches, advance the index. If the full 10-key sequence is completed,
  // trigger the easter egg and reset. Any wrong key resets to 0 — the player
  // must enter the entire sequence without mistakes.
  if (e.key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      triggerKonami(); // Full sequence entered — award bonus!
      konamiIdx = 0; // Reset for potential re-trigger
    }
  } else konamiIdx = 0; // Wrong key — restart the sequence

  // ── Pause toggle ──
  // Escape or P pauses/unpauses, but only during an active game.
  // The gameStarted && gameRunning check prevents pausing on the title screen
  // or after game over (which would be confusing).
  if (
    (e.key === "Escape" || e.key === "p" || e.key === "P") &&
    gameStarted &&
    gameRunning
  )
    togglePause();
});

// On keyup, mark the key as released so the game loop stops moving the player
document.addEventListener("keyup", (e) => (keys[e.key] = false));

// Canvas click to shoot — allows mouse-based shooting in addition to spacebar.
// Only fires if the game has started (prevents shooting on the difficulty screen).
canvas.addEventListener("click", () => {
  if (gameStarted) shoot();
});

/**
 * triggerKonami() — Konami code easter egg reward.
 *
 * Called when the player successfully enters the full ↑↑↓↓←→←→BA sequence.
 * Awards +1000 bonus points and shows a full-screen celebratory overlay.
 *
 * Uses the same dual-path point system as runHackSequence():
 *   - During active game: points added directly to live score
 *   - Outside of game: points banked in localStorage for next game start
 *
 * Also persists "konamiFound" in localStorage — this is read by
 * renderAchievements() to unlock the "SECRET AGENT" achievement badge.
 *
 * The overlay auto-dismisses after 8 seconds or when the user clicks "AWESOME!".
 */
function triggerKonami() {
  sfx.easter(); // Play the celebratory ascending scale sound effect

  // Persist discovery permanently (survives page reloads) for achievement tracking
  localStorage.setItem("konamiFound", "1");

  // Dual-path point system: in-game vs banked (same pattern as hack easter egg)
  if (gameStarted && gameRunning) {
    score += 1000;
    DOM.score.textContent = score;
    flash("score"); // Visual pulse on score HUD
  } else {
    // Bank 1000 points for the next game start
    // Note: unlike runHackSequence, this overwrites rather than adds — by design,
    // the Konami code awards a flat 1000 regardless of prior banked amount
    localStorage.setItem("laserDefenderBonus", "1000");
  }

  // Dynamic label text based on whether points were applied now or banked
  const label =
    gameStarted && gameRunning ? "+1000 POINTS ADDED!" : "+1000 BONUS POINTS!";

  // Create a full-screen overlay with the reveal announcement
  const ov = document.createElement("div");
  ov.className = "easter-egg-overlay"; // CSS: centered flexbox with semi-transparent backdrop
  ov.innerHTML = `<div class="easter-egg-content"><h2>🎮 SECRET UNLOCKED!</h2><p>You found the Konami Code!</p><p style="font-size:3rem;margin:1rem 0">⬆⬆⬇⬇⬅➡⬅➡🅱🅰</p><p style="color:var(--gold);font-family:'Press Start 2P',cursive;font-size:.7rem">${label}</p><button class="action-btn" style="margin-top:1.5rem" onclick="this.closest('.easter-egg-overlay').remove()">AWESOME!</button></div>`;
  document.body.appendChild(ov);

  // Auto-dismiss after 8 seconds in case the user doesn't click the button.
  // The parentElement check guards against double-removal if the button was already clicked.
  setTimeout(() => ov.parentElement && ov.remove(), 8000);
}

// ─── Game Lifecycle ──────────────────────────────────────

/**
 * startGame() — Begin a new game with the selected difficulty.
 *
 * Called when the player clicks EASY, NORMAL, or HARD on the difficulty screen.
 * Configures all difficulty-dependent parameters and kicks off the game loop.
 *
 * Difficulty settings (destructured from a lookup object):
 *   - lives:          5 / 3 / 1  — more forgiving on easy, one-hit on hard
 *   - enemySpawnRate: 80 / 60 / 40 frames between spawns — fewer enemies on easy
 *   - enemySpeedMult: 0.7 / 1.0 / 1.5 — enemies move slower on easy, faster on hard
 *   - player.speed:   7 / 6 / 5 px/frame — player is slightly faster on easy to compensate
 *
 * The destructuring assignment `[lives, enemySpawnRate, enemySpeedMult, player.speed] = ...`
 * uses a computed property lookup on the difficulty object to get the right tuple.
 *
 * @param {string} diff - Difficulty level: "easy", "normal", or "hard"
 */
function startGame(diff) {
  difficulty = diff;
  sfx.start(); // Play the ascending start fanfare

  // Destructure difficulty settings from a lookup table.
  // Format: { difficulty: [lives, spawnRate, speedMult, playerSpeed] }
  [lives, enemySpawnRate, enemySpeedMult, player.speed] = {
    easy: [5, 80, 0.7, 7], // Forgiving: 5 lives, slow enemies, fast player
    normal: [3, 60, 1, 6], // Balanced: 3 lives, normal speed
    hard: [1, 40, 1.5, 5], // Punishing: 1 life, fast enemies, slow player
  }[diff];

  // Update HUD with initial values
  DOM.lives.textContent = lives;
  DOM.modeDisplay.textContent = diff.toUpperCase();
  DOM.difficultyScreen.style.display = "none"; // Hide the difficulty picker overlay

  // Set lifecycle flags — this starts the game proper
  gameStarted = true;
  gameRunning = true;
  startTime = Date.now(); // Record start time for elapsed time tracking
  waveNumber = 1;
  killsThisWave = 0;
  DOM.waveDisplay.textContent = "1";

  // Apply any banked bonus points from easter eggs (Konami code, hack sequence).
  // These were stored in localStorage by triggerKonami() or runHackSequence()
  // when discovered outside of an active game. We apply them here, then clear
  // the stored value so they're not double-counted.
  konamiBonus = +(localStorage.getItem("laserDefenderBonus") || 0);
  if (konamiBonus > 0) {
    score = konamiBonus; // Start with bonus points
    DOM.score.textContent = score; // Show on HUD immediately
    localStorage.removeItem("laserDefenderBonus"); // Clear so it's not applied again
    konamiBonus = 0;
  }

  // Reset meteor shower state for the new game
  meteorActive = false;
  meteorTimer = 0;
  meteors = [];
  lastMeteorCheck = 0;

  gameLoop(); // Start the requestAnimationFrame loop (update + draw)
  idleRunning = false; // Stop the idle starfield animation (game loop handles stars now)
}

/**
 * togglePause() — Pause/unpause the game, preserving elapsed time correctly.
 *
 * Time preservation trick:
 *   - On pause:  save elapsedTime = now - startTime (snapshot the elapsed time)
 *   - On unpause: reset startTime = now - elapsedTime (backdate the start so
 *     Date.now() - startTime still gives the correct elapsed time)
 *   This avoids the timer "jumping forward" by the duration of the pause.
 *
 * The game loop (update/draw) continues running while paused, but update()
 * early-returns when gamePaused is true, so no game state changes occur.
 * draw() still renders (with a dim overlay) to keep the canvas visible.
 */
function togglePause() {
  gamePaused = !gamePaused;
  DOM.pauseOverlay.style.display = gamePaused ? "flex" : "none"; // Show/hide "PAUSED" overlay
  gamePaused
    ? ((elapsedTime = Date.now() - startTime), beep(400, 0.1)) // Pause: snapshot time, low beep
    : ((startTime = Date.now() - elapsedTime), beep(600, 0.05)); // Unpause: adjust start, high beep
}

/**
 * shoot() — Fire a bullet from the player's current position.
 *
 * Rate-limiting: minimum 150ms between shots (Date.now() comparison).
 * This prevents "bullet spam" from holding spacebar — at 60fps that would be
 * one bullet per frame (16ms), creating a solid beam. 150ms = ~6.7 shots/second,
 * which feels responsive but manageable.
 *
 * The bullet spawns at player.x + 24 (center of the 48px-wide ship) and
 * player.y (top edge of the ship), traveling upward at 14px/frame.
 */
function shoot() {
  if (!gameRunning || gamePaused) return; // Can't shoot when paused or game over
  const now = Date.now();
  if (now - lastShot < 150) return; // Rate limit: 150ms cooldown between shots
  lastShot = now; // Record this shot's timestamp for the next cooldown check
  // Spawn bullet at the center-top of the player sprite, moving upward (negative y)
  bullets.push({ x: player.x + 24, y: player.y, w: 8, h: 16, speed: 14 });
  shotsFired++; // Track for accuracy calculation at game over
  sfx.shoot(); // Pew pew!
}

/**
 * spawnEnemy() — Create a new enemy at a random x position above the canvas.
 *
 * Enemy type probability: 30% "fast" / 70% "normal" (Math.random() > 0.7).
 * Fast enemies are drawn in pink (C.eHi) instead of red (C.enemy) and tend
 * to have higher speed rolls, but both types have the same base speed formula.
 *
 * Enemies spawn at y = -50 (above the visible canvas) so they "fly in" from
 * the top rather than popping into existence. x is random within 0–552 so the
 * 48px-wide sprite stays fully within the 600px canvas (552 + 48 = 600).
 *
 * Health is 2 for all enemies — they require 2 bullet hits to destroy.
 * Speed is (2 + random*3) * enemySpeedMult, giving a range of 2–5 base
 * speed before the difficulty multiplier is applied.
 */
function spawnEnemy() {
  enemies.push({
    x: Math.random() * 552, // Random x, kept within canvas bounds
    y: -50, // Start above canvas (invisible, scrolls in)
    w: 48, // Sprite width (matches player width)
    h: 48, // Sprite height
    speed: (2 + Math.random() * 3) * enemySpeedMult, // 2–5 base speed * difficulty multiplier
    health: 2, // Takes 2 hits to destroy
    type: Math.random() > 0.7 ? "fast" : "normal", // 30% chance of fast (pink) variant
  });
}

/**
 * boom() — Spawn an explosion particle burst at a given position.
 *
 * Creates 12 particles radiating outward from (x, y) in random directions.
 * Each particle has:
 *   - vx, vy: random velocity in range [-4, +4] px/frame (creates a circular burst)
 *   - life: 25 frames of visibility (~0.4 seconds at 60fps)
 *   - size: 2–6px square (random for visual variety)
 *
 * The particles are updated each frame in update() which applies:
 *   - Position: x += vx, y += vy (linear motion)
 *   - Gravity: vy += 0.2 (particles arc downward over time)
 *   - Fade: life-- (used as alpha multiplier: life/25 → 1.0 to 0.0)
 *
 * @param {number} x     - Center x of the explosion
 * @param {number} y     - Center y of the explosion
 * @param {string} color - CSS color string for the particles
 */
function boom(x, y, color) {
  for (let i = 0; i < 12; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8, // Random x velocity: -4 to +4 px/frame
      vy: (Math.random() - 0.5) * 8, // Random y velocity: -4 to +4 px/frame
      life: 25, // 25 frames until particle expires
      color,
      size: Math.random() * 4 + 2, // 2–6px particle size
    });
}

/**
 * collides() — Axis-Aligned Bounding Box (AABB) collision test.
 *
 * Tests whether two rectangles overlap by checking that none of the four
 * "separation conditions" are true:
 *   - a is entirely left of b:   a.x + a.w <= b.x
 *   - a is entirely right of b:  a.x >= b.x + b.w
 *   - a is entirely above b:     a.y + a.h <= b.y
 *   - a is entirely below b:     a.y >= b.y + b.h
 *
 * If NONE of these are true (De Morgan's: all four overlap conditions are true),
 * the rectangles must be overlapping. This is the standard O(1) AABB test used
 * in most 2D games. Both objects must have {x, y, w, h} properties.
 *
 * @param {Object} a - First rectangle {x, y, w, h}
 * @param {Object} b - Second rectangle {x, y, w, h}
 * @returns {boolean} true if the rectangles overlap
 */
function collides(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * flash() — Briefly scale up a HUD element for visual feedback.
 *
 * Adds the "flash" CSS class (which applies a scale transform and color change),
 * then removes it after 200ms. This creates a quick "pulse" effect that draws
 * the player's eye to the changed value (e.g., score increasing, lives decreasing).
 *
 * Accepts either a DOM cache key (e.g., "score" → DOM.score) or a raw element ID
 * as a fallback, making it flexible for both cached and uncached elements.
 *
 * @param {string} id - Key in the DOM cache object, or a DOM element ID
 */
function flash(id) {
  const el = DOM[id] || document.getElementById(id); // Try cache first, fall back to ID lookup
  el.classList.add("flash"); // Trigger the CSS scale/color animation
  setTimeout(() => el.classList.remove("flash"), 200); // Remove after 200ms (matches CSS transition)
}

/**
 * fmtTime() — Format milliseconds as a "M:SS" string for the HUD timer.
 * Examples: 0ms → "0:00", 65000ms → "1:05", 600000ms → "10:00"
 * padStart(2, "0") ensures seconds are always two digits (e.g., "1:05" not "1:5").
 */
function fmtTime(ms) {
  const s = Math.floor(ms / 1000); // Convert ms to whole seconds
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * pixRect() — Draw a pixel-art style rectangle with highlight/shadow edges.
 *
 * Creates a 3D "extruded" look commonly seen in retro/pixel-art games:
 *
 *   ┌──── light (top edge, 3px) ────┐
 *   │ light                    dark │  ← light = left edge (3px), dark = right edge (3px)
 *   │ (left)      MAIN        (rt) │
 *   │ edge        FILL        edge │
 *   └──── dark (bottom edge, 3px) ──┘
 *
 * The "light" color on top-left simulates a light source from the upper-left.
 * The "dark" color on bottom-right simulates shadow, creating depth.
 * The 3px edge width keeps the effect visible but not overwhelming at game scale.
 *
 * @param {number} x     - Left x position
 * @param {number} y     - Top y position
 * @param {number} w     - Width
 * @param {number} h     - Height
 * @param {string} main  - Main fill color (center body)
 * @param {string} dark  - Shadow color (bottom + right edges)
 * @param {string} light - Highlight color (top + left edges)
 */
function pixRect(x, y, w, h, main, dark, light) {
  ctx.fillStyle = main;
  ctx.fillRect(x, y, w, h); // Fill the entire rectangle with main color
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 3); // Top edge highlight (3px tall, full width)
  ctx.fillRect(x, y, 3, h); // Left edge highlight (3px wide, full height)
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 3, w, 3); // Bottom edge shadow (3px tall, full width)
  ctx.fillRect(x + w - 3, y, 3, h); // Right edge shadow (3px wide, full height)
}

// ─── Screen Shake ────────────────────────────────────────
/**
 * onHit() — Trigger a screen shake on the game container.
 *
 * Uses a CSS class toggle approach rather than directly manipulating canvas
 * transforms. The "screen-shake" CSS class applies a @keyframes animation
 * that rapidly translates the entire game container by a few pixels in
 * random directions, creating a "camera shake" effect.
 *
 * Why CSS class toggle instead of canvas transform?
 *   - Simpler: one line to add, one line to remove — no manual animation math
 *   - Performant: CSS animations run on the compositor thread, not JS
 *   - Consistent: the shake affects the entire game container (canvas + HUD),
 *     not just the canvas content, for a more immersive effect
 *
 * Called when the player collides with an enemy or meteor (takes damage).
 */
function onHit() {
  DOM.gameContainer.classList.add("screen-shake"); // Start shake animation
  setTimeout(() => DOM.gameContainer.classList.remove("screen-shake"), 200); // Stop after 200ms
}

// ─── Meteor Shower Event ─────────────────────────────────
/**
 * triggerMeteorShower() — Random mid-game event that adds chaos.
 *
 * Trigger probability: ~2.2% per check, checked roughly once per second
 * (every 60 frames), but only after 10 seconds of gameplay have elapsed.
 * This gives an average interval of ~45 seconds between showers.
 * (See the meteor check block in update() for the probability logic.)
 *
 * Event flow:
 *   1. Show a warning notification ("INCOMING! METEOR SHOWER!")
 *   2. For 5 seconds, spawn a meteor every 8 frames (~7-8 per second)
 *   3. After 6 seconds (5s spawning + 1s cleanup), if all meteors are off-screen,
 *      end the shower and award +50 bonus points for surviving.
 *
 * Meteors are smaller (16x16) and faster (6-10 px/frame) than enemies, but only
 * have 1 health (single hit to destroy). They deal damage on player contact
 * just like enemies.
 */
function triggerMeteorShower() {
  if (meteorActive) return; // Don't trigger if a shower is already in progress
  meteorActive = true;
  meteorTimer = Date.now(); // Record start time for duration tracking

  // Show a warning notification overlaid on the game canvas
  const warn = document.createElement("div");
  warn.className = "wave-clear-notify"; // Reuses the wave-clear CSS animation
  warn.innerHTML = `⚠ INCOMING!<br><span style="font-size:9px;color:#ff6633">METEOR SHOWER!</span>`;
  warn.style.borderColor = "#ff6633"; // Orange border to match meteor theme
  warn.style.color = "#ff6633";
  DOM.gameContainer.appendChild(warn);
  setTimeout(() => warn.remove(), 1500); // Warning visible for 1.5 seconds

  // Ominous two-tone warning sound (low sawtooth drones)
  beep(150, 0.3, "sawtooth");
  setTimeout(() => beep(200, 0.2, "sawtooth"), 150);
}

/**
 * spawnMeteor() — Create a single fast meteor object.
 * Meteors are smaller (16x16 vs 48x48 for enemies), faster (6-10 px/frame),
 * and weaker (1 health vs 2 for enemies). They're a brief hazard, not a core enemy.
 */
function spawnMeteor() {
  meteors.push({
    x: Math.random() * 580, // Random x within canvas (580 + 16 = 596, fits in 600px)
    y: -20, // Spawn just above the visible canvas
    w: 16, // Small — harder to hit but less imposing
    h: 16,
    speed: 6 + Math.random() * 4, // 6–10 px/frame — notably faster than enemies
    health: 1, // One-hit kill (compared to enemies' 2 health)
  });
}

/**
 * updateMeteors() — Process meteor movement, spawning, collisions, and cleanup.
 * Called every frame from update(). No-ops if no meteor shower is active.
 *
 * The function handles three phases of the meteor shower lifecycle:
 *   Phase 1 (0–5s):   Spawn a new meteor every 8 frames while moving existing ones
 *   Phase 2 (5–6s):   Stop spawning, let remaining meteors clear the screen
 *   Phase 3 (>6s):    Once all meteors are gone, end the event and award bonus
 *
 * Collision loops iterate in reverse (mi--, bi--) to safely remove elements
 * by marking them as .dead = true. Actual array compaction happens at the end
 * using the write-pointer pattern (same technique used for bullets/enemies in update()).
 */
function updateMeteors() {
  if (!meteorActive) return; // Early exit: no shower happening

  const elapsed = Date.now() - meteorTimer; // Time since shower started

  // Phase 1: Spawn meteors for the first 5 seconds, one every 8 frames (~7.5/sec)
  if (elapsed < 5000 && frame % 8 === 0) {
    spawnMeteor();
  }

  // Phase 3: After 6 seconds and all meteors are off-screen or destroyed, end the event
  if (elapsed > 6000 && meteors.length === 0) {
    meteorActive = false;
    score += 50; // Survival bonus
    DOM.score.textContent = score;
    flash("score");
    toast("☄ Meteor shower survived! +50 bonus");
  }

  // ── Move meteors and check collisions (reverse iteration for safe removal) ──
  for (let mi = meteors.length - 1; mi >= 0; mi--) {
    const m = meteors[mi];
    m.y += m.speed; // Move meteor downward

    // ── Bullet-meteor collision check ──
    // Inner loop also reverse-iterates; marks both bullet and meteor as dead on hit
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.dead) continue; // Skip already-consumed bullets
      if (collides(b, m)) {
        b.dead = true; // Bullet is consumed
        shotsHit++; // Count as a hit for accuracy tracking
        m.health--;
        if (m.health <= 0) {
          boom(m.x + 8, m.y + 8, C.meteor); // Explosion centered on meteor
          score += 5; // Small score bonus per meteor destroyed
          DOM.score.textContent = score;
          sfx.hit();
          m.dead = true;
          break; // This bullet is consumed — stop checking other bullets
        }
      }
    }

    // ── Meteor-player collision check ──
    // Meteors that hit the player deal damage (same as enemy collision)
    if (!m.dead && collides(m, player)) {
      boom(player.x + 24, player.y + 16, "#ff6633"); // Explosion at player center
      lives--;
      DOM.lives.textContent = lives;
      flash("lives"); // Visual pulse on lives HUD
      sfx.death(); // Damage sound effect
      onHit(); // Screen shake
      m.dead = true; // Meteor is destroyed on contact
      if (lives <= 0) endGame(); // Check for game over
    }

    // Remove meteors that have scrolled past the bottom of the canvas
    if (m.y > 820) m.dead = true;
  }

  // ── Array compaction: remove dead meteors using write-pointer pattern ──
  // This avoids Array.filter() which creates a new array every frame (GC pressure).
  // Instead, we compact in-place by overwriting dead entries with live ones.
  let mWrite = 0;
  for (let i = 0; i < meteors.length; i++) {
    if (!meteors[i].dead) meteors[mWrite++] = meteors[i];
  }
  meteors.length = mWrite; // Truncate the array to remove trailing dead entries
}

/**
 * drawMeteors() — Render all active meteors on the canvas.
 * Each meteor is drawn as a layered square with three visual elements:
 *   1. Outer fill (C.meteor orange) — the meteor body
 *   2. Inner fill (#ff4400 darker orange) — creates an inset/depth effect
 *   3. Trailing glow (semi-transparent orange) — a small rectangle above the
 *      meteor that simulates a heat trail/motion blur as it falls
 */
function drawMeteors() {
  for (let i = 0; i < meteors.length; i++) {
    const m = meteors[i];
    ctx.fillStyle = C.meteor;
    ctx.fillRect(m.x, m.y, m.w, m.h); // Outer body
    ctx.fillStyle = "#ff4400";
    ctx.fillRect(m.x + 2, m.y + 2, m.w - 4, m.h - 4); // Inner core (2px inset)
    // Trailing glow — a semi-transparent rectangle above the meteor body
    // simulates a heat trail / atmospheric entry effect
    ctx.fillStyle = "rgba(255, 102, 51, 0.3)";
    ctx.fillRect(m.x + 4, m.y - 6, m.w - 8, 6);
  }
}

// ─── Drawing Functions ───────────────────────────────────

/**
 * drawPlayer() — Render the player ship sprite on the canvas.
 *
 * The ship is composed of multiple overlapping rectangles drawn with pixRect()
 * for the 3D extruded look. Anatomy from top to bottom:
 *   - Cockpit: small dark-green rectangle at the top (y+4)
 *   - Main body: center section using player colors (green palette)
 *   - Wings: two small rectangles on left and right sides
 *   - Engine glow: two rectangles below the ship that pulse using a sine wave
 *
 * The engine glow alpha oscillates between 0.2 and 1.0 using Math.sin(frame * 0.3),
 * creating a pulsing "thruster" effect. The outer glow is peach-colored and the
 * inner glow is yellow, simulating heat gradation.
 */
function drawPlayer() {
  const { x, y, w, h } = player;
  // Main body — centered horizontally (4px inset on each side), offset down 8px
  pixRect(x + 4, y + 8, w - 8, h - 12, C.pBody, C.pDark, C.pHi);
  // Cockpit — small dark green block at the top center (the "windshield")
  ctx.fillStyle = "#5fa880";
  ctx.fillRect(x + 18, y + 4, 12, 8);
  // Wings — left and right protrusions, darker green with their own 3D shading
  pixRect(x, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0"); // Left wing
  pixRect(x + w - 8, y + 16, 8, 16, C.pDark, "#3f8870", "#7ec8a0"); // Right wing
  // Engine glow (pulsing) — alpha oscillates via sine wave for a thruster flicker effect
  // sin(frame * 0.3) cycles every ~21 frames (~0.35s at 60fps), giving a rapid flicker
  const a = 0.6 + Math.sin(frame * 0.3) * 0.4; // Alpha range: 0.2 to 1.0
  ctx.fillStyle = `rgba(247,197,168,${a})`; // Outer glow: warm peach
  ctx.fillRect(x + 18, y + h, 12, 4); // Wider outer exhaust
  ctx.fillStyle = `rgba(245,230,163,${a})`; // Inner glow: bright yellow (hotter center)
  ctx.fillRect(x + 20, y + h + 4, 8, 2); // Narrower inner exhaust flame
}

/**
 * drawEnemy() — Render an enemy sprite with face (eyes, pupils, mouth).
 *
 * Enemy types have different color palettes:
 *   - "normal" enemies: red/salmon tones (C.enemy, C.eDark, C.eHi)
 *   - "fast" enemies: pink tones (#f0b6c5, #d890a0, #f8d4de)
 * This visual distinction helps players identify the faster, more dangerous variant.
 *
 * The face is composed of:
 *   - Two yellow eyes (8x8 squares)
 *   - Two dark pupils (4x4 squares, centered in the eyes)
 *   - A wide dark mouth (20x4 rectangle) — gives a menacing "grin"
 *
 * @param {Object} e - Enemy object with {x, y, w, h, type}
 */
function drawEnemy(e) {
  const { x, y, w, h } = e,
    f = e.type === "fast"; // Boolean flag for color selection
  // Body — uses pixRect for 3D look, 2px inset from hitbox for visual padding
  pixRect(
    x + 2,
    y + 2,
    w - 4,
    h - 4,
    f ? "#f0b6c5" : C.enemy, // Main fill: pink (fast) or red (normal)
    f ? "#d890a0" : C.eDark, // Shadow: darker pink or darker red
    f ? "#f8d4de" : C.eHi, // Highlight: lighter pink or lighter red
  );
  // Eyes — two yellow squares positioned symmetrically
  ctx.fillStyle = "#f5e6a3";
  ctx.fillRect(x + 10, y + 12, 8, 8); // Left eye
  ctx.fillRect(x + w - 18, y + 12, 8, 8); // Right eye
  // Pupils — small dark squares centered within each eye
  ctx.fillStyle = "#1e1830";
  ctx.fillRect(x + 14, y + 16, 4, 4); // Left pupil
  ctx.fillRect(x + w - 14, y + 16, 4, 4); // Right pupil
  // Mouth — wide dark rectangle for a menacing appearance
  ctx.fillRect(x + 14, y + 30, 20, 4);
}

// ─── Game Loop (Update + Draw) ───────────────────────────

/**
 * update() — THE MAIN GAME LOOP LOGIC. Runs every frame (~60fps).
 *
 * This is the heart of the game engine. It processes all game logic in a
 * specific order that ensures correct behavior:
 *
 * ORDER OF OPERATIONS (each step depends on the previous):
 *   1. Frame counter & timer update
 *   2. Player movement (read keyboard state)
 *   3. Bullet movement & off-screen cleanup
 *   4. Enemy spawning (frame-rate based)
 *   5. Star field scrolling (visual only, no gameplay impact)
 *   6. Collision detection (bullet-enemy, enemy-player) + wave advancement
 *   7. Dead bullet cleanup (second pass — some were marked dead in step 6)
 *   8. Dead/off-screen enemy cleanup
 *   9. Particle physics (movement, gravity, fade, cleanup)
 *   10. Meteor shower random trigger check
 *   11. Meteor update (spawning, movement, collisions, cleanup)
 *
 * Why this order matters:
 *   - Bullets must move (step 3) BEFORE collision checks (step 6) so that
 *     newly fired bullets travel at least one frame before hitting anything.
 *   - Enemies must move (step 6 inner) BEFORE player collision so the check
 *     uses the enemy's current position, not its previous-frame position.
 *   - Dead entity cleanup (steps 7-8) happens AFTER all collisions are resolved
 *     to avoid checking already-removed entities.
 *
 * Array compaction pattern (used for bullets, enemies, particles, meteors):
 *   Instead of Array.filter() (which allocates a new array every frame and
 *   creates garbage collection pressure at 60fps), we use an in-place
 *   write-pointer technique: iterate with a read index, copy live entries
 *   to a write index, then truncate the array. This is O(n) with zero
 *   allocations — critical for a smooth 60fps game loop.
 */
function update() {
  if (!gameRunning || gamePaused) return; // Skip logic when paused or game over
  frame++; // Global frame counter — used for timed spawns and effects
  elapsedTime = Date.now() - startTime; // Update elapsed time for HUD display
  DOM.timeDisplay.textContent = fmtTime(elapsedTime);

  // ── Step 2: Player movement ──
  // Read the keys map (populated by keydown/keyup handlers) and move player.
  // Math.max/Math.min clamp the player within canvas bounds (0 to 552, since player is 48px wide).
  // Supports both Arrow keys and WASD for accessibility.
  if (keys["ArrowLeft"] || keys["a"])
    player.x = Math.max(0, player.x - player.speed);
  if (keys["ArrowRight"] || keys["d"])
    player.x = Math.min(552, player.x + player.speed);
  if (keys[" "]) shoot(); // Spacebar = continuous fire (rate-limited inside shoot())

  // ── Step 3: Bullet movement + off-screen cleanup ──
  // Move all bullets upward. Remove any that have scrolled above the canvas (y < -20).
  // Uses write-pointer compaction to avoid array allocation.
  let bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].y -= bullets[i].speed; // Move upward (negative y direction)
    if (bullets[i].y > -20) {
      // Keep if still on-screen (20px grace above canvas)
      bullets[bWrite++] = bullets[i];
    }
  }
  bullets.length = bWrite;

  // ── Step 4: Enemy spawning ──
  // Spawn a new enemy every `enemySpawnRate` frames. Lower rate = more frequent spawns.
  // At 60fps: rate 80 = ~1.3s between spawns (easy), rate 40 = ~0.67s (hard)
  if (frame % enemySpawnRate === 0) spawnEnemy();

  // ── Step 5: Star field scrolling ──
  // Move stars downward to create the illusion of upward movement.
  // Stars that scroll off the bottom wrap to the top with a new random x.
  for (let i = 0; i < stars.length; i++) {
    stars[i].y += stars[i].speed;
    if (stars[i].y > 800) {
      stars[i].y = 0; // Wrap to top
      stars[i].x = Math.random() * 600; // New random horizontal position
    }
  }

  // ── Step 6: Collision detection (enemy-bullet and enemy-player) ──
  // Outer loop: iterate all enemies, move them, check against all bullets and player.
  for (let ei = 0; ei < enemies.length; ei++) {
    const e = enemies[ei];
    e.y += e.speed; // Move enemy downward

    // Inner loop: check all bullets against this enemy (reverse for safe marking)
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.dead) continue; // Skip bullets already consumed by a previous collision
      if (collides(b, e)) {
        b.dead = true; // Mark bullet as consumed (cleaned up in step 7)
        shotsHit++; // Track for accuracy stat
        e.health--; // Reduce enemy health
        sfx.hit(); // "Damage dealt" sound
        if (e.health <= 0) {
          // Enemy destroyed!
          boom(e.x + 24, e.y + 24, C.particle); // Explosion at enemy center
          score += e.type === "fast" ? 20 : 10; // Fast enemies worth double
          enemiesKilled++;
          killsThisWave++;
          DOM.score.textContent = score;
          flash("score");
          sfx.kill(); // Two-note "enemy destroyed" jingle

          e.dead = true; // Mark for cleanup in step 8

          // ── Wave advancement check ──
          // Every KILLS_PER_WAVE (8) kills, advance to the next wave.
          // Waves increase difficulty by reducing spawn interval and increasing speed.
          if (killsThisWave >= KILLS_PER_WAVE) {
            killsThisWave = 0; // Reset kill counter for the new wave
            waveNumber++;
            DOM.waveDisplay.textContent = waveNumber;
            flash("waveDisplay");

            // Scale difficulty: reduce spawn interval and increase speed with each wave.
            // wb = wave bonus, capped at 9 to prevent infinite scaling.
            // Spawn rate decreases by 3 frames per wave (minimum 20 frames).
            // Speed multiplier increases by 0.08 per wave.
            const wb = Math.min(waveNumber - 1, 9);
            enemySpawnRate = Math.max(
              20, // Hard floor: never spawn faster than every 20 frames (~0.33s)
              ({ easy: 80, hard: 40 }[difficulty] || 60) - wb * 3,
            );
            enemySpeedMult =
              ({ easy: 0.7, hard: 1.5 }[difficulty] || 1) + wb * 0.08;

            // Show a "WAVE N" notification overlaid on the game
            const n = document.createElement("div");
            n.className = "wave-clear-notify";
            n.innerHTML = `WAVE ${waveNumber}<br><span style="font-size:9px;color:#98d8c8">ENEMIES FASTER!</span>`;
            DOM.gameContainer.appendChild(n);
            setTimeout(() => n.remove(), 2100); // Auto-remove after 2.1 seconds
            sfx.wave(); // Triumphant wave-clear jingle
          }
          break; // Bullet consumed — stop checking more bullets against this (now dead) enemy
        }
      }
    }

    // Enemy-player collision (only if enemy wasn't already destroyed by a bullet above)
    // Costs the player a life and triggers screen shake + explosion effects.
    if (!e.dead && collides(e, player)) {
      boom(player.x + 24, player.y + 16, "#f5e6a3"); // Yellow explosion at player center
      lives--;
      DOM.lives.textContent = lives;
      flash("lives"); // Visual pulse on lives HUD (warning: lives decreasing)
      sfx.death(); // Low damage sound
      onHit(); // Trigger screen shake
      e.dead = true; // Enemy is destroyed on contact (kamikaze)
      if (lives <= 0) endGame(); // No lives left = game over
    }
  }

  // ── Step 7: Dead bullet cleanup (second pass) ──
  // Some bullets were marked .dead = true during collision detection in step 6.
  // This pass removes them using the write-pointer compaction pattern.
  bWrite = 0;
  for (let i = 0; i < bullets.length; i++) {
    if (!bullets[i].dead) bullets[bWrite++] = bullets[i];
  }
  bullets.length = bWrite;

  // ── Step 8: Dead/off-screen enemy cleanup ──
  // Removes enemies that were killed in step 6 OR scrolled past the bottom (y >= 850).
  // Enemies that scroll off-screen don't cost the player a life — they're just gone.
  let eWrite = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].dead && enemies[i].y < 850) enemies[eWrite++] = enemies[i];
  }
  enemies.length = eWrite;

  // ── Step 9: Particle physics ──
  // Update each explosion particle: apply velocity, add gravity, decrement life.
  // Particles with life <= 0 are removed via write-pointer compaction.
  let pWrite = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx; // Apply horizontal velocity
    p.y += p.vy; // Apply vertical velocity
    p.vy += 0.2; // Apply gravity (particles arc downward over time)
    p.life--; // Count down to expiry (used as alpha: life/25)
    if (p.life > 0) particles[pWrite++] = p; // Keep alive particles
  }
  particles.length = pWrite;

  // ── Step 10: Meteor shower random trigger ──
  // Only check after 10 seconds of gameplay (give the player time to warm up).
  // Check approximately once per second (every 60 frames) to avoid per-frame
  // random rolls. The 2.2% probability per check gives an expected interval
  // of ~45 seconds between meteor showers (1 / 0.022 ≈ 45 checks ≈ 45 seconds).
  if (!meteorActive && elapsedTime > 10000) {
    if (frame - lastMeteorCheck > 60) {
      lastMeteorCheck = frame;
      if (Math.random() < 0.022) {
        triggerMeteorShower();
      }
    }
  }

  // ── Step 11: Meteor update ──
  updateMeteors(); // Handles meteor spawning, movement, collisions, and cleanup
}

/**
 * draw() — Render the entire game scene to the canvas.
 *
 * RENDER ORDER (back to front — "painter's algorithm"):
 *   1. Background gradient (clears the canvas)
 *   2. Star field (behind everything)
 *   3. Player ship (above stars)
 *   4. Bullets (above player)
 *   5. Enemies (above bullets — enemies are the main visual focus)
 *   6. Meteors (above enemies — they're a foreground hazard)
 *   7. Particles (topmost game objects — explosions should be visible over everything)
 *   8. Pause dimmer (semi-transparent overlay, only when paused)
 *
 * This order ensures that foreground elements (particles, meteors) are never
 * obscured by background elements (stars, player). Canvas draws are cumulative
 * — each fillRect paints over whatever was drawn before it.
 */
function draw() {
  // Step 1: Clear the entire canvas by filling with the pre-cached background gradient.
  // This also serves as the "erase" step — without it, previous frames would persist.
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);

  // Step 2: Draw the star field — small squares in a cool lavender color.
  // Stars are drawn as simple squares (fillRect) rather than circles for the pixel-art aesthetic.
  ctx.fillStyle = C.star;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  // Step 3: Draw the player ship (only if a game is active — not on difficulty screen)
  if (gameStarted) drawPlayer();

  // Step 4: Draw all active bullets — each with an outer fill and inner shadow
  // for a subtle 3D extruded look (same technique as pixRect but simplified)
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    ctx.fillStyle = C.bullet; // Outer fill: warm yellow
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = C.bulletSh; // Inner shadow: darker yellow
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); // 2px inset on all sides
  }

  // Step 5: Draw all enemies (each has its own multi-part sprite drawing)
  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);

  // Step 6: Draw meteors (if a meteor shower is active)
  drawMeteors();

  // Step 7: Draw explosion particles with fading alpha.
  // Each particle's alpha = life/25, so it fades from fully opaque (life=25)
  // to nearly invisible (life=1) before being removed.
  // IMPORTANT: globalAlpha must be reset to 1 after the particle loop,
  // otherwise all subsequent draws (pause overlay, next frame) would be transparent.
  if (particles.length > 0) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 25; // Fade: 1.0 → 0.04 over 25 frames
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1; // Reset alpha so nothing else is affected
  }

  // Step 8: When paused, draw a semi-transparent black overlay to dim the game.
  // This visually signals "paused" without hiding the game state entirely.
  if (gamePaused) {
    ctx.fillStyle = "rgba(0,0,0,.3)"; // 30% black — enough to dim, not to obscure
    ctx.fillRect(0, 0, 600, 800);
  }
}

/**
 * gameLoop() — Main requestAnimationFrame loop.
 *
 * requestAnimationFrame (rAF) is the browser's recommended way to run animations.
 * Unlike setInterval, rAF:
 *   - Syncs to the display refresh rate (usually 60fps) for smooth animation
 *   - Automatically pauses when the tab is hidden (saves CPU/battery)
 *   - Provides optimal frame timing (no drift, no double-frames)
 *
 * The loop calls update() (game logic) then draw() (rendering) each frame.
 * It self-terminates when gameStarted becomes false (game over → resetGame).
 */
function gameLoop() {
  update(); // Process one tick of game logic
  draw(); // Render the current state to canvas
  if (gameStarted) requestAnimationFrame(gameLoop); // Schedule next frame (or stop if game ended)
}

/**
 * drawIdleBackground() — Animate the starfield when no game is running.
 *
 * Shows a gentle star scroll on the difficulty selection screen, giving the
 * canvas visual life even before the player starts a game. Stars move at
 * 30% of their game speed (speed * 0.3) for a slow, ambient effect.
 *
 * This loop runs independently of gameLoop() — it starts on page load and
 * when resetGame() is called, and stops when startGame() sets idleRunning = false.
 * The two loops never run simultaneously because startGame() sets idleRunning = false
 * before calling gameLoop().
 */
function drawIdleBackground() {
  if (!idleRunning) return; // Stop loop if a game has started
  // Clear canvas and redraw background
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 600, 800);
  // Draw and slowly scroll stars (30% of normal speed for a calm ambient effect)
  ctx.fillStyle = C.star;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.y += s.speed * 0.3; // Slow scroll — 30% of in-game speed
    if (s.y > 800) {
      s.y = 0;
      s.x = Math.random() * 600;
    }
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  requestAnimationFrame(drawIdleBackground); // Continue the idle animation loop
}

// ─── Game Over & Score Saving ────────────────────────────

/**
 * endGame() — Stop the game loop, compute final statistics, and show the game over screen.
 *
 * Called when lives reach 0 (from enemy or meteor collision in update/updateMeteors).
 *
 * Stats computation:
 *   - Accuracy = shotsHit / shotsFired * 100 (guarded against division by zero)
 *   - Time survived = elapsedTime formatted as "M:SS"
 *   - All other stats (score, kills, difficulty, wave) are read directly from game state
 *
 * After this function, the game loop continues running (gameStarted is still true),
 * but update() early-returns because gameRunning is false. The canvas freezes on the
 * last frame. The player sees the game over overlay and can choose to save or restart.
 */
function endGame() {
  gameRunning = false; // Stops update() from processing game logic (but rAF loop still runs)
  elapsedTime = Date.now() - startTime; // Final snapshot of elapsed time
  sfx.gameOver(); // Play the descending three-note defeat jingle

  // Compute accuracy: avoid division by zero if the player never fired
  const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;

  // Populate the game over screen with final stats
  DOM.finalScore.textContent = score;
  DOM.finalKills.textContent = enemiesKilled;
  DOM.finalAccuracy.textContent = acc + "%";
  DOM.finalTime.textContent = fmtTime(elapsedTime);
  DOM.finalDifficulty.textContent = difficulty.toUpperCase();
  DOM.finalWave.textContent = waveNumber;
  DOM.gameOverEl.style.display = "block"; // Show the game over overlay
  DOM.savedMsg.textContent = ""; // Clear any previous "Score saved!" message
}

/**
 * saveAndRestart() — Save the current score to the leaderboard, then reset.
 *
 * Flow:
 *   1. Read player name from the input field (default "PILOT" if empty)
 *   2. Compute final accuracy
 *   3. Save score + stats to localStorage via saveScore()
 *   4. Show "Score saved!" confirmation message
 *   5. Play a two-note confirmation sound
 *   6. After 600ms delay (so the player can see the confirmation), call resetGame()
 *
 * The 600ms delay before resetGame() is important — without it, the "Score saved!"
 * message would flash and disappear instantly, giving no visual feedback.
 */
function saveAndRestart() {
  const name = DOM.playerName.value.trim() || "PILOT"; // Default name for empty input
  const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  saveScore(name, score, {
    accuracy: acc,
    enemiesKilled,
    timeSurvived: fmtTime(elapsedTime),
    difficulty: difficulty.toUpperCase(),
  });
  DOM.savedMsg.textContent = "✓ Score saved!"; // Visual confirmation
  beep(800, 0.1); // Two-note "success" confirmation sound
  setTimeout(() => beep(1000, 0.1), 80);
  setTimeout(resetGame, 600); // Brief pause so the player sees the confirmation, then reset
}

/**
 * restartOnly() — Restart the game immediately without saving the score.
 * Used when the player chooses not to record their performance.
 */
function restartOnly() {
  beep(600, 0.1); // Single neutral beep (not the celebratory save sound)
  resetGame();
}

/**
 * resetGame() — Reset ALL game state to initial values and show the difficulty screen.
 *
 * This is the "factory reset" for the game. It must reset EVERY mutable game
 * variable to prevent state leakage between games. Missing a reset here would
 * cause bugs like scores carrying over, enemies persisting, or meteors active
 * at the start of a new game.
 *
 * Called from three places:
 *   1. navigateTo("game") — when the player navigates to the game section
 *   2. saveAndRestart() — after saving the score to leaderboard
 *   3. restartOnly() — when restarting without saving
 *
 * After reset, it starts the idle starfield animation (drawIdleBackground)
 * and shows the difficulty selection overlay, waiting for the player to start.
 *
 * Note: the `stars` array is NOT reset — the starfield persists across games.
 */
function resetGame() {
  // Reset player to center-bottom of canvas
  player = { x: 275, y: 720, w: 48, h: 32, speed: 6 };

  // Clear all entity arrays (but NOT stars — they persist)
  bullets = [];
  enemies = [];
  particles = [];
  meteors = [];

  // Reset scoring and lives
  score = 0;
  lives = 3;

  // Reset lifecycle flags — this stops the game loop's update() from running
  gameRunning = false;
  gamePaused = false;
  gameStarted = false; // This also stops gameLoop's rAF from re-scheduling

  // Reset timing and statistics
  frame = 0;
  shotsFired = 0;
  shotsHit = 0;
  enemiesKilled = 0;
  startTime = 0;
  elapsedTime = 0;

  // Reset wave system
  waveNumber = 1;
  killsThisWave = 0;
  konamiBonus = 0;

  // Reset meteor shower state
  meteorActive = false;
  meteorTimer = 0;
  lastMeteorCheck = 0;

  // Reset HUD displays to default values
  DOM.score.textContent = "0";
  DOM.lives.textContent = "3";
  DOM.waveDisplay.textContent = "1";

  // Hide game over and pause overlays, show difficulty selection
  DOM.gameOverEl.style.display = "none";
  DOM.pauseOverlay.style.display = "none";
  DOM.difficultyScreen.style.display = "flex"; // Flexbox centers the difficulty buttons
  DOM.savedMsg.textContent = ""; // Clear any "Score saved!" message

  // Start the idle starfield animation on the canvas
  idleRunning = true;
  drawIdleBackground(); // Begins the ambient star scroll loop
}

// ─── Fake BIOS Boot Sequence ─────────────────────────────
/**
 * runBootSequence() — Displays a green-on-black BIOS/POST terminal screen
 * that types out ~9 lines before fading out to reveal the actual site.
 *
 * This runs on EVERY page load / refresh and serves as a thematic "loading screen"
 * that reinforces the retro CRT aesthetic. It's purely cosmetic — the actual site
 * is fully loaded behind it.
 *
 * Animation approach: Recursive setTimeout with variable delays.
 *   - addLine() appends one line, then schedules itself after 300–450ms (random).
 *   - The random jitter (Math.random() * 150) makes the "typing" feel organic,
 *     like a real BIOS POST that takes variable time per check.
 *   - After all lines are typed, an 800ms pause lets the player read the final
 *     line, then the screen fades out over 600ms via CSS transition.
 *
 * Each non-empty line plays a quiet, randomly-pitched beep (100–200 Hz) to
 * simulate old CRT/speaker boot sounds. Empty lines are used as visual spacers.
 *
 * The boot screen is a full-viewport overlay (z-index above everything).
 * Adding "hidden" class (display:none) after fade-out removes it from the
 * document flow so it doesn't block interaction with the actual site.
 */
function runBootSequence() {
  const bootScreen = document.getElementById("bootScreen");
  if (!bootScreen) return; // Guard: skip if boot screen element doesn't exist

  // The "POST" messages — written to feel like a real 1980s BIOS boot
  const lines = [
    "BIOS v2.187 — LASER DEFENDER SYSTEMS",
    "Copyright (c) 2187 Emerald Corp.",
    "", // Empty line = visual spacer
    "Memory check... 640K OK", // Classic "640K ought to be enough"
    "Detecting peripherals... JOYSTICK OK",
    "LOADING SECTOR 7G... OK", // Simpsons reference (Homer's sector)
    "Initializing CRT display driver...",
    "", // Visual spacer before final message
    "> BOOT COMPLETE. LAUNCHING laser_defender.exe",
  ];

  const container = document.getElementById("bootLines");
  let i = 0; // Line index — tracks which line to type next

  // Recursive function: types one line per call, then schedules the next
  function addLine() {
    if (i < lines.length) {
      const p = document.createElement("p");
      p.textContent = lines[i];
      // Empty lines ("") are rendered as small spacers instead of invisible paragraphs
      if (lines[i] === "") p.style.height = "0.6rem";
      p.style.animationDelay = "0s"; // Ensure CSS fade-in plays immediately
      container.appendChild(p);
      // Play a quiet boot beep for non-empty lines (random pitch for variety)
      if (lines[i]) beep(100 + Math.random() * 100, 0.02, "square", 0.05);
      i++;
      // Schedule next line with a random delay (300–450ms) for organic timing
      setTimeout(addLine, 300 + Math.random() * 150);
    } else {
      // All lines typed — pause 800ms for readability, then fade out
      setTimeout(() => {
        bootScreen.classList.add("fade-out"); // CSS transition: opacity 1 → 0 over 600ms
        setTimeout(() => {
          bootScreen.classList.add("hidden"); // Remove from layout (display: none)
        }, 600); // Wait for the 600ms fade-out transition to complete
      }, 800); // 800ms reading time after the last line
    }
  }

  addLine(); // Start the recursive typing sequence
}

/* ═══════════════════════════════════════════════
   INITIALISATION — Runs on DOMContentLoaded
   Sets up event listeners, starts boot sequence,
   and initialises all subsystems.

   DOMContentLoaded fires when the HTML is fully parsed and the DOM tree
   is built, but BEFORE images/stylesheets/fonts have finished loading.
   This is the earliest safe moment to access DOM elements.

   Initialisation order matters:
     1. Boot sequence (visual overlay — must start first for perceived speed)
     2. Hamburger menu (needed for mobile navigation immediately)
     3. Data-driven renders (home stats, personal best, achievements)
     4. Idle timer setup (registers event listeners for UFO easter egg)
     5. Clear button handler
     6. Hero typewriter (delayed 800ms to start after boot screen typing)
     7. Idle starfield animation
     8. Click ripple effect
     9. Page body fade-in (very last — reveals everything at once)
   ═══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // ── 1. Boot sequence ──
  // Start the fake BIOS POST screen immediately. It visually "blocks" the page
  // with a full-screen overlay, but JS execution continues normally underneath.
  // The boot screen fades away after ~4 seconds, revealing the loaded site.
  runBootSequence();

  // ── 2. Hamburger menu toggle (mobile navigation) ──
  // Toggles the "open" class on the nav links container, which triggers a CSS
  // slide-in/slide-out animation. Also swaps the icon between ☰ (hamburger)
  // and ✕ (close).
  const hamburger = document.getElementById("navHamburger"),
    navLinks = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    hamburger.textContent = navLinks.classList.contains("open") ? "✕" : "☰";
    sfx.click(); // Audio feedback
  });

  // ── GitHub dropdown toggle ──
  const githubToggle = document.getElementById("githubToggle");
  const githubDropdown = document.getElementById("githubDropdown");
  if (githubToggle && githubDropdown) {
    githubToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent body click-away handler from firing immediately
      githubDropdown.classList.toggle("open");
      sfx.click();
    });
    // Click anywhere outside the dropdown closes it
    document.addEventListener("click", () => {
      githubDropdown.classList.remove("open");
    });
  }

  // ── 3. Data-driven renders ──
  // Populate the home page with data from localStorage. These must run at init
  // because the home section is the default visible section — the player sees
  // these stats immediately.
  renderHomeStats(); // Home page "BATTLE STATS" grid
  initScrollTop(); // Create the scroll-to-top button
  renderPersonalBest(); // Hero banner with highest score
  renderAchievements(); // Achievement badges grid

  // ── 4. Idle timer setup ──
  // Register resetIdleTimer() on ALL common user interaction events.
  // { passive: true } tells the browser these listeners won't call preventDefault(),
  // allowing scroll optimisations (especially important on mobile).
  // After registering, start the first idle timer immediately.
  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, resetIdleTimer, { passive: true }),
  );
  resetIdleTimer(); // Start the 18-second countdown right away

  // ── 5. Clear scores button handler ──
  // Optional chaining (?.) handles the case where the button doesn't exist.
  // Uses native confirm() dialog as a safety check before destructive action.
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("Clear all scores?")) {
      clearBoard(); // Remove scores from localStorage
      renderLeaderboard(); // Re-render the (now empty) leaderboard
      beep(200, 0.3, "sawtooth"); // Low buzz confirms deletion
    }
  });

  // ── 6. Hero typewriter effect ──
  // Start typing the hero section tagline 800ms after DOMContentLoaded.
  // The delay ensures it starts AFTER the boot sequence has begun typing,
  // so both animations don't compete for visual attention simultaneously.
  // The actual text is stored in the data-text attribute, keeping JS and HTML separate.
  const hero = document.getElementById("heroTypewriter");
  if (hero) {
    hero.textContent = ""; // Clear any pre-rendered text (prevents flash of content)
    setTimeout(() => typewriter(hero, hero.dataset.text || "", 25), 800);
  }

  // ── 7. Idle starfield animation ──
  // Start the ambient star scroll on the game canvas. This runs until the
  // player starts a game (startGame sets idleRunning = false).
  drawIdleBackground();

  // ── 8. Click ripple effect ──
  // Creates a small expanding circle animation at the mouse position on every click.
  // This is a site-wide visual flourish — the "click-ripple" CSS class handles
  // the expanding circle animation. The element self-destructs after 350ms.
  document.addEventListener("mousedown", (e) => {
    const ripple = document.createElement("div");
    ripple.className = "click-ripple";
    ripple.style.left = e.clientX + "px"; // Position at mouse coordinates
    ripple.style.top = e.clientY + "px";
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 350); // Clean up after animation completes
  });

  // ── 9. Page body fade-in ──
  // Start with opacity 0, then transition to opacity 1. This creates a smooth
  // "fade in from black" effect when the page first loads.
  // requestAnimationFrame ensures the browser has applied opacity:0 before
  // we trigger the transition to opacity:1 (without it, the browser might
  // batch both style changes into one paint, skipping the animation entirely).
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity .4s ease-in";
  requestAnimationFrame(() => (document.body.style.opacity = "1"));
});
