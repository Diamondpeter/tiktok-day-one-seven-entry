// Renders gameplay frames of Star Catcher (the same sim.js the browser game
// runs) to PNG files, for the TikTok video. Software rasterizer, Node stdlib
// only: raw RGB buffer -> PNG via zlib. 540x960, ffmpeg upscales to 1080x1920.
// Usage: node tools/render.mjs <outdir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { W, H, PLAYER_Y, DAY_ONE, DAY_SEVEN, createGame, step } from '../game/sim.js';

const OUT = process.argv[2] || '/tmp/tiktok-build/frames';
const FPS = 30;

// --- tiny PNG encoder (RGB8, filter 0) ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- rasterizer ---
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
class FB {
  constructor(w, h) { this.w = w; this.h = h; this.buf = Buffer.alloc(w * h * 3); }
  px(x, y, r, g, b, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    if (a >= 1) { this.buf[i] = r; this.buf[i + 1] = g; this.buf[i + 2] = b; return; }
    this.buf[i] = this.buf[i] * (1 - a) + r * a;
    this.buf[i + 1] = this.buf[i + 1] * (1 - a) + g * a;
    this.buf[i + 2] = this.buf[i + 2] * (1 - a) + b * a;
  }
  rect(x, y, w, h, c, a = 1) {
    const [r, g, b] = hex(c);
    for (let yy = Math.max(0, y | 0); yy < Math.min(this.h, (y + h) | 0); yy++)
      for (let xx = Math.max(0, x | 0); xx < Math.min(this.w, (x + w) | 0); xx++)
        this.px(xx, yy, r, g, b, a);
  }
  circle(cx, cy, r, c, a = 1) {
    const [cr, cg, cb] = hex(c);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) this.px(x, y, cr, cg, cb, a);
      }
  }
  poly(pts, c, a = 1) {
    // scanline fill for a simple polygon
    const [r, g, b] = hex(c);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(this.w - 1, Math.floor(xs[k + 1])); x++)
          this.px(x, y, r, g, b, a);
    }
  }
}

const DIGITS = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2], '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
};
function drawDigits(fb, n, x, y, s, color) {
  String(n).split('').forEach((ch, i) => {
    const g = DIGITS[ch] || DIGITS['0'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++)
        if (row & (1 << (2 - rx))) fb.rect(x + i * 4 * s + rx * s, y + ry * s, s, s, color);
    });
  });
}

function drawGame(fb, g, frameNo) {
  const t = g.t;
  // background gradient
  for (let y = 0; y < H; y++) {
    const k = y / H;
    const r = Math.round(20 + k * 22), gg = Math.round(27 + k * 10), b = Math.round(61 + k * 8);
    fb.rect(0, y, W, 1, '#' + [r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
  }
  for (const s of g.bg) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
    fb.rect(s.x, s.y, s.r, s.r, '#ffffff', tw * (g.cfg.bgStars > 20 ? 0.9 : 0.5));
  }
  if (g.cfg.speedLines) {
    for (let i = 0; i < 8; i++) {
      const x = (i * 67 + 30) % W;
      const y = ((t * 260 + i * 173) % (H + 120)) - 60;
      fb.rect(x, y, 2, 46, '#ffffff', 0.10);
    }
  }
  // shake (deterministic per frame)
  const shx = g.shake > 0 ? Math.sin(frameNo * 12.9898) * 5 : 0;
  const shy = g.shake > 0 ? Math.cos(frameNo * 7.233) * 5 : 0;
  const X = (x) => x + shx, Y = (y) => y + shy;

  for (const p of g.powerups) {
    fb.circle(X(p.x), Y(p.y), p.r, '#7dd7ff');
    fb.circle(X(p.x), Y(p.y), p.r * 0.55, '#0b1026');
  }
  for (const s of g.stars) {
    const r = s.r, x = X(s.x), y = Y(s.y);
    const col = s.kind === 'big' ? '#ff9d2e' : '#ffd34d';
    fb.poly([[x, y - r], [x + r * 0.28, y - r * 0.28], [x + r, y], [x + r * 0.28, y + r * 0.28], [x, y + r], [x - r * 0.28, y + r * 0.28], [x - r, y], [x - r * 0.28, y - r * 0.28]], col);
    fb.circle(x, y, r * 0.32, '#fff6d8');
  }
  for (const rk of g.rocks) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = rk.rot + (i / 6) * 6.283;
      const rr = rk.r * (0.8 + ((i * 37) % 10) / 40);
      pts.push([X(rk.x) + Math.cos(a) * rr, Y(rk.y) + Math.sin(a) * rr]);
    }
    fb.poly(pts, '#8b93a7');
    fb.circle(X(rk.x) - rk.r * 0.25, Y(rk.y) - rk.r * 0.2, rk.r * 0.22, '#6b7280');
  }
  for (const pt of g.parts) {
    fb.circle(X(pt.x), Y(pt.y), pt.r, pt.color, Math.max(0, pt.life / pt.max));
  }
  // ground
  fb.rect(0, H - 44, W, 44, '#000000', 0.35);
  fb.rect(0, H - 48, W, 4, '#3ddc84');
  // ghost player
  const px = X(g.player.x), py = Y(PLAYER_Y + Math.sin(t * 3) * 3);
  fb.circle(px, py - 12, 24, '#ffffff');
  fb.rect(px - 24, py - 12, 48, 24, '#ffffff');
  fb.poly([[px - 24, py + 12], [px - 12, py + 4], [px, py + 12], [px + 12, py + 4], [px + 24, py + 12]], '#ffffff');
  fb.circle(px - 8, py - 12, 3.4, '#191419');
  fb.circle(px + 8, py - 12, 3.4, '#191419');
  fb.circle(px - 14, py - 4, 3, '#ff8fb8');
  fb.circle(px + 14, py - 4, 3, '#ff8fb8');
  if (g.shield > 0) {
    for (let a = 0; a < 6.283; a += 0.08) {
      fb.px(Math.round(px + Math.cos(a) * 36), Math.round(py - 4 + Math.sin(a) * 36), 125, 215, 255, 0.7);
    }
  }
  // HUD
  fb.rect(14, 14, 150, 46, '#0b1026', 0.55);
  // "SCORE" label is added by ffmpeg drawtext over the video (same spot).
  drawDigits(fb, g.score, 26, 40, 3.4, '#ffffff');
  if (g.cfg.hearts) {
    for (let i = 0; i < g.cfg.hearts; i++) {
      const hx = W - 30 - i * 34, hy = 34;
      const col = i < g.hearts ? '#ff5d7a' : '#888888';
      fb.circle(hx - 6, hy - 3, 7, col);
      fb.circle(hx + 6, hy - 3, 7, col);
      fb.poly([[hx - 12, hy], [hx, hy + 11], [hx + 12, hy]], col);
    }
    drawDigits(fb, g.level, W - 60, 62, 3, '#ffffff');
    fb.rect(W - 78, 62, 12, 12, '#ffd34d');
    if (g.combo >= 1) drawDigits(fb, g.combo, W - 60, 86, 3, '#ffd34d');
  }
  if (g.flash > 0) fb.rect(0, 0, W, H, '#ff3c3c', g.flash * 0.9);
}

