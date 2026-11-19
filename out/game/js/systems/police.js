// Wanted level and police response: stars 0-5 rise with crimes, police cars spawn
// and chase, foot cops shoot, the level decays when the player stays out of sight,
// and busted/wasted resolve with money penalties.

import { dist, clamp } from '../core/util.js';
import { createCar, updatePoliceCar } from '../entities/vehicle.js';
import { createPed, updatePed, panicNearby } from '../entities/pedestrian.js';
import { avX, avY } from '../data/city-map.js';
import { playWasted, playGunshot } from '../audio/audio.js';

export const police = {
  wanted: 0,           // 0..5 (float heat internally, integer stars shown)
  heat: 0,
  spawnTimer: 0,
  bustedTimer: 0,
  decayTimer: 0,
  lastSeen: 0,
};

const CRIME_WITNESSED = {
  gunshot: 0.35,
  pedKill: 1.1,
  carJack: 0.7,
  copKill: 1.6,
  copHit: 0.4,
  vehicleHit: 0.25,
};

export function reportCrime(world, kind, x, y) {
  const add = CRIME_WITNESSED[kind] ?? 0.3;
  police.heat = Math.min(5, police.heat + add);
  police.wanted = Math.ceil(police.heat - 0.01);
  police.decayTimer = 0;
  panicNearby(world, x, y, 260);
  if (world.hud) world.hud.dirty = true;
}

export function updatePolice(world, dt, spawnFX) {
  const p = world.player;
  const time = world.time;

  // Heat decays only when no cop has line-of-sight-ish proximity for a while.
  let seen = false;
  for (const c of world.cars) {
    if (c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 380) { seen = true; break; }
  }
  if (!seen) for (const q of world.peds) {
    if (q.cop && !q.dead && dist(q.x, q.y, p.x, p.y) < 300) { seen = true; break; }
  }

  if (seen) {
    police.lastSeen = time;
    police.decayTimer = 0;
  } else {
    police.decayTimer += dt;
    if (police.decayTimer > 5 && police.heat > 0) {
      police.heat = Math.max(0, police.heat - dt * 0.25);
      police.wanted = Math.ceil(police.heat - 0.01);
    }
  }

  // Spawn response: count police cars near the player, add more with higher stars.
  const maxCars = [0, 1, 2, 3, 4, 6][police.wanted];
  const maxCops = [0, 0, 1, 2, 3, 4][police.wanted];
  police.spawnTimer -= dt;
  let carCount = 0, copCount = 0;
  for (const c of world.cars) if (c.police && !c.dead) carCount++;
  for (const q of world.peds) if (q.cop && !q.dead) copCount++;

  if (police.wanted > 0 && police.spawnTimer <= 0) {
    police.spawnTimer = 3.5;
    if (carCount < maxCars) {
      spawnPoliceCar(world, p);
    } else if (copCount < maxCops) {
      spawnFootCop(world, p);
    }
  }

  // Police cars chase the player (or their car).
  const target = p.inCar ? p.inCar : p;
  for (const c of world.cars) {
    if (c.police && !c.dead) {
      if (world.stagedChase && c.stagedHold !== undefined) {
        // staged scene: hold position behind the player, sirens on
        c.y += Math.sign(c.stagedHold - c.y) * Math.min(Math.abs(c.stagedHold - c.y), 30 * dt);
        c.x += Math.sign(target.x - c.x) * Math.min(Math.abs(target.x - c.x), 20 * dt);
        c.angle = Math.PI / 2;
        c.speed = 120; c.vx = 0; c.vy = 120;
        c.siren = true;
      } else {
        updatePoliceCar(c, dt, target, world);
      }
      // cop cars drop officers when close and stationary-ish
      if (!world.stagedChase && dist(c.x, c.y, p.x, p.y) < 140 && Math.abs(c.speed) < 30 && copCount < maxCops + 1 && Math.random() < dt * 0.5) {
        const cop = createPed(c.x + 20, c.y + 20, true);
        world.peds.push(cop);
        copCount++;
      }
    }
  }

  // Foot cops shoot at the player.
  for (const q of world.peds) {
    if (!q.cop || q.dead) continue;
    updatePed(q, dt, world);
    if ((q.state === 'shoot' || q.state === 'chase') && q.shootCooldown <= 0 && dist(q.x, q.y, p.x, p.y) < 240) {
      q.shootCooldown = 0.9 + Math.random() * 0.5;
      const ang = Math.atan2(p.y - q.y, p.x - q.x);
      playGunshot(false);
      spawnFX.muzzle(q.x + Math.cos(ang) * 14, q.y + Math.sin(ang) * 14, ang);
      // accuracy falls with distance
      const hitChance = clamp(0.75 - dist(q.x, q.y, p.x, p.y) / 500, 0.15, 0.75);
      if (Math.random() < hitChance) {
        damagePlayer(world, 7, 'cop');
      }
    }
  }

  // Busted: on foot, cops within reach for 1.2s while wanted -> arrested.
  if (police.wanted > 0 && !p.inCar && p.alive) {
    let closeCop = false;
    for (const q of world.peds) {
      if (q.cop && !q.dead && dist(q.x, q.y, p.x, p.y) < 42) { closeCop = true; break; }
    }
    if (closeCop) {
      police.bustedTimer += dt;
      if (police.bustedTimer > 1.2) bustPlayer(world);
    } else {
      police.bustedTimer = Math.max(0, police.bustedTimer - dt * 2);
    }
  } else {
    police.bustedTimer = 0;
  }
}

