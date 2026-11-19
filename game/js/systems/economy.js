// The economy: gun shop, garage (buy cars, repairs, armor), pickups, side activities
// (delivery runs, timed races, rampages) and all money flow.

import { WEAPON_PRICES, WEAPONS, WEAPON_ORDER } from '../entities/player.js';
import { locations } from '../data/city-map.js';
import { dist } from '../core/util.js';
import { playPickup, playUiBlip } from '../audio/audio.js';

export const GARAGE_CARS = [
  { name: 'Costa GT', type: 1, price: 2500 },
  { name: 'Marina Sport', type: 4, price: 6000 },
  { name: 'Palma Cruiser', type: 2, price: 1500 },
];

// Shop UI state machine: null | 'shop' | 'garage', plus selection index.
export const shopState = {
  open: null,
  index: 0,
};

export function nearShop(world) {
  const p = world.player;
  if (dist(p.x, p.y, locations.gunShop.x, locations.gunShop.y) < 34) return 'shop';
  if (dist(p.x, p.y, locations.garage.x, locations.garage.y) < 34) return 'garage';
  return null;
}

export function shopOpen() { return shopState.open; }
export function openShop(kind) { shopState.open = kind; shopState.index = 0; playUiBlip(true); }
export function closeShop() { shopState.open = null; }
export function shopMove(dir) {
  const items = shopState.open === 'shop' ? shopItems : GARAGE_CARS;
  shopState.index = (shopState.index + dir + items.length) % items.length;
  playUiBlip(false);
}
export function shopIndex() { return shopState.index; }

export const shopItems = [
  { kind: 'weapon', id: 'smg', label: 'SMG — $900', price: 900 },
  { kind: 'weapon', id: 'shotgun', label: 'SHOTGUN — $1400', price: 1400 },
  { kind: 'weapon', id: 'rifle', label: 'RIFLE — $2600', price: 2600 },
  { kind: 'ammo', id: 'pistol', label: 'PISTOL AMMO +60 — $120', price: 120 },
  { kind: 'ammo', id: 'smg', label: 'SMG AMMO +90 — $200', price: 200 },
  { kind: 'ammo', id: 'shotgun', label: 'SHELLS +24 — $260', price: 260 },
  { kind: 'ammo', id: 'rifle', label: 'RIFLE AMMO +40 — $320', price: 320 },
  { kind: 'armor', label: 'BODY ARMOR — $400', price: 400 },
  { kind: 'health', label: 'FIELD MEDKIT — $150', price: 150 },
];

export function buyCurrent(world) {
  const item = shopState.open === 'shop' ? shopItems[shopState.index] : GARAGE_CARS[shopState.index];
  if (!item) return 'NOTHING TO BUY';
  if (world.money < item.price) return 'NOT ENOUGH CASH';
  if (shopState.open === 'shop') {
    if (item.kind === 'weapon') {
      if (world.weapons.includes(item.id)) return 'ALREADY OWNED';
      world.weapons.push(item.id);
      world.ammo[item.id] = (world.ammo[item.id] ?? 0) + 60;
      world.currentWeapon = item.id;
    } else if (item.kind === 'ammo') {
      world.ammo[item.id] = (world.ammo[item.id] ?? 0) + (item.id === 'pistol' ? 60 : item.id === 'smg' ? 90 : item.id === 'shotgun' ? 24 : 40);
    } else if (item.kind === 'armor') {
      if (world.player.armor >= 100) return 'ARMOR FULL';
      world.player.armor = 100;
    } else if (item.kind === 'health') {
      if (world.player.health >= 100) return 'HEALTH FULL';
      world.player.health = Math.min(100, world.player.health + 50);
    }
  } else {
    // garage: spawn the car next to the garage
    const car = createGarageCar(item.type, world);
    world.garageCar = car;
  }
  world.money -= item.price;
  world.saveDirty = true;
  playPickup();
  return 'SOLD — THANKS';
}

import { createCar } from '../entities/vehicle.js';
function createGarageCar(type, world) {
  const car = createCar(locations.garage.x + 60, locations.garage.y + 60, Math.PI / 2, type, false);
  world.cars.push(car);
  return car;
}

// ---------- side activities ----------

export const activity = {
  kind: null,        // 'race' | 'delivery' | 'rampage'
  timer: 0,
  target: null,
  progress: 0,
  goal: 0,
  text: '',
  reward: 0,
  cooldown: 0,
};

export function availableActivity(world) {
  if (activity.kind || activity.cooldown > 0) return null;
  const p = world.player;
  // race start
  if (dist(p.x, p.y, locations.raceStart.x, locations.raceStart.y) < 40 && p.inCar) {
    return { kind: 'race', label: 'STREET RACE — press E to start' };
  }
  for (const r of locations.rampages) {
    if (dist(p.x, p.y, r.x, r.y) < 30) {
      return { kind: 'rampage', label: 'RAMPAGE — press E to start' };
    }
  }
  return null;
}

export function startActivity(world, kind) {
  const p = world.player;
  if (kind === 'race') {
    activity.kind = 'race';
    activity.goal = locations.deliverySpots.length;
    activity.progress = 0;
    activity.timer = 75;
    activity.reward = 900;
    activity.target = locations.deliverySpots[0];
    activity.text = 'STREET RACE — hit the checkpoints';
  } else if (kind === 'rampage') {
    activity.kind = 'rampage';
    activity.goal = 8;
    activity.progress = 0;
    activity.timer = 45;
    activity.reward = 650;
    activity.text = 'RAMPAGE — take out 8 targets before time runs out';
  }
  playUiBlip(true);
}

export function updateActivities(world, dt) {
  if (activity.cooldown > 0) activity.cooldown -= dt;
  if (!activity.kind) return;
  activity.timer -= dt;
  const p = world.player;
  if (activity.timer <= 0) {
    endActivity(world, false);
    return;
  }
  if (activity.kind === 'race') {
    if (activity.target && dist(p.x, p.y, activity.target.x, activity.target.y) < 60) {
      activity.progress++;
      playPickup();
      world.notify(`Checkpoint ${activity.progress}/${activity.goal}`);
      if (activity.progress >= activity.goal) { endActivity(world, true); return; }
      activity.target = locations.deliverySpots[activity.progress % locations.deliverySpots.length];
    }
  } else if (activity.kind === 'rampage') {
    if (world.stats.kills > activity._kills ?? 0) {
      // tracked via world side-effect below
    }
    if (world.rampageKills >= activity.goal) endActivity(world, true);
  }
}

export function endActivity(world, success) {
  if (success) {
    world.money += activity.reward;
    world.notify(`ACTIVITY COMPLETE — $${activity.reward}`);
    playPickup();
    world.saveDirty = true;
  } else {
    world.notify('ACTIVITY FAILED');
    playUiBlip(false);
  }
  activity.kind = null;
  activity.target = null;
  activity.cooldown = 8;
}

export function activityMarker() {
  return activity.kind ? activity.target : null;
}
