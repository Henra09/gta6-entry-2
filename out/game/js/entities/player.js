// The player character on foot and in cars: movement, sprint, aim, shooting,
// entering/exiting vehicles, health, drawing (top-down with shadow and weapon).

import { TAU, clamp, angleLerp, dist } from '../core/util.js';
import { CITY, avX, avY, SEA_X, BEACH_X, WORLD_W, WORLD_H } from '../data/city-map.js';

export const WEAPONS = {
  fists:   { name: 'FISTS', dmg: 8,  rate: 0.4, range: 34, melee: true, ammoUse: 0 },
  pistol:  { name: 'PISTOL', dmg: 16, rate: 0.28, range: 420, spread: 0.05 },
  smg:     { name: 'SMG', dmg: 11, rate: 0.09, range: 380, spread: 0.11 },
  shotgun: { name: 'SHOTGUN', dmg: 9, rate: 0.7, range: 240, spread: 0.25, pellets: 6 },
  rifle:   { name: 'RIFLE', dmg: 30, rate: 0.45, range: 560, spread: 0.03 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
export const WEAPON_PRICES = { smg: 900, shotgun: 1400, rifle: 2600 };

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: 100,
    maxHealth: 100,
    walkPhase: 0,
    inCar: null,
    fireCooldown: 0,
    sprint: false,
    radius: 11,
    alive: true,
    currentWeapon: 'pistol',
    armor: 0,
    exitCooldown: 0,
    hurtFlash: 0,
  };
}

export function playerSpeed(p, sprinting) {
  return sprinting ? 210 : 118;
}

export function updatePlayerOnFoot(p, dt, input, world) {
  if (!p.alive) return;
  const sprinting = input.sprint;
  const spd = playerSpeed(p, sprinting);
  let ix = 0, iy = 0;
  if (input.up) iy -= 1;
  if (input.down) iy += 1;
  if (input.left) ix -= 1;
  if (input.right) ix += 1;
  const len = Math.hypot(ix, iy);
  if (len > 0) {
    ix /= len; iy /= len;
    p.vx = ix * spd;
    p.vy = iy * spd;
    p.walkPhase += dt * (sprinting ? 14 : 9);
  } else {
    p.vx = 0; p.vy = 0;
    p.walkPhase = 0;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  constrainToWorld(p, world);
  collideBlocks(p, world);

  if (len > 0) {
    // Face movement direction unless aiming.
    if (!input.aiming) p.angle = angleLerp(p.angle, Math.atan2(iy, ix), 1 - Math.exp(-14 * dt));
  }
  if (input.aiming) {
    p.angle = angleLerp(p.angle, p.aimAngle, 1 - Math.exp(-20 * dt));
  }
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.exitCooldown = Math.max(0, p.exitCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);
}

export function updatePlayerInCar(p, car, dt) {
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
}

// Position a player exiting a car: door side.
export function exitCarPosition(car) {
  const a = car.angle + Math.PI / 2;
  return { x: car.x + Math.cos(a) * 26, y: car.y + Math.sin(a) * 26 };
}

function constrainToWorld(p, world) {
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 20);
  // Cannot walk into the deep sea (can wade on the beach).
  if (p.x > SEA_X + 6) p.x = SEA_X + 6;
}

// Keep the player out of building footprints and other solid rects.
function collideBlocks(p, world) {
  for (const r of world.solids) {
    if (p.x > r.x - p.radius && p.x < r.x + r.w + p.radius && p.y > r.y - p.radius && p.y < r.y + r.h + p.radius) {
      // Push out along the smallest overlap axis.
      const ox = Math.min(p.x - (r.x - p.radius), (r.x + r.w + p.radius) - p.x);
      const oy = Math.min(p.y - (r.y - p.radius), (r.y + r.h + p.radius) - p.y);
      if (ox < oy) {
        p.x += (p.x < r.x + r.w / 2) ? -ox : ox;
      } else {
        p.y += (p.y < r.y + r.h / 2) ? -oy : oy;
      }
    }
  }
}

export function drawPlayer(ctx, p, aiming) {
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // shadow
  ctx.fillStyle = 'rgba(30,25,45,0.35)';
  ctx.beginPath();
  ctx.ellipse(5, 7, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(p.angle);
  if (p.hurtFlash > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(p.hurtFlash * 20));
  // legs animate with walk phase
  const legSwing = Math.sin(p.walkPhase) * 4;
  ctx.fillStyle = '#2c3444';
  ctx.fillRect(-3, -7 + legSwing * 0.4, 6, 5);
  ctx.fillRect(-3, 2 - legSwing * 0.4, 6, 5);
  // torso: white tank top, tanned arms
  ctx.fillStyle = '#e8d5b5';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d84838'; // tank top
  ctx.beginPath();
  ctx.ellipse(1, 0, 6.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // head with dark hair
  ctx.fillStyle = '#caa27a';
  ctx.beginPath();
  ctx.arc(2.5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#241d18';
  ctx.beginPath();
  ctx.arc(0.8, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  // arms + weapon when aiming
  if (aiming && p.currentWeapon !== 'fists') {
    ctx.fillStyle = '#caa27a';
    ctx.fillRect(4, 3, 9, 3);
    ctx.fillRect(4, -6, 9, 3);
    drawWeapon(ctx, p.currentWeapon);
  } else if (p.currentWeapon !== 'fists') {
    ctx.fillStyle = '#caa27a';
    ctx.fillRect(3, 5, 8, 3);
    drawWeapon(ctx, p.currentWeapon);
  }
  ctx.restore();
}

function drawWeapon(ctx, weapon) {
  ctx.fillStyle = '#1d2128';
  if (weapon === 'pistol') ctx.fillRect(11, -2, 8, 4);
  else if (weapon === 'smg') ctx.fillRect(11, -2.5, 14, 5);
  else if (weapon === 'shotgun') { ctx.fillRect(10, -2.5, 20, 5); ctx.fillStyle = '#5a3a22'; ctx.fillRect(8, -2, 6, 4); }
  else if (weapon === 'rifle') { ctx.fillRect(11, -2.5, 24, 5); ctx.fillStyle = '#3a2c1e'; ctx.fillRect(6, -2, 7, 4); }
}

export function drawAimReticle(ctx, p, world, weaponDef) {
  if (p.inCar || weaponDef.melee) return;
  const a = p.aimAngle;
  const ex = p.x + Math.cos(a) * weaponDef.range;
  const ey = p.y + Math.sin(a) * weaponDef.range;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,235,200,0.5)';
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,235,200,0.9)';
  ctx.beginPath();
  ctx.arc(ex, ey, 7, 0, TAU);
  ctx.moveTo(ex - 11, ey); ctx.lineTo(ex - 4, ey);
  ctx.moveTo(ex + 4, ey); ctx.lineTo(ex + 11, ey);
  ctx.moveTo(ex, ey - 11); ctx.lineTo(ex, ey - 4);
  ctx.moveTo(ex, ey + 4); ctx.lineTo(ex, ey + 11);
  ctx.stroke();
  ctx.restore();
}
