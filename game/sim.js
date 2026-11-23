// Star Catcher — shared simulation core for the day-one and day-seven builds.
// Pure logic, no rendering: the browser game (game.js) and the video frame
// renderer (tools/render.mjs) both drive it, so the footage in the video is
// the same game a visitor plays. Logical world: 540 x 960 (portrait).
// Deterministic: one seeded RNG, so both builds open on the identical moment.

export const W = 540;
export const H = 960;
export const PLAYER_Y = 856;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DAY_ONE = {
  name: 'day-one',
  starInterval: 0.95,
  starSpeed: 285,
  rocks: false,
  rockInterval: 0,
  rockFrom: 99,
  particles: false,
  hearts: 0, // 0 = endless, no lives
  maxStars: 3,
  bgStars: 14,
  speedLines: false,
  comboMult: false,
  powerups: false,
  playerSpeed: 420,
  extraStarsFrom: 99,
};

export const DAY_SEVEN = {
  name: 'day-seven',
  starInterval: 1.15, // same opening schedule as day one: identical start
  starSpeed: 235,
  rocks: true,
  rockInterval: 1.45,
  rockFrom: 4,
  particles: true,
  hearts: 3,
  maxStars: 6,
  bgStars: 70,
  speedLines: true,
  comboMult: true,
  powerups: true,
  playerSpeed: 640,
  extraStarsFrom: 3, // after 3 s the updates pile on: stars spawn twice as fast
};

export function createGame(config, seed = 20261123) {
  const rng = mulberry32(seed);
  const extra = mulberry32(seed ^ 0x9e3779b9);
  const bg = [];
  for (let i = 0; i < 90; i++) {
    bg.push({ x: rng() * W, y: rng() * H, r: 0.8 + rng() * 1.8, p: rng() * 6.28, s: 0.5 + rng() * 1.5 });
  }
  return {
    cfg: config,
    rng, extra, bg,
    t: 0,
    player: { x: W / 2, tx: W / 2 },
    stars: [],
    rocks: [],
    parts: [],
    powerups: [],
    score: 0,
    combo: 0,
    best: 0,
    catches: 0,
    level: 1,
    hearts: config.hearts,
    shield: 0,
    shake: 0,
    flash: 0,
    banner: 0,
    bannerText: '',
    starTimer: 0.55, // first star arrives at the same moment in both builds
    rockTimer: 0,
    powerTimer: 9,
    over: false,
    auto: true,
  };
}

function spawnStar(g, x) {
  g.stars.push({
    x: x !== undefined ? x : 40 + g.rng() * (W - 80),
    y: -30,
    v: g.cfg.starSpeed * (0.92 + g.rng() * 0.16) * (1 + (g.level - 1) * 0.06),
    r: 17 + g.rng() * 5,
    spin: g.rng() * 6.28,
    kind: g.rng() < 0.22 ? 'big' : 'star',
  });
}

function spawnRock(g) {
  g.rocks.push({
    x: 40 + g.extra() * (W - 80),
    y: -34,
    v: (g.cfg.starSpeed + 55) * (0.95 + g.extra() * 0.2),
    r: 20 + g.extra() * 10,
    rot: g.extra() * 6.28,
    vr: (g.extra() - 0.5) * 2.2,
  });
}

function burst(g, x, y, color, n) {
  if (!g.cfg.particles) return;
  for (let i = 0; i < n; i++) {
    const a = g.extra() * 6.283, s = 60 + g.extra() * 220;
    g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.55, max: 0.55, r: 2 + g.extra() * 3.5, color });
  }
}

