// Mission runner: advances the active mission's step machine, spawns mission actors,
// tracks objectives, pays rewards, and handles failure (death/busted or target lost).

import { MISSIONS } from '../data/missions.js';
import { locations, avX, avY } from '../data/city-map.js';
import { createCar } from '../entities/vehicle.js';
import { createPed } from '../entities/pedestrian.js';
import { dist } from '../core/util.js';
import { reportCrime } from './police.js';
import { playPickup } from '../audio/audio.js';

export const missionState = {
  active: null,        // the MISSIONS entry
  stepIndex: 0,
  timer: 0,
  delivered: 0,
  surviveLeft: 0,
  marker: null,
  objective: '',
  subtitle: null,      // {who, text, until}
  dialogueQueue: null,
  complete: [],
  banner: null, bannerUntil: 0,
};

export function resetMissions() {
  missionState.active = null;
  missionState.stepIndex = 0;
  missionState.marker = null;
  missionState.objective = '';
  missionState.subtitle = null;
  missionState.dialogueQueue = null;
  missionState.delivered = 0;
  missionState.complete = [];
  missionState.banner = null;
  missionState.bannerUntil = 0;
  missionState.deliveryDrops = null;
  missionState.surviveLeft = 0;
}

export function nextMissionFor(state) {
  const done = new Set(state.completed);
  for (const m of MISSIONS) {
    if (!done.has(m.id)) {
      // find its giver spot
      const giver = locations.missionGivers.find((g) => g.name === m.giver);
      return { mission: m, giver };
    }
  }
  return null;
}

export function startMission(world, mission) {
  missionState.active = mission;
  missionState.stepIndex = 0;
  missionState.delivered = 0;
  missionState.banner = mission.title;
  missionState.bannerUntil = world.time + 3.5;
  beginStep(world, mission, 0);
}

function say(world, lines) {
  missionState.dialogueQueue = lines.slice();
  showNextSubtitle(world);
}

function showNextSubtitle(world) {
  const q = missionState.dialogueQueue;
  if (!q || q.length === 0) { missionState.dialogueQueue = null; missionState.subtitle = null; return; }
  const [who, text] = q.shift();
  missionState.subtitle = { who, text, until: world.time + Math.max(3, text.length * 0.055) };
}

function beginStep(world, mission, idx) {
  missionState.stepIndex = idx;
  const step = mission.steps[idx];
  missionState.marker = null;
  missionState.objective = '';
  if (!step) return finishMission(world, mission);

  switch (step.type) {
    case 'goto':
      missionState.marker = step.marker;
      missionState.objective = step.text;
      break;
    case 'goto-drive':
      missionState.marker = step.marker;
      missionState.objective = step.text + ' (use a car)';
      if (step.giveCar && !world.player.inCar) {
        const car = createCar(step.giveCar.x, step.giveCar.y, Math.PI / 2, 1, false);
        world.cars.push(car);
        missionState.marker = step.marker;
      }
      break;
    case 'dialog':
      missionState.objective = 'Listen...';
      say(world, step.lines);
      break;
    case 'steal-target':
      missionState.objective = step.text;
      missionState.marker = step.marker;
      if (step.spawn) {
        const car = createCar(step.spawn.x, step.spawn.y, Math.PI / 2, step.spawn.type ?? 0, false);
        if (step.spawn.color) car.color = step.spawn.color;
        car.missionTarget = true;
        world.cars.push(car);
        // guards around the target car
        for (let i = 0; i < 2; i++) {
          const g = createPed(step.spawn.x + (i ? 40 : -40), step.spawn.y + 30, false);
          g.shirt = '#5a2a4a';
          g.missionGuard = true;
          world.peds.push(g);
        }
      }
      break;
    case 'survive':
      missionState.surviveLeft = step.seconds;
      missionState.objective = step.text;
      if (step.marker) missionState.marker = step.marker;
      if (step.wanted) {
        // raise heat to at least step.wanted
        while (missionState ? false : false) { /* noop */ }
        world.forceWanted(step.wanted);
      }
      break;
    case 'delivery':
      missionState.objective = step.text.replace('(0/3)', '(0/3)');
      missionState.deliveryDrops = step.drops.map((d) => ({ ...d, done: false }));
      missionState.marker = missionState.deliveryDrops[0];
      if (step.giveCar && !world.player.inCar) {
        const car = createCar(step.giveCar.x, step.giveCar.y, 0, 3, false);
        world.cars.push(car);
      }
      break;
    case 'reward':
      break;
  }
}

export function updateMission(world, dt) {
  const ms = missionState;
  // subtitle expiry
  if (ms.subtitle && world.time > ms.subtitle.until) showNextSubtitle(world);

  if (!ms.active) return;
  const step = ms.active.steps[ms.stepIndex];
  if (!step) return;
  const p = world.player;

  switch (step.type) {
    case 'dialog':
      if (!ms.dialogueQueue) beginStep(world, ms.active, ms.stepIndex + 1);
      break;
    case 'goto':
      if (dist(p.x, p.y, step.marker.x, step.marker.y) < step.radius) nextStep(world);
      break;
    case 'goto-drive': {
      const inCar = !!p.inCar;
      if (inCar && dist(p.x, p.y, step.marker.x, step.marker.y) < step.radius) nextStep(world);
      break;
    }
    case 'steal-target':
      if (p.inCar && p.inCar.missionTarget) {
        nextStep(world);
      }
      break;
    case 'survive':
      ms.surviveLeft -= dt;
      ms.objective = `${step.text} — ${Math.ceil(ms.surviveLeft)}s`;
      if (ms.surviveLeft <= 0) nextStep(world);
      break;
    case 'delivery': {
      const remaining = ms.deliveryDrops.filter((d) => !d.done);
      ms.objective = `Deliver the bags (${ms.delivered}/3)`;
      if (remaining.length) {
        const d0 = remaining[0];
        ms.marker = d0;
        if (dist(p.x, p.y, d0.x, d0.y) < 46) {
          d0.done = true;
          ms.delivered++;
          playPickup();
          world.notify('Bag delivered');
        }
      } else {
        nextStep(world);
      }
      break;
    }
    case 'reward':
      nextStep(world);
      break;
  }

  // special: surviving steps tick a threat so cops stay aggressive
  if (step.type === 'survive') {
    world.threatPoint = { x: p.x, y: p.y };
    world.threatTimer = 2;
  }
}

function nextStep(world) {
  beginStep(world, missionState.active, missionState.stepIndex + 1);
}

function finishMission(world, mission) {
  const step = mission.steps[mission.steps.length - 1];
  const pay = step?.money ?? 300;
  world.money += pay;
  world.stats.missionsDone++;
  world.stats.earned += pay;
  world.completed.push(mission.id);
  missionState.active = null;
  missionState.marker = null;
  missionState.objective = '';
  missionState.banner = `MISSION PASSED — $${pay}`;
  missionState.bannerUntil = world.time + 4;
  playPickup();
  world.saveDirty = true;
}

export function failedMission() {
  if (!missionState.active) return;
  missionState.banner = `MISSION FAILED — ${missionState.active.title}`;
  missionState.bannerUntil = performance.now() / 1000 + 4;
  missionState.active = null;
  missionState.marker = null;
  missionState.objective = '';
  missionState.subtitle = null;
  missionState.dialogueQueue = null;
}

// The pulsing marker the player can walk into to start their next mission.
export function currentGiverMarker(state) {
  const next = nextMissionFor(state);
  return next ? { x: next.giver.x, y: next.giver.y, name: next.mission.giver } : null;
}