function spawnPoliceCar(world, p) {
  // spawn on a road far from the player
  for (let tries = 0; tries < 12; tries++) {
    const ax = avX[Math.floor(Math.random() * avX.length)];
    const ay = avY[Math.floor(Math.random() * avY.length)];
    const onAve = Math.random() < 0.5;
    const x = onAve ? ax + 18 : ax + 100;
    const y = onAve ? ay + 100 : ay + 18;
    const d = dist(x, y, p.x, p.y);
    if (d > 500 && d < 1400) {
      const car = createCar(x, y, onAve ? Math.PI / 2 : 0, 0, true);
      world.cars.push(car);
      return;
    }
  }
}

function spawnFootCop(world, p) {
  const ang = Math.random() * Math.PI * 2;
  const d = 380 + Math.random() * 200;
  const cop = createPed(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, true);
  world.peds.push(cop);
}

export function damagePlayer(world, amount, source) {
  const p = world.player;
  if (!p.alive) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount * 0.7);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.health -= amount;
  p.hurtFlash = 1;
  world.shake(4 + amount * 0.3);
  world.effects.blood(p.x, p.y, Math.atan2(Math.random() - 0.5, Math.random() - 0.5));
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    playWasted();
    world.beginScreenFlash('wasted');
  }
}

function bustPlayer(world) {
  world.busted = true;
  playWasted();
  world.beginScreenFlash('busted');
}

// Called by the world after the wasted/busted fade: respawn + penalties.
export function resolveAfterDeath(world) {
  const p = world.player;
  const penalty = world.busted ? Math.min(500, Math.floor(world.money * 0.15)) : Math.min(300, Math.floor(world.money * 0.1));
  world.money = Math.max(0, world.money - penalty);
  world.notify(world.busted ? `BUSTED — bail: $${penalty}` : `WASTED — hospital bill: $${penalty}`);
  police.heat = 0;
  police.wanted = 0;
  police.bustedTimer = 0;
  // remove all police
  world.cars = world.cars.filter((c) => !c.police);
  for (const q of world.peds) if (q.cop) q.dead = true;
  p.alive = true;
  p.health = 100;
  p.armor = Math.max(0, Math.floor(p.armor * 0.5));
  p.inCar = null;
  // respawn at the hospital/police spot: Mission Row corner
  p.x = avX[1] + 80;
  p.y = avY[3] + 80;
  world.busted = false;
  world.failedMission();
}
