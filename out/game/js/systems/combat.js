// All weapons fire and damage: player shooting (with spread and pellets), hit
// detection against peds, cops and cars, and the resulting crime reports.

import { WEAPONS } from '../entities/player.js';
import { reportCrime, damagePlayer } from './police.js';
import { playGunshot, playImpact } from '../audio/audio.js';
import { dist } from '../core/util.js';

// Fire the player's current weapon if cooldown allows. Returns true when a shot fired.
export function tryPlayerShoot(world, dt) {
  const p = world.player;
  if (p.inCar || !p.alive) return false;
  const def = WEAPONS[p.currentWeapon];
  p.fireCooldown -= dt;
  if (!world.input.fire || p.fireCooldown > 0) return false;

  if (def.melee) {
    p.fireCooldown = def.rate;
    meleeAttack(world, def);
    return true;
  }
  const ammo = world.ammo[p.currentWeapon] ?? 0;
  if (ammo <= 0) return false;
  world.ammo[p.currentWeapon] = ammo - 1;
  p.fireCooldown = def.rate;
  playGunshot(p.currentWeapon === 'shotgun' || p.currentWeapon === 'rifle');

  const pellets = def.pellets ?? 1;
  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * def.spread * 2;
    const ang = p.aimAngle + spread;
    fireBullet(world, p.x + Math.cos(p.aimAngle) * 18, p.y + Math.sin(p.aimAngle) * 18, ang, def);
  }
  world.shake(1.5);
  reportCrime(world, 'gunshot', p.x, p.y);
  return true;
}

function fireBullet(world, x, y, ang, def) {
  world.effects.muzzle(x, y, ang);
  // Instant raycast: step along the ray to the first hit.
  const step = 12;
  for (let d = 0; d < def.range; d += step) {
    const bx = x + Math.cos(ang) * d;
    const by = y + Math.sin(ang) * d;
    if (bx < 0 || by < 0 || bx > world.worldW || by > world.worldH) break;
    // buildings block bullets
    let blocked = false;
    for (const r of world.solids) {
      if (bx > r.x && bx < r.x + r.w && by > r.y && by < r.y + r.h) { blocked = true; break; }
    }
    if (blocked) {
      world.effects.spark(bx, by);
      break;
    }
    // peds
    for (const q of world.peds) {
      if (q.dead) continue;
      if (dist(q.x, q.y, bx, by) < 11) {
        hitPed(world, q, def.dmg, ang);
        world.effects.blood(bx, by, ang);
        return;
      }
    }
    // cars
    for (const c of world.cars) {
      if (c.dead) continue;
      const dx = c.x - bx, dy = c.y - by;
      if (Math.abs(dx) < c.type.w / 2 + 2 && Math.abs(dy) < c.type.h / 2 + 6) {
        c.health -= def.dmg;
        world.effects.spark(bx, by);
        playImpact(0.3);
        if (c.police) reportCrime(world, 'copHit', x, y);
        else if (c.driver === 'npc') reportCrime(world, 'vehicleHit', x, y);
        if (c.health <= 0 && !c.exploded) {
          c.exploded = true;
          world.explodeCar(c);
        }
        return;
      }
    }
  }
}

function hitPed(world, q, dmg, ang) {
  q.health -= dmg;
  q.panicTimer = 6;
  if (q.cop) reportCrime(world, 'copHit', q.x, q.y);
  else reportCrime(world, 'gunshot', q.x, q.y);
  if (q.health <= 0 && !q.dead) {
    q.dead = true;
    world.stats.kills++;
    reportCrime(world, q.cop ? 'copKill' : 'pedKill', q.x, q.y);
    if (!q.cop) dropCash(world, q.x, q.y);
  }
}

function meleeAttack(world, def) {
  const p = world.player;
  const reach = { x: p.x + Math.cos(p.aimAngle) * 22, y: p.y + Math.sin(p.aimAngle) * 22 };
  for (const q of world.peds) {
    if (q.dead) continue;
    if (dist(q.x, q.y, reach.x, reach.y) < 16) {
      hitPed(world, q, def.dmg * 1.5, p.aimAngle);
      playImpact(0.4);
      return;
    }
  }
  for (const c of world.cars) {
    if (dist(c.x, c.y, reach.x, reach.y) < c.type.w / 2 + 8) {
      c.health -= 4;
      world.effects.spark(reach.x, reach.y);
      return;
    }
  }
}

function dropCash(world, x, y) {
  const amount = 30 + Math.floor(Math.random() * 90);
  world.pickups.push({ kind: 'cash', x, y, amount, bob: 0 });
}
