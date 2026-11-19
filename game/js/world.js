// The world: it owns every entity list, drives all system updates, applies input,
// resolves interactions (enter/exit cars, pickups, shops, activities, mission givers),
// and decides the camera. One `update(dt)` per fixed step; the loop calls it.

import { clamp, dist, randRange } from './core/util.js';
import { CITY, avX, avY, WORLD_W, WORLD_H, SEA_X, BEACH_X, locations } from './data/city-map.js';
import { buildCity } from './render/city-canvas.js';
import { createEffects } from './render/particles.js';
import { camera, followCamera, snapCamera, addShake, applyCamera, worldToScreen } from './render/camera.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerInCar, exitCarPosition, WEAPONS, WEAPON_ORDER, drawPlayer, drawAimReticle, playerSpeed } from './entities/player.js';
import { createCar, updateCarPhysics, updateTrafficCar, separateCars, drawCar, angleToDir } from './entities/vehicle.js';
import { createPed, updatePed, drawPed, panicNearby } from './entities/pedestrian.js';
import { police, reportCrime, updatePolice, resolveAfterDeath, damagePlayer } from './systems/police.js';
import { tryPlayerShoot } from './systems/combat.js';
import { missionState, updateMission, startMission, nextMissionFor } from './systems/missions.js';
import { nearShop, openShop, shopOpen, closeShop, availableActivity, startActivity, updateActivities, activityMarker, activity } from './systems/economy.js';
import { saveGame } from './core/save.js';
import { drawHUD } from './ui/hud.js';
import { updateEngine, updateSiren, radioTick, RADIO_STATIONS, setRadioStation, playDoor, playImpact, playGunshot, resumeAudio } from './audio/audio.js';

const TRAFFIC_COUNT = 26;
const PED_COUNT = 42;

