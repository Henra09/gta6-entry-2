// In-game HUD: money, wanted stars, health/armor bars, weapon + ammo, objective text,
// mission timer, subtitles, notification toasts, minimap frame. Drawn in screen space.

import { worldToScreen } from '../render/camera.js';
import { drawMinimap } from './minimap.js';
import { WEAPONS } from '../entities/player.js';
import { police } from '../systems/police.js';
import { missionState } from '../systems/missions.js';
import { activity, shopState } from '../systems/economy.js';
import { districtAt } from '../data/city-map.js';

const FONT = '600 15px "Segoe UI", system-ui, sans-serif';
const FONT_BIG = '700 26px "Segoe UI", system-ui, sans-serif';

export function drawHUD(ctx, world, w, h) {
  const p = world.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ---- money (top right) ----
  ctx.font = FONT_BIG;
  ctx.fillStyle = 'rgba(10,14,18,0.55)';
  ctx.fillText('$' + world.money.toLocaleString(), w - 178, 40);
  ctx.font = FONT_BIG;
  ctx.fillStyle = '#b8e0a0';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText('$' + world.money.toLocaleString(), w - 182, 40);
  ctx.shadowBlur = 0;

  // ---- wanted stars (under money) ----
  const stars = police.wanted;
  ctx.font = '24px system-ui';
  for (let i = 0; i < 5; i++) {
    const sx = w - 178 + i * 26;
    const active = i < stars;
    const blink = active && police.decayTimer > 4 && Math.sin(world.time * 8) > 0;
    ctx.fillStyle = active && !blink ? '#ffd23a' : 'rgba(40,44,52,0.7)';
    drawStar(ctx, sx, 66, 10);
  }

  // ---- health + armor bars (bottom left) ----
  const bx = 26, by = h - 84;
  bar(ctx, bx, by, 190, 13, p.health / 100, '#5ec46a', 'HEALTH');
  if (p.armor > 0) bar(ctx, bx, by + 18, 190, 10, p.armor / 100, '#5aa8d8', 'ARMOR');

  // ---- weapon + ammo (bottom left, above health) ----
  ctx.font = FONT;
  ctx.fillStyle = 'rgba(240,240,230,0.9)';
  const wname = p.inCar ? 'DRIVING' : (WEAPONS[p.currentWeapon]?.name ?? 'FISTS');
  const ammo = !p.inCar && WEAPONS[p.currentWeapon]?.melee ? '' : p.inCar ? '' : ` ${world.ammo[p.currentWeapon] ?? 0}`;
  ctx.fillText(wname + ammo, bx + 4, by - 10);

  // ---- district name (bottom right) ----
  ctx.textAlign = 'right';
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(240,225,190,0.85)';
  ctx.fillText(districtAt(p.x, p.y), w - 26, h - 26);

  // ---- minimap (top left) ----
  drawMinimap(ctx, world, 20, 20, 200, 150);

  // ---- objective text (top center under minimap-ish) ----
  const objective = missionState.objective || (missionState.active ? '' : world.nextObjective);
  if (objective) {
    ctx.textAlign = 'center';
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(10,14,18,0.5)';
    ctx.fillText(objective, w / 2 + 1, 32 + 1);
    ctx.fillStyle = '#f5e9c8';
    ctx.fillText(objective, w / 2, 32);
  }

  // ---- mission timer ----
  if (activity.kind) {
    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui';
    ctx.fillStyle = activity.timer < 10 ? '#ff6a5a' : '#f5e9c8';
    ctx.fillText(activity.text, w / 2, 58);
    ctx.fillText(Math.ceil(activity.timer) + 's', w / 2, 84);
  }

  // ---- dialogue subtitles (bottom center) ----
  if (missionState.subtitle) {
    const sub = missionState.subtitle;
    ctx.textAlign = 'center';
    ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(sub.who + ':', w / 2, h - 116);
    ctx.font = FONT;
    ctx.fillStyle = 'rgba(10,14,18,0.55)';
    ctx.fillText(sub.text, w / 2 + 1, h - 92 + 1);
    ctx.fillStyle = '#f0ead8';
    ctx.fillText(sub.text, w / 2, h - 92);
  }

  // ---- mission banner (center) ----
  if (world.time < missionState.bannerUntil) {
    ctx.textAlign = 'center';
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,14,18,0.6)';
    ctx.fillText(missionState.banner, w / 2 + 2, h * 0.3 + 2);
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(missionState.banner, w / 2, h * 0.3);
  }

  // ---- notifications ----
  let ny = 200;
  ctx.textAlign = 'center';
  for (const n of world.notifications) {
    const age = world.time - n.t;
    if (age > 3) continue;
    ctx.font = FONT;
    ctx.fillStyle = `rgba(240,235,220,${Math.min(1, 3 - age)})`;
    ctx.fillText(n.text, w / 2, ny);
    ny += 24;
  }

  // ---- interaction hints ----
  ctx.textAlign = 'center';
  ctx.font = FONT;
  if (world.hint) {
    ctx.fillStyle = 'rgba(10,14,18,0.55)';
    ctx.fillText(world.hint, w / 2 + 1, h - 150);
    ctx.fillStyle = '#cfe8b8';
    ctx.fillText(world.hint, w / 2, h - 150);
  }
  if (shopState.open === null && world.shopPrompt) {
    ctx.fillStyle = '#f5d98a';
    ctx.fillText(world.shopPrompt, w / 2, h - 176);
  }

  // busted/wasted overlay flash
  if (world.screenFlash) {
    const f = world.screenFlash;
    const a = Math.min(0.55, (world.time - f.t0) * 1.2);
    ctx.fillStyle = f.kind === 'busted' ? `rgba(40,60,120,${a})` : `rgba(120,20,20,${a})`;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = '800 72px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#f0ead8';
    ctx.fillText(f.kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2);
  }

  ctx.restore();
}

function bar(ctx, x, y, w, hgt, t, color, label) {
  ctx.fillStyle = 'rgba(12,14,18,0.6)';
  ctx.fillRect(x, y, w, hgt);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, t)), hgt - 4);
  ctx.strokeStyle = 'rgba(240,235,220,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, hgt);
  ctx.font = '700 10px system-ui';
  ctx.fillStyle = 'rgba(240,235,220,0.8)';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y - 3);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rr;
    const py = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
