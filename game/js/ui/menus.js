// Menus: title screen (Play / Continue / Controls / Credits), pause menu, and the
// gun shop / garage panels. All drawn on the same canvas in screen space.

import { consumeClick } from '../core/input.js';
import { openShop, closeShop, shopOpen, shopMove, buyCurrent, shopIndex, shopItems, GARAGE_CARS } from '../systems/economy.js';
import { playUiBlip } from '../audio/audio.js';
import { CITY, districtAt } from '../data/city-map.js';

const FONT = '600 20px "Segoe UI", system-ui, sans-serif';
const TITLE_FONT = '800 76px "Segoe UI", system-ui, sans-serif';

export const menuState = {
  mode: 'title',      // title | controls | credits | pause
  selected: 0,
};

export const titleItems = ['PLAY', 'CONTINUE', 'CONTROLS', 'CREDITS'];

function drawBackdrop(ctx, w, h, time) {
  // warm sunset gradient with a sun disc and palm silhouettes — the city's identity
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c3350');
  g.addColorStop(0.45, '#c26a3a');
  g.addColorStop(0.72, '#e89a4a');
  g.addColorStop(1, '#3a2c48');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sun
  ctx.fillStyle = 'rgba(255,214,120,0.95)';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.56, 110, 0, Math.PI * 2);
  ctx.fill();
  // sun stripes (retrowave)
  ctx.fillStyle = 'rgba(194,106,58,0.55)';
  for (let i = 0; i < 5; i++) {
    const sy = h * 0.56 + i * 26 + 6;
    ctx.fillRect(w * 0.5 - 130, sy, 260, 8 + i * 3);
  }
  // sea line
  ctx.fillStyle = '#1e5a68';
  ctx.fillRect(0, h * 0.72, w, h);
  ctx.fillStyle = 'rgba(255,220,140,0.3)';
  ctx.fillRect(0, h * 0.72, w, 3);
  // palm silhouettes
  ctx.fillStyle = '#181428';
  for (const px of [w * 0.12, w * 0.85, w * 0.22, w * 0.78]) {
    const py = h * 0.74;
    ctx.fillRect(px - 4, py - 90, 8, 90);
    for (let a = 0; a < 5; a++) {
      const ang = -Math.PI / 2 + (a - 2) * 0.5;
      ctx.save();
      ctx.translate(px, py - 90);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(38, 0, 40, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // city skyline silhouette
  ctx.fillStyle = 'rgba(20,16,34,0.9)';
  const t = time * 0.0002;
  for (let bx = 0; bx < w; bx += 46) {
    const bh = 40 + 60 * Math.abs(Math.sin(bx * 0.021 + t));
    ctx.fillRect(bx, h * 0.72 - bh, 40, bh);
  }
}

export function drawTitle(ctx, w, h, hasSave, time) {
  drawBackdrop(ctx, w, h, time);
  ctx.textAlign = 'center';
  // logo
  ctx.font = TITLE_FONT;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('SOL DORADO', w / 2 + 4, h * 0.24 + 4);
  ctx.fillStyle = '#ffd23a';
  ctx.fillText('SOL DORADO', w / 2, h * 0.24);
  ctx.font = '600 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#f5e9c8';
  ctx.fillText('a city of sun, sand and sin', w / 2, h * 0.30);

  const items = hasSave ? titleItems : titleItems.filter((i) => i !== 'CONTINUE');
  for (let i = 0; i < items.length; i++) {
    const y = h * 0.56 + i * 44;
    const hot = i === menuState.selected;
    ctx.font = hot ? '800 30px "Segoe UI", system-ui, sans-serif' : FONT;
    ctx.fillStyle = hot ? '#ffd23a' : 'rgba(240,230,210,0.75)';
    ctx.fillText((hot ? '▸ ' : '') + items[i], w / 2, y);
  }
  ctx.font = '400 14px system-ui';
  ctx.fillStyle = 'rgba(230,220,200,0.55)';
  ctx.fillText('W/S or ↑/↓ to select · ENTER or click to choose', w / 2, h - 24);
}

export function drawInfoScreen(ctx, w, h, mode, time) {
  drawBackdrop(ctx, w, h, time);
  ctx.fillStyle = 'rgba(10,10,20,0.72)';
  ctx.fillRect(w * 0.14, h * 0.1, w * 0.72, h * 0.8);
  ctx.textAlign = 'center';
  ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd23a';
  ctx.fillText(mode === 'controls' ? 'CONTROLS' : 'CREDITS', w / 2, h * 0.2);
  ctx.font = FONT;
  ctx.fillStyle = '#f0ead8';
  const lines = mode === 'controls' ? [
    'W A S D — move / drive',
    'SHIFT — sprint (on foot)',
    'F or LEFT MOUSE — aim & shoot toward the cursor',
    'E — enter / exit car · interact · buy',
    'Q — cycle weapons',
    'SPACE — handbrake (drift)',
    'R — radio station',
    'ESC or P — pause',
    '',
    'STEAL cars. RUN jobs. SURVIVE the heat.',
  ] : [
    'SOL DORADO — an original open-world crime story',
    '',
    'Engine, art, city, code: built from scratch, plain canvas + ES modules',
    'No libraries. No engines. Just sun.',
    '',
    'Starring: ROSARIO · EL CHINO · CAPITÁN VEGA · MARISOL · BRUNO · LA SOMBRA',
    '',
    'Made for the make.fun competition — gta6-01',
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, h * 0.3 + i * 28);
  }
  ctx.font = '400 14px system-ui';
  ctx.fillStyle = 'rgba(230,220,200,0.55)';
  ctx.fillText('ESC — back', w / 2, h - 26);
}

export function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,10,16,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = '800 46px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd23a';
  ctx.fillText('PAUSED', w / 2, h * 0.3);
  const items = ['RESUME', 'CONTROLS', 'CREDITS'];
  for (let i = 0; i < items.length; i++) {
    const hot = i === menuState.selected;
    ctx.font = hot ? '800 28px "Segoe UI", system-ui, sans-serif' : FONT;
    ctx.fillStyle = hot ? '#ffd23a' : 'rgba(240,230,210,0.8)';
    ctx.fillText((hot ? '▸ ' : '') + items[i], w / 2, h * 0.45 + i * 44);
  }
  ctx.font = '400 14px system-ui';
  ctx.fillStyle = 'rgba(230,220,200,0.55)';
  ctx.fillText('W/S or ↑/↓ · ENTER to choose · ESC to resume', w / 2, h - 24);
}