export function createWorld(seed) {
  const city = buildCity();
  const pad = city.pad;

  const world = {
    seed,
    cityCanvas: city.canvas,
    cityPad: city.pad,
    worldW: WORLD_W,
    worldH: WORLD_H,
    time: 0,
    input: null,
    player: null,
    cars: [],
    peds: [],
    pickups: [],
    solids: [],          // building footprints for collision + bullets
    effects: createEffects(),
    money: 350,
    weapons: ['fists', 'pistol'],
    ammo: { pistol: 60 },
    currentWeapon: 'pistol',
    armor: 0,
    missionIndex: 0,
    completed: [],
    stats: { kills: 0, stolen: 0, earned: 0, missionsDone: 0 },
    notifications: [],
    hint: '',
    shopPrompt: '',
    nextGiver: null,
    missionMarker: null,
    nextObjective: 'Find the green marker — meet your contact',
    busted: false,
    screenFlash: null,
    saveDirty: false,
    threatPoint: null,
    threatTimer: 0,
    radioStation: 0,
    rampageKills: 0,
    radio: { name: RADIO_STATIONS[0].name },

    // callbacks set by main.js
    shake: addShake,
    notify(text) { world.notifications.push({ text, t: world.time }); },
    beginScreenFlash(kind) {
      world.screenFlash = { kind, t0: world.time };
      setTimeout(() => {
        resolveAfterDeath(world);
        world.screenFlash = null;
      }, 2200);
    },
    explodeCar(car) {
      car.dead = true;
      car.burning = true;
      world.effects.explosion(car.x, car.y);
      addShake(14);
      playImpact(1);
      const d = dist(car.x, car.y, world.player.x, world.player.y);
      if (d < 90) damagePlayer(world, (90 - d) * 0.5, 'explosion');
      panicNearby(world, car.x, car.y, 300);
      if (world.player.inCar === car) {
        world.exitCar();
        damagePlayer(world, 45, 'explosion');
      }
      reportCrime(world, 'vehicleHit', car.x, car.y);
    },
    forceWanted(stars) {
      police.heat = Math.max(police.heat, stars);
      police.wanted = Math.ceil(police.heat);
    },
    exitCar() {
      const p = world.player;
      if (!p.inCar || p.exitCooldown > 0) return;
      const car = p.inCar;
      const pos = exitCarPosition(car);
      p.x = pos.x; p.y = pos.y;
      p.inCar = null;
      p.exitCooldown = 0.4;
      updateEngine(0, false);
      radioTick(false);
    },
    failedMission() {
      import('./systems/missions.js').then((m) => m.failedMission());
    },
  };

  // ---- player ----
  world.player = createPlayer(avX[1] + 60, avY[1] + 90);

  // ---- solids: building footprints approximated per block (2x2 grid inside each block) ----
  for (let i = 0; i < CITY.gridN - 1; i++) {
    for (let j = 0; j < CITY.gridM - 1; j++) {
      const key = i + ',' + j;
      if (key === '2,0' || key === '4,1' || key === '3,3' || key === '0,5') continue; // open frontage spots
      const x0 = avX[i] + CITY.runW / 2 + 34;
      const y0 = avY[j] + CITY.runW / 2 + 34;
      const w = avX[i + 1] - avX[i] - CITY.runW - 68;
      const h = avY[j + 1] - avY[j] - CITY.runW - 68;
      if (key === '5,2') continue; // plaza
      // four quadrant solids with gaps
      world.solids.push({ x: x0, y: y0, w: w / 2 - 8, h: h / 2 - 8 });
      world.solids.push({ x: x0 + w / 2 + 8, y: y0, w: w / 2 - 8, h: h / 2 - 8 });
      world.solids.push({ x: x0, y: y0 + h / 2 + 8, w: w / 2 - 8, h: h / 2 - 8 });
      world.solids.push({ x: x0 + w / 2 + 8, y: y0 + h / 2 + 8, w: w / 2 - 8, h: h / 2 - 8 });
    }
  }

  // ---- traffic ----
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    spawnTraffic(world, true);
  }
  // ---- pedestrians on sidewalks ----
  for (let i = 0; i < PED_COUNT; i++) {
    spawnPed(world);
  }
  // ---- a parked car near the player for the opening ----
  const opener = createCar(world.player.x + 70, world.player.y + 30, 0, 1, false);
  opener.speed = 0; opener.vx = 0; opener.vy = 0;
  world.cars.push(opener);

  world.nextGiver = (nextMissionFor(world) || {}).giver;
  return world;
}

// ---------- spawning ----------

function spawnTraffic(world, anywhere) {
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * avX.length);
    const j = Math.floor(Math.random() * avY.length);
    const horiz = Math.random() < 0.5;
    const x = horiz ? randRange(Math.random, avX[0], avX[avX.length - 1]) : avX[i] + 18;
    const y = horiz ? avY[j] + 18 : randRange(Math.random, avY[0], avY[avY.length - 1]);
    const angle = horiz ? 0 : Math.PI / 2;
    const car = createCar(x, y, angle, Math.floor(Math.random() * 5), false);
    if (horiz) car.y = avY[j] - 18; else car.x = avX[i] + 18;
    if (Math.random() < 0.5) {
      car.dir = (car.dir + 2) % 4;
      car.angle = car.dir * Math.PI / 2;
    }
    if (!anywhere && dist(car.x, car.y, world.player.x, world.player.y) < 600) continue;
    world.cars.push(car);
    return car;
  }
};

function spawnPed(world) {
  for (let tries = 0; tries < 20; tries++) {
    const ax = avX[Math.floor(Math.random() * avX.length)];
    const ay = avY[Math.floor(Math.random() * avY.length)];
    const sw = CITY.runW / 2 + CITY.sidewalk / 2;
    const x = ax + sw * (Math.random() < 0.5 ? 1 : -1);
    const y = ay + randRange(Math.random, -200, 200);
    if (dist(x, y, world.player.x, world.player.y) < 260) continue;
    world.peds.push(createPed(x, y, false));
    return;
  }
}

