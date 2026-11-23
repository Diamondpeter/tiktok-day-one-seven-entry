// Star Catcher — browser renderer + input. The same sim.js drives both the
// day-one build (plain) and the day-seven build (richer): same map, same
// start, visibly more going on the second time.
import { W, H, PLAYER_Y, DAY_ONE, DAY_SEVEN, createGame, step } from './sim.js';

const cfgName = document.body.dataset.build; // "day-one" | "day-seven"
const game = createGame(cfgName === 'day-seven' ? DAY_SEVEN : DAY_ONE);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

const input = { x: W / 2, used: false };
let raf = 0, last = 0, started = false;

function drawGhost(x, y, t) {
  const bob = Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -12, 24, Math.PI, 0);
  ctx.lineTo(24, 12);
  ctx.lineTo(12, 4); ctx.lineTo(0, 12); ctx.lineTo(-12, 4); ctx.lineTo(-24, 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#191419';
  ctx.beginPath(); ctx.arc(-8, -12, 3.4, 0, 6.29); ctx.arc(8, -12, 3.4, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath(); ctx.arc(-14, -4, 3, 0, 6.29); ctx.arc(14, -4, 3, 0, 6.29); ctx.fill();
  if (game.shield > 0) {
    ctx.strokeStyle = 'rgba(125,215,255,' + (0.5 + 0.4 * Math.sin(t * 8)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -4, 36, 0, 6.29); ctx.stroke();
  }
  ctx.restore();
}

function drawStar(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.sin(s.spin) * 0.25);
  const r = s.r;
  ctx.fillStyle = s.kind === 'big' ? '#ff9d2e' : '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fill();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, 6.29); ctx.fill();
  ctx.restore();
}

function drawRock(r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  ctx.fillStyle = '#8b93a7';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.283;
    const rr = r.r * (0.8 + ((i * 37) % 10) / 40);
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b7280';
  ctx.beginPath(); ctx.arc(-r.r * 0.25, -r.r * 0.2, r.r * 0.22, 0, 6.29); ctx.fill();
  ctx.restore();
}

function digits(n, x, y, s, color) {
  // 3x5 pixel digits, drawn as squares — shared with the video renderer.
  const F = {
    '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7],
    '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7],
    '6': [7, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2], '8': [7, 5, 7, 5, 7],
    '9': [7, 5, 7, 1, 7],
  };
  ctx.fillStyle = color;
  String(n).split('').forEach((ch, i) => {
    const g = F[ch] || F['0'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) {
        if (row & (1 << (2 - rx))) ctx.fillRect(x + i * 4 * s + rx * s, y + ry * s, s - 1, s - 1);
      }
    });
  });
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  step(game, dt, input);
  const t = game.t;
  const shx = game.shake > 0 ? (Math.random() - 0.5) * 10 : 0;
  const shy = game.shake > 0 ? (Math.random() - 0.5) * 10 : 0;

  ctx.save();
  ctx.translate(shx, shy);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#141b3d');
  grad.addColorStop(0.6, '#1d2350');
  grad.addColorStop(1, '#2a1745');
  ctx.fillStyle = grad;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  for (const b of game.bg) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * b.s + b.p));
    ctx.fillStyle = 'rgba(255,255,255,' + (tw * (game.cfg.bgStars > 20 ? 0.9 : 0.5)) + ')';
    ctx.fillRect(b.x, b.y, b.r, b.r);
  }
  if (game.cfg.speedLines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 67 + 30) % W);
      const y = ((t * 260 + i * 173) % (H + 120)) - 60;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 46); ctx.stroke();
    }
  }
  for (const p of game.powerups) {
    ctx.fillStyle = '#7dd7ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#0b1026';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S', p.x, p.y + 1);
  }
  for (const s of game.stars) drawStar(s);
  for (const r of game.rocks) drawRock(r);
  for (const pt of game.parts) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.29); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground + player.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - 44, W, 44);
  ctx.fillStyle = '#3ddc84';
  ctx.fillRect(0, H - 48, W, 4);
  drawGhost(game.player.x, PLAYER_Y, t);

  // HUD: score top-left, hearts top-right (day seven), level bar.
  ctx.fillStyle = 'rgba(11,16,38,0.55)';
  ctx.fillRect(14, 14, 150, 46);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('SCORE', 26, 22);
  digits(game.score, 26, 40, 3.4, '#ffffff');
  if (game.cfg.hearts) {
    for (let i = 0; i < game.cfg.hearts; i++) {
      ctx.fillStyle = i < game.hearts ? '#ff5d7a' : 'rgba(255,255,255,0.25)';
      const hx = W - 30 - i * 34, hy = 34;
      ctx.beginPath(); ctx.arc(hx - 6, hy - 3, 7, 0, 6.29); ctx.arc(hx + 6, hy - 3, 7, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - 12, hy); ctx.lineTo(hx, hy + 11); ctx.lineTo(hx + 12, hy); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('LEVEL ' + game.level, W - 22, 62);
    if (game.combo >= 2) {
      ctx.fillStyle = '#ffd34d';
      ctx.fillText('COMBO x' + game.combo, W - 22, 86);
    }
  }
  if (game.banner > 0) {
    ctx.globalAlpha = Math.min(1, game.banner * 2);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.bannerText, W / 2, H * 0.32);
    ctx.globalAlpha = 1;
  }
  if (game.flash > 0) {
    ctx.fillStyle = 'rgba(255,60,60,' + game.flash * 0.9 + ')';
    ctx.fillRect(-12, -12, W + 24, H + 24);
  }
  ctx.restore();

  if (!game.over) { raf = requestAnimationFrame(frame); return; }
  ctx.fillStyle = 'rgba(11,16,38,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
  ctx.font = '20px sans-serif';
  ctx.fillText('Score ' + game.score + '  ·  Best ' + game.best, W / 2, H / 2 + 12);
  ctx.fillText('Press R to play again', W / 2, H / 2 + 52);
}

function start() {
  if (started) return;
  started = true;
  document.getElementById('overlay').style.display = 'none';
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function key(e) {
  if (e.key === 'r' || e.key === 'R') { location.reload(); return; }
  input.used = true;
  if (e.key === 'ArrowLeft' || e.key === 'a') input.x -= 46;
  if (e.key === 'ArrowRight' || e.key === 'd') input.x += 46;
  input.x = Math.max(34, Math.min(W - 34, input.x));
}
window.addEventListener('keydown', key);
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  input.used = true;
  input.x = ((e.clientX - r.left) / r.width) * W;
});
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  input.used = true;
  input.x = ((e.clientX - r.left) / r.width) * W;
  start();
});
document.getElementById('overlay').addEventListener('click', start);
