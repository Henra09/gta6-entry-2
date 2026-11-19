// Pedestrians: wander sidewalks, avoid each other and the player, panic and flee
// when gunfire or crimes happen nearby. Some are cops on foot.

import { clamp, dist, randRange, makeRng, angleLerp } from '../core/util.js';
import { CITY, avX, avY, WORLD_W, WORLD_H, SEA_X } from '../data/city-map.js';

const SKINS = ['#e8c8a0', '#caa27a', '#9a7048', '#6a4a30'];
const SHIRTS = ['#d84838', '#3a7ab8', '#d8b03a', '#5aa06a', '#c8c4bc', '#8a5a9a', '#e8e2d0', '#3a3a42'];
const HAIRS = ['#241d18', '#4a3020', '#181410', '#6a5240', '#101010'];

export function createPed(x, y, cop) {
  const rng = makeRng((x * 131 + y * 17) | 0);
  return {
    x, y,
    vx: 0, vy: 0,
    angle: rng() * Math.PI * 2,
    speed: cop ? 120 : randRange(rng, 26, 52),
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    shirt: cop ? '#2a3c58' : SHIRTS[Math.floor(rng() * SHIRTS.length)],
    hair: HAIRS[Math.floor(rng() * HAIRS.length)],
    walkPhase: rng() * 6,
    cop: !!cop,
    state: cop ? 'patrol' : 'walk',   // walk | flee | patrol | chase | shoot
    panicTimer: 0,
    shootCooldown: 0,
    health: cop ? 60 : 30,
    radius: 9,
    dead: false,
    homeAx: nearestAxis(avX, x),
    homeAy: nearestAxis(avY, y),
    turnTimer: 0,
  };
}

function nearestAxis(arr, v) {
  let best = arr[0];
  for (const a of arr) if (Math.abs(v - a) < Math.abs(v - best)) best = a;
  return best;
}

// Social force-ish movement: follow sidewalk edges, avoid neighbors, flee danger.
export function updatePed(p, dt, world) {
  if (p.dead) return;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.turnTimer -= dt;
  if (p.panicTimer > 0) p.panicTimer -= dt;

  let tx = 0, ty = 0;
  if (p.state === 'flee' || p.panicTimer > 0) {
    p.state = 'flee';
    // run away from the nearest threat point
    const th = world.threatPoint || { x: p.x + 1, y: p.y };
    const away = Math.atan2(p.y - th.y, p.x - th.x);
    tx = Math.cos(away); ty = Math.sin(away);
  } else if (p.cop && world.wanted > 0 && world.threatPoint) {
    // cops converge on the threat and shoot from range
    const th = world.threatPoint;
    const d = dist(p.x, p.y, th.x, th.y);
    if (d > 160) {
      const a = Math.atan2(th.y - p.y, th.x - p.x);
      tx = Math.cos(a); ty = Math.sin(a);
      p.state = 'chase';
    } else {
      p.state = 'shoot';
      tx = 0; ty = 0;
    }
  } else {
    // wander along the sidewalk near home roads
    p.state = p.cop ? 'patrol' : 'walk';
    const sw = CITY.runW / 2 + CITY.sidewalk / 2;
    // target: keep near a sidewalk line and drift forward
    if (p.turnTimer <= 0) {
      p.wanderAngle = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() * 2 - 1) * 0.5;
      p.wanderAxisX = Math.random() < 0.5;
      p.turnTimer = 2 + Math.random() * 3;
    }
    if (p.wanderAxisX) {
      tx = Math.cos(p.wanderAngle ?? 0);
      ty = clamp((p.homeAy + (p.y < p.homeAy ? -sw : sw)) - p.y, -1, 1);
    } else {
      ty = Math.sin(p.wanderAngle ?? 0);
      tx = clamp((p.homeAx + (p.x < p.homeAx ? -sw : sw)) - p.x, -1, 1);
    }
  }

  const speed = p.state === 'flee' ? p.speed * 2.2 : p.cop && p.state === 'chase' ? p.speed * 1.6 : p.speed;
  p.vx = tx * speed;
  p.vy = ty * speed;

  // neighbor avoidance
  for (const q of world.peds) {
    if (q === p || q.dead) continue;
    const dx = p.x - q.x, dy = p.y - q.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 24 * 24 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.vx += (dx / d) * (24 - d) * 6;
      p.vy += (dy / d) * (24 - d) * 6;
    }
  }
  // avoid the player a bit unless shooting
  if (world.player && !world.player.inCar) {
    const dx = p.x - world.player.x, dy = p.y - world.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 30 && d > 0.1) {
      p.vx += (dx / d) * (30 - d) * 8;
      p.vy += (dy / d) * (30 - d) * 8;
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // stay on land
  p.x = clamp(p.x, 24, Math.min(WORLD_W - 24, SEA_X + 40));
  p.y = clamp(p.y, 24, WORLD_H - 24);

  // walk out of buildings
  for (const r of world.solids) {
    if (p.x > r.x - 8 && p.x < r.x + r.w + 8 && p.y > r.y - 8 && p.y < r.y + r.h + 8) {
      const ox = Math.min(p.x - (r.x - 8), (r.x + r.w + 8) - p.x);
      const oy = Math.min(p.y - (r.y - 8), (r.y + r.h + 8) - p.y);
      if (ox < oy) p.x += (p.x < r.x + r.w / 2) ? -ox : ox;
      else p.y += (p.y < r.y + r.h / 2) ? -oy : oy;
    }
  }

  if (Math.hypot(p.vx, p.vy) > 4) {
    p.angle = angleLerp(p.angle, Math.atan2(p.vy, p.vx), 1 - Math.exp(-10 * dt));
    p.walkPhase += dt * 10;
  }
}

export function panicNearby(world, x, y, radius) {
  for (const p of world.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.panicTimer = 4 + Math.random() * 3;
      p.state = 'flee';
    }
  }
  world.threatPoint = { x, y };
  world.threatTimer = 3;
}

export function drawPed(ctx, p) {
  if (p.dead) {
    // lying down body
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(30,25,45,0.3)';
    ctx.beginPath(); ctx.ellipse(4, 6, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(10, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(30,25,45,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  const legSwing = Math.sin(p.walkPhase) * 3;
  ctx.fillStyle = '#2c3444';
  ctx.fillRect(-3, -6 + legSwing * 0.4, 5, 4);
  ctx.fillRect(-3, 2 - legSwing * 0.4, 5, 4);
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(2, 0, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath(); ctx.arc(0.6, 0, 3.9, 0, Math.PI * 2); ctx.fill();
  if (p.cop) {
    ctx.fillStyle = '#1c2636';
    ctx.beginPath(); ctx.arc(0.6, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    // gun when shooting/chasing
    if (p.state === 'shoot' || p.state === 'chase') {
      ctx.fillStyle = '#1d2128';
      ctx.fillRect(4, -1.5, 8, 3);
    }
  }
  ctx.restore();
}