// ---------- the update ----------

export function updateWorld(world, dt) {
  const this_ = world;
  const p = world.player;
    const inp = world.input;
    if (!inp) { world.time += dt; return; }
    world.time += dt;
  if (world.threatTimer > 0) world.threatTimer -= dt; else world.threatPoint = null;

  // prune old notifications
  world.notifications = world.notifications.filter((n) => world.time - n.t < 3.2);

  // ---- aim angle from mouse ----
  if (!p.inCar && p.alive && inp) {
    const wpt = worldToScreen(0, 0);
    const m = inp.rawMouseWorld();
    p.aimAngle = Math.atan2(m.y - p.y, m.x - p.x);
  }

  // ---- player ----
  p.currentWeapon = world.currentWeapon;
  p.armor = world.armor;
  if (p.inCar) {
    updatePlayerInCar(p, p.inCar, dt);
    const car = p.inCar;
    const throttle = inp.up ? 1 : inp.down ? -1 : 0;
    const steer = (inp.right ? 1 : 0) + (inp.left ? -1 : 0);
    const drift = updateCarPhysics(car, dt, throttle, steer, inp.brake, world);
    // skid marks while drifting or braking hard
    if (drift || (inp.brake && Math.abs(car.speed) > 150)) {
      const bx = car.x - Math.cos(car.angle) * car.type.w / 2;
      const by = car.y - Math.sin(car.angle) * car.type.h / 2;
      world.effects.skid(bx - Math.sin(car.angle) * 7, by + Math.cos(car.angle) * 7, bx - Math.sin(car.angle) * 7 + car.vx * 0.05, by + Math.cos(car.angle) * 7 + car.vy * 0.05);
      world.effects.skid(bx + Math.sin(car.angle) * 7, by - Math.cos(car.angle) * 7, bx + Math.sin(car.angle) * 7 + car.vx * 0.05, by - Math.cos(car.angle) * 7 + car.vy * 0.05);
    }
    // damage from wrecks (separation step below reports impacts)
    updateEngine(clamp(Math.abs(car.speed) / car.type.maxSpeed, 0, 1), true);
    radioTick(true);
    // running people over
    for (const q of world.peds) {
      if (q.dead) continue;
      if (dist(q.x, q.y, car.x, car.y) < car.type.w / 2 + 6 && Math.abs(car.speed) > 60) {
        q.dead = true;
        world.stats.kills++;
        world.effects.blood(q.x, q.y, car.angle);
        playImpact(0.6);
        reportCrime(world, 'pedKill', q.x, q.y);
      }
    }
  } else {
    updatePlayerOnFoot(p, dt, inp, world);
  }

  // shooting
  if (tryPlayerShoot(world, dt)) { /* hud dirty implicit */ }

  // ---- traffic ----
  for (const car of world.cars) {
    if (car.dead || car === p.inCar || car.police) continue;
    if (car.driver === 'npc') {
      updateTrafficCar(car, dt, world);
      // flee behavior when panicked
      if (car.fleeTimer > 0) {
        car.fleeTimer -= dt;
        car.targetSpeed = 240;
      }
    }
  }
  // car-car separation (skip pairs both dead)
  for (let i = 0; i < world.cars.length; i++) {
    for (let j = i + 1; j < world.cars.length; j++) {
      const a = world.cars[i], b = world.cars[j];
      if (a.dead || b.dead) continue;
      const near = dist(a.x, a.y, b.x, b.y) < 60;
      if (!near) continue;
      const impact = separateCars(a, b);
      if (impact > 4) {
        playImpact(clamp(impact / 20, 0.2, 1));
        world.effects.spark((a.x + b.x) / 2, (a.y + b.y) / 2);
        if ((a === p.inCar || b === p.inCar)) {
          addShake(6);
          const other = a === p.inCar ? b : a;
          if (other.police) reportCrime(world, 'copHit', other.x, other.y);
          if (impact > 10) other.fleeTimer = 4;
        }
      }
    }
  }
  // burning wrecks smoke
  for (const car of world.cars) {
    if (car.dead && Math.random() < dt * 8) world.effects.smoke(car.x, car.y - 6, true);
    if (!car.dead && car.health < 40 && Math.random() < dt * 4) world.effects.smoke(car.x + Math.cos(car.angle) * 14, car.y + Math.sin(car.angle) * 14, false);
  }
  // recycle far traffic
  if (world.cars.filter((c) => !c.police && !c.dead).length < TRAFFIC_COUNT && Math.random() < dt * 2) {
    spawnTraffic(world, false);
  }
  world.cars = world.cars.filter((c) => !(c.dead && world.time % 1 < 0.5) ? true : dist(c.x, c.y, p.x, p.y) < 1500);

  // ---- pedestrians ----
  for (const q of world.peds) {
    if (q.cop) continue; // police system updates foot cops
    updatePed(q, dt, world);
  }
  // recycle far peds
  let alivePeds = 0;
  for (const q of world.peds) if (!q.dead) alivePeds++;
  if (alivePeds < PED_COUNT && Math.random() < dt * 3) spawnPed(world);
  world.peds = world.peds.filter((q) => !q.dead || dist(q.x, q.y, p.x, p.y) < 900);

  // ---- police & crime ----
  updatePolice(world, dt, world.effects);

  // ---- missions ----
  updateMission(world, dt);
  world.missionMarker = missionState.marker;
  world.nextGiver = missionState.active ? null : (nextMissionFor(world) || {}).giver;
  if (!missionState.active && !missionState.marker) {
    world.nextObjective = world.nextGiver ? `Meet ${world.nextGiver.name} at the green marker` : '';
  }

  // ---- interactions ----
  updateInteractions(world, dt);;

  // ---- activities ----
  updateActivities(world, dt);

  // ---- pickups ----
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const pk = world.pickups[i];
    pk.bob += dt;
    if (!p.inCar && dist(pk.x, pk.y, p.x, p.y) < 22) {
      world.money += pk.amount;
      world.stats.earned += pk.amount;
      playPickupSound();
      world.pickups.splice(i, 1);
    }
  }

  // ---- effects ----
  world.effects.update(dt, world);

  // ---- siren audio: any cop near ----
  let sirenNear = false;
  for (const c of world.cars) {
    if (c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 600) { sirenNear = true; break; }
  }
  updateSiren(police.wanted > 0 && sirenNear);

  // ---- camera ----
  const camTarget = p.inCar ? p.inCar : p;
  followCamera(camTarget.x, camTarget.y, camTarget.vx ?? 0, camTarget.vy ?? 0, dt, p.inCar ? 0.94 : 1.06);

  // ---- save on dirty ----
  if (world.saveDirty) {
    world.saveDirty = false;
    saveGame(world);
  }
};