export function step(g, dt, input) {
  if (g.over) return;
  g.t += dt;
  const c = g.cfg;

  // Player: human input (browser) wins; otherwise the auto-player chases the
  // lowest star, so the video shows the game actually being played.
  if (input && input.used) {
    g.auto = false;
    g.player.tx = Math.max(34, Math.min(W - 34, input.x));
  } else if (g.auto) {
    let target = null, bestY = -1;
    for (const s of g.stars) if (s.y > bestY && s.y < PLAYER_Y) { bestY = s.y; target = s; }
    if (target) g.player.tx = target.x;
    // Dodge rocks: a rock closing in overhead beats chasing a star.
    for (const r of g.rocks) {
      if (r.y > PLAYER_Y - 260 && r.y < PLAYER_Y && Math.abs(r.x - g.player.x) < 84) {
        const away = g.player.x < r.x ? -1 : 1;
        g.player.tx = Math.max(34, Math.min(W - 34, g.player.x + away * 150));
        break;
      }
    }
  }
  const dx = g.player.tx - g.player.x;
  const maxStep = c.playerSpeed * dt;
  g.player.x += Math.max(-maxStep, Math.min(maxStep, dx));

  // Spawns. Day seven shares day one's opening schedule, then piles on.
  g.starTimer -= dt;
  if (g.starTimer <= 0 && g.stars.length < c.maxStars) {
    spawnStar(g);
    const interval = (c.extraStarsFrom < 99 && g.t > c.extraStarsFrom) ? c.starInterval * 0.45 : c.starInterval;
    g.starTimer = interval * (0.85 + g.rng() * 0.3);
  }
  if (c.rocks && g.t > c.rockFrom) {
    g.rockTimer -= dt;
    if (g.rockTimer <= 0) { spawnRock(g); g.rockTimer = c.rockInterval * (0.8 + g.extra() * 0.4); }
  }
  if (c.powerups) {
    g.powerTimer -= dt;
    if (g.powerTimer <= 0) {
      g.powerups.push({ x: 50 + g.extra() * (W - 100), y: -30, v: 150, r: 18 });
      g.powerTimer = 11 + g.extra() * 4;
    }
  }

  // Move everything.
  for (const s of g.stars) { s.y += s.v * dt; s.spin += dt * 2; }
  for (const r of g.rocks) { r.y += r.v * dt; r.rot += r.vr * dt; }
  for (const p of g.powerups) p.y += p.v * dt;
  for (const pt of g.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 320 * dt; pt.life -= dt; }
  g.parts = g.parts.filter((p) => p.life > 0);
  if (g.shield > 0) g.shield -= dt;
  if (g.shake > 0) g.shake -= dt;
  if (g.flash > 0) g.flash -= dt;
  if (g.banner > 0) g.banner -= dt;

  const px = g.player.x;
  // Catches.
  for (let i = g.stars.length - 1; i >= 0; i--) {
    const s = g.stars[i];
    if (s.y > H + 40) { g.stars.splice(i, 1); if (g.combo > 0) g.combo = 0; continue; }
    if (Math.abs(s.x - px) < 48 && Math.abs(s.y - PLAYER_Y) < 52) {
      g.stars.splice(i, 1);
      g.combo += 1;
      g.catches += 1;
      const mult = c.comboMult ? Math.min(3, 1 + Math.floor(g.combo / 5)) : 1;
      g.score += (s.kind === 'big' ? 25 : 10) * mult;
      if (g.score > g.best) g.best = g.score;
      burst(g, s.x, s.y, '#ffd34d', 12);
      if (g.catches % 6 === 0) {
        g.level += 1;
        g.banner = 1.1;
        g.bannerText = 'LEVEL ' + g.level;
      }
    }
  }
  // Rocks.
  for (let i = g.rocks.length - 1; i >= 0; i--) {
    const r = g.rocks[i];
    if (r.y > H + 50) { g.rocks.splice(i, 1); continue; }
    if (Math.abs(r.x - px) < 46 && Math.abs(r.y - PLAYER_Y) < 48) {
      g.rocks.splice(i, 1);
      if (g.shield > 0) { burst(g, r.x, r.y, '#7dd7ff', 14); g.score += 15; continue; }
      g.hearts -= 1;
      g.combo = 0;
      g.shake = 0.4;
      g.flash = 0.3;
      burst(g, px, PLAYER_Y, '#ff5d5d', 16);
      if (g.hearts <= 0) g.over = true;
    }
  }
  // Power-ups.
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const p = g.powerups[i];
    if (p.y > H + 40) { g.powerups.splice(i, 1); continue; }
    if (Math.abs(p.x - px) < 48 && Math.abs(p.y - PLAYER_Y) < 52) {
      g.powerups.splice(i, 1);
      g.shield = 5;
      g.banner = 1.1;
      g.bannerText = 'SHIELD!';
      burst(g, p.x, p.y, '#7dd7ff', 14);
    }
  }
}
