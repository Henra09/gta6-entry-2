// Staged screenshot scenes: with ?shot=<name> the REAL game is posed deterministically
// — positions, wanted level, mission state — so captured frames show the game at its
// most complete. Everything rendered is genuine gameplay rendering.

import { snapCamera, camera } from '../render/camera.js';
import { CITY, avX, avY, locations } from '../data/city-map.js';
import { createCar } from '../entities/vehicle.js';
import { createPed } from '../entities/pedestrian.js';
import { police } from '../systems/police.js';
import { missionState } from '../systems/missions.js';

export const SHOT_NAMES = ['cover', 'onfoot', 'mission', 'menu'];

export function applyShot(world, main, name) {
  const p = world.player;
  switch (name) {
    case 'cover': {
      // driving a stolen car down a sunlit boulevard, 3 stars, cops chasing behind
      p.x = avX[3] + 18;
      p.y = avY[4] - 200;
      const car = createCar(p.x, p.y, Math.PI / 2, 1, false);
      car.color = '#d84838';
      car.speed = 200;
      car.vx = 0; car.vy = 200;
      car.driver = 'player';
      car.missionTarget = true;
      world.cars.push(car);
      p.inCar = car;
      p.angle = car.angle;
      // police strung out behind, mid-chase (in frame, still approaching)
      for (let i = 0; i < 2; i++) {
        const cop = createCar(car.x - 60, car.y - 280 - i * 200, Math.PI / 2, 0, true);
        cop.speed = 130;
        cop.vx = 0; cop.vy = 130;
        cop.driver = 'cop';
        world.cars.push(cop);
        // hold them at distance for the staged frame
        cop.stagedHold = car.y - 240 - i * 190;
      }
      // staged shots pause police approach so the frame stays composed
      world.stagedChase = true;
      // civilian traffic flowing around the player
      for (let i = 0; i < 5; i++) {
        const c = createCar(avX[3] - 18, car.y - 160 + i * 150, -Math.PI / 2, i % 5, false);
        c.speed = 100; c.vx = 0; c.vy = -100;
        world.cars.push(c);
      }
      for (let i = 0; i < 3; i++) {
        const c = createCar(avX[3] + 90, car.y - 120 + i * 190, 0, (i + 2) % 5, false);
        c.x = avX[2] + 100 + i * 30;
        world.cars.push(c);
      }
      // pedestrians on the sidewalks beside the boulevard
      const sw = CITY.runW / 2 + CITY.sidewalk / 2;
      for (let i = 0; i < 7; i++) {
        const side = i % 2 === 0 ? -sw : sw;
        const ped = createPed(avX[3] + side + (i % 3 - 1) * 8, car.y - 200 + i * 90, false);
        world.peds.push(ped);
      }
      world.forceWanted(3);
      police.heat = 3; // exactly 3 stars for the staged frame
      snapCamera(car.x, car.y - 30, 0.92);
      // a mission objective in the HUD
      missionState.active = { id: 'cover', giver: 'ROSARIO', title: 'LOW TIDE, HIGH HOPES', steps: [] };
      missionState.marker = null;
      missionState.objective = 'Lose the heat and get the car to Rosario\'s dock';
      missionState.banner = 'LOW TIDE, HIGH HOPES';
      missionState.bannerUntil = world.time + 30;
      break;
    }
    case 'onfoot': {
      p.x = avX[2] + CITY.runW / 2 + CITY.sidewalk / 2;
      p.y = avY[3] + 170;
      p.currentWeapon = 'smg';
      world.weapons = ['fists', 'pistol', 'smg'];
      world.ammo.smg = 96;
      p.aimAngle = -0.5;
      p.angle = -0.5;
      // busy street: peds on both sidewalks, cars on the road
      const sw = CITY.runW / 2 + CITY.sidewalk / 2;
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -sw - 6 : sw + 6;
        world.peds.push(createPed(avX[2] + side + (i % 3 - 1) * 6, p.y - 160 + i * 62, false));
      }
      for (let i = 0; i < 4; i++) {
        const c = createCar(avX[2] - 18, p.y - 130 + i * 110, -Math.PI / 2, i % 5, false);
        c.speed = 60; c.vx = 0; c.vy = -60;
        world.cars.push(c);
      }
      const c2 = createCar(avX[2] + 18, p.y - 60, Math.PI / 2, 1, false);
      c2.speed = 80; c2.vx = 0; c2.vy = 80;
      world.cars.push(c2);
      snapCamera(p.x + 90, p.y - 30, 1.25);
      break;
    }
    case 'mission': {
      p.x = avX[0] + 120;
      p.y = avY[0] + 120;
      snapCamera(p.x + 40, p.y + 20, 1.05);
      missionState.active = { id: 'm0', giver: 'ROSARIO', title: 'LOW TIDE, HIGH HOPES', steps: [] };
      missionState.subtitle = { who: 'ROSARIO', text: 'You made it off the bus, kid. Sol Dorado eats people like you by sundown.', until: world.time + 60 };
      missionState.objective = 'Meet Rosario in Old Harbor';
      missionState.marker = { x: p.x + 130, y: p.y + 160 };
      missionState.banner = 'LOW TIDE, HIGH HOPES';
      missionState.bannerUntil = world.time + 30;
      break;
    }
    case 'menu': {
      main.setMenu('title');
      break;
    }
  }
  camera.viewW = main.canvas.width;
  camera.viewH = main.canvas.height;
}