function playPickupSound() {
  // small local wrapper to avoid circular import cost
  import('../audio/audio.js').then((a) => a.playPickup());
}

// ---------- interactions: cars, shops, mission givers, activities ----------

function updateInteractions(world, dt) {
  const p = world.player;
  const inp = world.input;
  world.hint = '';
  world.shopPrompt = '';

  // shops
  const shop = shopOpen();
  if (shop) {
    if (inp.interact) inp.interact = false;
    return;
  } else {
    let usedInteract = false;
    // enter / exit car
    if (inp.interact) {
      inp.interact = false;
      usedInteract = true;
      if (p.inCar) {
        world.exitCar();
        playDoor();
      } else {
        // nearest door-able car
        let best = null, bd = 46;
        for (const c of world.cars) {
          if (c.dead) continue;
          const d = dist(c.x, c.y, p.x, p.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) {
          const wasNpc = best.driver === 'npc';
          p.inCar = best;
          best.driver = 'player';
          p.exitCooldown = 0.4;
          playDoor();
          if (wasNpc) {
            world.stats.stolen++;
            reportCrime(world, 'carJack', best.x, best.y);
            world.notify('Vehicle stolen');
            const runner = createPed(best.x + 24, best.y + 24, false);
            runner.panicTimer = 5;
            world.peds.push(runner);
          }
          setRadioStation(RADIO_STATIONS[world.radioStation].rootHz);
        }
      }
    }

    const near = nearShop(world);
    if (near && !p.inCar) {
      world.shopPrompt = near === 'shop' ? 'OSO ARMERÍA — press E to browse weapons' : 'TALLER COSTA — press E to browse cars';
      if (usedInteract) openShop(near);
    }

    // mission giver
    if (!missionState.active && world.nextGiver) {
      const g = world.nextGiver;
      if (dist(p.x, p.y, g.x, g.y) < 40 && !p.inCar) {
        world.hint = `Press E — talk to ${g.name}`;
        if (usedInteract) {
          const next = nextMissionFor(world);
          if (next) startMission(world, next.mission);
        }
      }
    }

    // activities
    const act = availableActivity(world);
    if (act) {
      world.hint = act.label;
      if (usedInteract) startActivity(world, act.kind);
    }
  }
}

// ---------- drawing the world ----------

export function drawWorld(this_, ctx, w, h) {
  ctx.save();
  ctx.fillStyle = '#1a2a30';
  ctx.fillRect(0, 0, w, h);
  applyCamera(ctx);

  const p = this_.player;
  const pad = this_.cityPad;
  // static city
  ctx.drawImage(this_.cityCanvas, -pad, -pad);

  // pickups
  for (const pk of this_.pickups) {
    const bob = Math.sin(pk.bob * 4) * 3;
    ctx.fillStyle = '#3a8a3a';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8e8a8';
    ctx.font = '700 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + bob + 4);
  }

  this_.effects.draw(ctx);

  // cars (dead first so live cars draw on top)
  for (const c of this_.cars) if (c.dead) drawCar(ctx, c, this_.time);
  for (const c of this_.cars) if (!c.dead && c !== p.inCar) drawCar(ctx, c, this_.time);

  // peds
  for (const q of this_.peds) drawPed(ctx, q);

  // player on foot
  const aiming = !p.inCar && p.currentWeapon !== 'fists';
  drawPlayer(ctx, p, aiming);

  ctx.restore();

  // aim reticle drawn in world coords but we already restored; redo with camera
  if (aiming && !p.inCar && WEAPONS[p.currentWeapon]) {
    ctx.save();
    applyCamera(ctx);
    drawAimReticle(ctx, p, this_, WEAPONS[p.currentWeapon] ?? WEAPONS.fists);
    ctx.restore();
  }

  // mission marker (world space, pulsing column)
  const mk = this_.missionMarker || this_.nextGiver;
  if (mk) {
    ctx.save();
    applyCamera(ctx);
    const pulse = 0.5 + 0.5 * Math.sin(this_.time * 4);
    ctx.fillStyle = mk === this_.missionMarker ? `rgba(255,210,58,${0.25 + pulse * 0.3})` : `rgba(122,224,122,${0.25 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(mk.x, mk.y, 22 + pulse * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mk === this_.missionMarker ? '#ffd23a' : '#7ae07a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // floating triangle
    const fy = mk.y - 40 - pulse * 8;
    ctx.beginPath();
    ctx.moveTo(mk.x, fy + 14);
    ctx.lineTo(mk.x - 10, fy);
    ctx.lineTo(mk.x + 10, fy);
    ctx.closePath();
    ctx.fillStyle = mk === this_.missionMarker ? '#ffd23a' : '#7ae07a';
    ctx.fill();
    if (mk.name) {
      ctx.font = '700 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0ead8';
      ctx.fillText(mk.name, mk.x, fy - 8);
    }
    ctx.restore();
  }
};