// ---------- shops ----------

export function drawShop(ctx, w, h, world) {
  const isShop = shopOpen() === 'shop';
  const items = isShop ? shopItems : GARAGE_CARS;
  const pw = 460, ph = 70 + items.length * 38;
  const px = w / 2 - pw / 2, py = h / 2 - ph / 2;
  ctx.fillStyle = 'rgba(10,12,18,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#c8a860';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = 'left';
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd23a';
  ctx.fillText(isShop ? 'OSO ARMERÍA — GUN SHOP' : 'TALLER COSTA — GARAGE', px + 20, py + 34);
  ctx.font = FONT;
  ctx.fillStyle = '#f0ead8';
  ctx.fillText('$' + world.money.toLocaleString(), px + pw - 120, py + 34);
  ctx.font = FONT;
  for (let i = 0; i < items.length; i++) {
    const y = py + 70 + i * 36;
    const hot = i === shopIndex();
    if (hot) {
      ctx.fillStyle = 'rgba(255,210,58,0.18)';
      ctx.fillRect(px + 10, y - 22, pw - 20, 30);
    }
    ctx.fillStyle = hot ? '#ffd23a' : '#d8d2c0';
    ctx.fillText((hot ? '▸ ' : '') + items[i].label ?? items[i].name, px + 24, y);
  }
  ctx.textAlign = 'center';
  ctx.font = '400 13px system-ui';
  ctx.fillStyle = 'rgba(220,215,200,0.6)';
  ctx.fillText('W/S select · E buy · ESC leave', w / 2, py + ph - 12);
}

// Called each frame while a menu is up: consumes keys via menuState.
export function menuInput(input, hasSave) {
  // handled in main via wasPressed
}