function renderRun(cfg, seconds, outPrefix, keepFrom = 0) {
  const g = createGame(cfg);
  const total = Math.round(seconds * FPS);
  let frameNo = 0;
  for (let f = 0; f < total; f++) {
    step(g, 1 / FPS, null);
    if (g.t >= keepFrom) {
      const fb = new FB(W, H);
      drawGame(fb, g, frameNo);
      writeFileSync(join(OUT, `${outPrefix}-${String(frameNo).padStart(4, '0')}.png`), encodePNG(fb.buf, W, H));
      frameNo++;
    }
  }
  return { frames: frameNo, score: g.score, level: g.level, catches: g.catches, hearts: g.hearts };
}

mkdirSync(join(OUT, 'd1'), { recursive: true });
mkdirSync(join(OUT, 'd7a'), { recursive: true });
mkdirSync(join(OUT, 'd7b'), { recursive: true });

const d1 = renderRun(DAY_ONE, 7, 'd1/d1');
// day seven: one 20 s run; keep 0-11 s and 14-20 s
// day seven: one 20 s run; keep 0-11 s and 14-20 s. First find a seed whose
// auto-player survives the full 20 s, so the closing footage never freezes.
let seed7 = 20261123;
for (let s = 20261123; s < 20261123 + 50; s++) {
  const probe = createGame(DAY_SEVEN, s);
  for (let f = 0; f < 20 * FPS; f++) step(probe, 1 / FPS, null);
  if (!probe.over && probe.hearts > 0) { seed7 = s; break; }
}
const g7 = createGame(DAY_SEVEN, seed7);
let keptA = 0, keptB = 0;
for (let f = 0; f < 20 * FPS; f++) {
  step(g7, 1 / FPS, null);
  const fb = new FB(W, H);
  if (g7.t <= 11) { drawGame(fb, g7, f); writeFileSync(join(OUT, `d7a/d7a-${String(keptA++).padStart(4, '0')}.png`), encodePNG(fb.buf, W, H)); }
  else if (g7.t >= 14) { drawGame(fb, g7, f); writeFileSync(join(OUT, `d7b/d7b-${String(keptB++).padStart(4, '0')}.png`), encodePNG(fb.buf, W, H)); }
}
console.log(JSON.stringify({ d1, d7a: keptA, d7b: keptB, d7score: g7.score, d7level: g7.level, d7catches: g7.catches, d7hearts: g7.hearts }));
