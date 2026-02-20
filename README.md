# 👾 LASER DEFENDER — Retro Edition

> *Defend the galaxy from waves of pixel invaders. Command your ship through an 8-bit warzone. How long can you survive, pilot?*

A retro-styled, browser-based space shooter built entirely with **vanilla HTML, CSS, and JavaScript** — no frameworks, no build tools, no dependencies. Just open `index.html` and play.

---

## 🎮 Live Preview

Open `index.html` directly in any modern browser. No server required.

---

## ✨ Features

| # | Feature | Description |
|---|---------|-------------|
| 01 | 🎨 **Pixel Graphics** | Hand-crafted pixel art sprites drawn entirely on HTML5 Canvas with retro CRT scanline overlay |
| 02 | 👾 **Enemy Waves** | Endless waves of creeper-inspired aliens — normal and fast variants, each with their own health |
| 03 | ⚡ **Power System** | Laser cooldown mechanic + limited lives. Take too many hits and it's game over |
| 04 | 🏆 **Leaderboard** | Top 20 scores persisted in `localStorage` with name, accuracy, kills, difficulty & date |
| 05 | 🏅 **Achievements** | 10 unlockable badges tracked across sessions (First Flight, On Fire, Hard Core, and more) |
| 06 | 🎯 **3 Difficulties** | Easy (5 lives, slow enemies) · Normal (3 lives, balanced) · Hard (1 life, fast & furious) |
| 07 | 📈 **Wave Scaling** | Every 8 kills advances a wave — enemies spawn faster and move quicker each round |
| 08 | 🔊 **8-bit Sounds** | Procedural sound effects generated in real-time via the **Web Audio API** — zero audio files |
| 09 | 🕹️ **SPA Navigation** | Single-page app with animated section transitions, no page reloads |
| 10 | 🐣 **Easter Eggs** | Konami code, terminal hack sequence, idle UFO flyby, and a secret footer message |

---

## 🕹️ Controls

| Action | Keys |
|--------|------|
| Move Left | `←` or `A` |
| Move Right | `→` or `D` |
| Fire Laser | `Space` or `Mouse Click` |
| Pause / Resume | `Esc` or `P` |

---

## 🗂️ Project Structure

```
miniproject/
├── index.html      # Full SPA — all pages (Home, About, Scores, Game)
├── style.css       # All styles — layout, animations, game UI, responsive
├── app.js          # All logic — SPA nav, game engine, leaderboard, easter eggs
└── assets/
    └── favicon.svg # Pixel art favicon
```

**3 files. That's it.** No `node_modules`, no bundler, no config files.

---

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/laser-defender.git

# Open in browser — no install step needed
open miniproject/index.html
```

Or just double-click `index.html`. Works offline too.

---

## 🔧 Tech Stack

| Technology | Usage |
|------------|-------|
| **HTML5** | Semantic structure, Canvas API for game rendering |
| **CSS3** | Custom properties, CSS Grid, keyframe animations, CRT scanline effect |
| **Vanilla JS** | Game loop (`requestAnimationFrame`), SPA routing, DOM manipulation |
| **Web Audio API** | Procedural 8-bit sound effects — oscillators + gain nodes |
| **localStorage** | Persistent leaderboard scores and achievement tracking |
| **Google Fonts** | VT323 · Press Start 2P |

---

## 🎯 Gameplay

1. Hit **🪙 INSERT COIN** from the home screen
2. Pick your difficulty — **Easy**, **Normal**, or **Hard**
3. Move your ship left/right and shoot down the incoming aliens
4. Each wave gets progressively harder — enemies spawn faster and move quicker
5. Survive as long as possible, then save your score to the leaderboard

**Scoring:**
- Normal enemy destroyed → **+10 pts**
- Fast enemy destroyed → **+20 pts**

---

## 🏅 Achievements

| Badge | Name | Condition |
|-------|------|-----------|
| 🚀 | First Flight | Play your first game |
| 💯 | Century | Score 100+ points |
| ⭐ | Rising Star | Score 500+ points |
| 🔥 | On Fire | Score 1,000+ points |
| 💎 | Diamond | Score 5,000+ points |
| 👾 | Hunter | Destroy 50 enemies |
| 🎯 | Marksman | Destroy 200 enemies |
| 💀 | Hard Core | Score on HARD mode |
| 🏆 | Veteran | Play 10+ games |
| 🕵️ | Secret Agent | Find the Konami code |

---

## 🐣 Easter Eggs

There are **3 hidden secrets** in the game. Can you find them all?

<details>
<summary>Spoilers (click to reveal)</summary>

- **Konami Code** — `↑ ↑ ↓ ↓ ← → ← → B A` anywhere on the page. Grants +1000 bonus points to your next game.
- **Terminal Hack** — Click the three macOS-style dots on the hero terminal in order (🔴 → 🟡 → 🟢). Watch what happens.
- **Footer Secret** — Click the copyright text at the bottom of the page.
- **Idle UFO** — Leave the tab open and idle for ~18 seconds...

</details>

---

## 👥 Team

| Name | Role |
|------|------|
| **Biswajeet** | Lead Developer |
| **Neel** | Lead Developer |
| **Saish** | Lead Developer |
| **Manthan** | Lead Developer |

*B.Tech CSE — 2026*

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**LASER DEFENDER © 2026 — Retro Edition**

*Made with ❤️, pixels, and way too much chai.*

</div>
