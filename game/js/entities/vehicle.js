// Vehicles: physics (acceleration, braking, steering, drift), damage, traffic AI,
// police chase AI, and top-down drawing with headlights, brake lights and damage smoke.

import { clamp, angleLerp, angleDiff, randRange, dist } from '../core/util.js';
import { CITY, avX, avY, DIRV, SEA_X, WORLD_W, WORLD_H, BEACH_X } from '../data/city-map.js';

const CAR_TYPES = [
  { name: 'Compacta', w: 34, h: 18, maxSpeed: 260, accel: 190, colors: ['#c84a32', '#3a7ab8', '#d8b03a', '#5aa06a', '#c8c4bc', '#8a5a9a', '#3a3a42'] },
  { name: 'Costa GT', w: 40, h: 19, maxSpeed: 330, accel: 240, colors: ['#d84838', '#e8e2d0', '#28405a', '#d8a832'] },
  { name: 'Palma Cruiser', w: 44, h: 20, maxSpeed: 230, accel: 150, colors: ['#7a9ac8', '#c8b890', '#6a4a3a'] },
  { name: 'Vecino Van', w: 46, h: 22, maxSpeed: 200, accel: 120, colors: ['#d0c8b8', '#8aa0b8', '#b8a03a'] },
  { name: 'Marina Sport', w: 42, h: 18, maxSpeed: 360, accel: 280, colors: ['#e8e2d0', '#c83428', '#205a6e'] },
];
const POLICE_TYPE = { name: 'Patrulla', w: 42, h: 19, maxSpeed: 340, accel: 250, colors: ['#e8e8ea'] };

export function createCar(x, y, angle, typeIndex, police) {
  const type = police ? POLICE_TYPE : CAR_TYPES[typeIndex % CAR_TYPES.length];
  return {
    x, y,
    angle,
    vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
    speed: 40,
    type,
    color: police ? '#e8e8ea' : type.colors[Math.floor(Math.random() * type.colors.length)],
    police: !!police,
    siren: false,
    // traffic AI state
    dir: angleToDir(angle),
    targetSpeed: randRange(Math.random, 90, 150),
    stopped: false,
    stopTimer: 0,
    // shared
    health: 100,
    maxHealth: 100,
    burning: false,
    dead: false,
    wheelAngle: 0,
    skidTimer: 0,
    driver: police ? 'cop' : 'npc',
    fleeTimer: 0,
    honkTimer: 0,
  };
}

export function angleToDir(angle) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= Math.PI * 7 / 4) return 0;
  if (a < Math.PI * 3 / 4) return 1;
  if (a < Math.PI * 5 / 4) return 2;
  return 3;
}

export function updateCarPhysics(car, dt, throttle, steer, brake, world) {
  const t = car.type;
  if (brake) {
    car.speed -= 420 * dt;
  } else if (throttle > 0) {
    car.speed += t.accel * throttle * dt;
  } else if (throttle < 0) {
    car.speed -= t.accel * 0.7 * dt;
  } else {
    car.speed -= car.speed * 0.6 * dt; // engine drag
  }
  // friction cap
  car.speed = clamp(car.speed, -t.maxSpeed * 0.4, t.maxSpeed);
  if (car.health < 35) car.speed = clamp(car.speed, -80, t.maxSpeed * 0.55); // damaged

  // steering scales down at low speed, sharper at high speed for drift feel
  const steerPower = 2.6 * clamp(Math.abs(car.speed) / 120, 0.15, 1);
  car.wheelAngle = angleLerp(car.wheelAngle, steer * 0.55, 1 - Math.exp(-10 * dt));
  const drift = Math.abs(car.speed) > t.maxSpeed * 0.6 && Math.abs(steer) > 0.5 && brake;
  car.angle += car.wheelAngle * steerPower * dt * Math.sign(car.speed || 1);

  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // bounce off world edges and sea
  if (car.x < 30) { car.x = 30; car.speed *= -0.3; }
  if (car.x > WORLD_W - 30) { car.x = WORLD_W - 30; car.speed *= -0.3; }
  if (car.y < 30) { car.y = 30; car.speed *= -0.3; }
  if (car.y > WORLD_H - 30) { car.y = WORLD_H - 30; car.speed *= -0.3; }
  if (car.x > SEA_X - 8) { car.x = SEA_X - 8; car.speed *= -0.4; }

  collideSolids(car, world.solids ? world : { solids: [] });
  return drift;
}

function collideSolids(car, world) {
  // Car vs building rects: slide along and absorb speed.
  for (const r of world.solids) {
    const cx = clamp(car.x, r.x, r.x + r.w);
    const cy = clamp(car.y, r.y, r.y + r.h);
    const dx = car.x - cx, dy = car.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < 22 * 22) {
      const d = Math.sqrt(d2) || 1;
      const push = 22 - d;
      car.x += (dx / d) * push;
      car.y += (dy / d) * push;
      car.speed *= 0.55;
      car.health -= Math.abs(car.speed) * 0.03;
      return Math.abs(car.speed) * 0.03;
    }
  }
  return 0;
}

// Car-vs-car separation: returns impact strength for effects.
export function separateCars(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const minD = (a.type.w + b.type.w) * 0.42;
  const d = Math.hypot(dx, dy);
  if (d < minD && d > 0.01) {
    const push = (minD - d) / 2;
    const nx = dx / d, ny = dy / d;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const impact = Math.abs(a.speed - b.speed) + Math.abs(a.speed + b.speed) * 0.2;
    if (impact > 60) {
      a.speed *= 0.5; b.speed *= 0.5;
      a.health -= impact * 0.04;
      b.health -= impact * 0.04;
      return impact * 0.04;
    }
    a.speed *= 0.85; b.speed *= 0.85;
  }
  return 0;
}

// ---------- traffic AI: follow lanes, stop at intersections, turn ----------

export function updateTrafficCar(car, dt, world) {
  const [dx, dy] = DIRV[car.dir];
  const speedNow = Math.hypot(car.vx, car.vy);

  // slow near the car ahead
  let blocked = false;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const aheadX = car.x + dx * 60, aheadY = car.y + dy * 60;
    if (dist(other.x, other.y, aheadX, aheadY) < 52) { blocked = true; break; }
  }

  // stop at red-ish timing: each intersection has a phase from its coords
  let atIntersection = false;
  let stopSignal = false;
  const nearX = nearestOf(avX, car.x, 70);
  const nearY = nearestOf(avY, car.y, 70);
  if (nearX !== null && nearY !== null) {
    atIntersection = true;
    const phase = ((nearX + nearY) / 130) % 2;
    const axisIsX = dy === 0;
    stopSignal = axisIsX ? phase < 1 : phase >= 1;
  }

  // brake for the intersection stop line
  let brake = false;
  if (stopSignal && !insideIntersection(car)) {
    const stopDist = 74;
    if (nearX !== null && nearY !== null) {
      const [sdx, sdy] = DIRV[car.dir];
      const sx = nearX - sdx * stopDist, sy = nearY - sdy * stopDist;
      const dToStop = (car.x - sx) * sdx + (car.y - sy) * sdy;
      if (dToStop > -30 && dToStop < 40) brake = true;
    }
  }

  const want = blocked || brake ? 0 : car.targetSpeed;
  if (speedNow < want) {
    car.speed = Math.min(want, car.speed + car.type.accel * dt);
  } else {
    car.speed = Math.max(want, car.speed - 300 * dt);
  }
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // turn when reaching an intersection center
  if (atIntersection && nearX !== null && nearY !== null && !car.turnedAt) {
    const dCenter = dist(car.x, car.y, nearX, nearY);
    if (dCenter < 26) {
      const r = Math.random();
      let nd = car.dir;
      if (r < 0.28) nd = (car.dir + 1) % 4;
      else if (r < 0.56) nd = (car.dir + 3) % 4;
      if (nd !== car.dir) {
        car.dir = nd;
        car.angle = nd * Math.PI / 2;
        // snap onto the correct lane center
        snapToLane(car);
      }
      car.turnedAt = true;
      setTimeout(() => { car.turnedAt = false; }, 1200);
    }
  } else if (!atIntersection) {
    car.turnedAt = false;
  }

  // dead-end / off-road recovery
  if (car.x < 60 || car.x > WORLD_W - 60 || car.y < 60 || car.y > WORLD_H - 60 || car.x > SEA_X - 60) {
    car.dir = (car.dir + 2) % 4;
    car.angle = car.dir * Math.PI / 2;
    snapToLane(car);
  }
  if (car.health <= 0 && !car.dead) car.dead = true;
}

function insideIntersection(car) {
  const nx = nearestOf(avX, car.x, 50);
  const ny = nearestOf(avY, car.y, 50);
  return nx !== null && ny !== null;
}

function nearestOf(arr, v, tol) {
  let best = null, bd = tol;
  for (const a of arr) { const d = Math.abs(v - a); if (d < bd) { bd = d; best = a; } }
  return best;
}

function snapToLane(car) {
  const [dx, dy] = DIRV[car.dir];
  // right-hand traffic: lane offset 18 to the right of the centerline
  if (dy === 0) { // horizontal
    car.y = car.y - dy * 0; const ay = nearestOf(avY, car.y, 100);
    if (ay !== null) car.y = ay + (dx > 0 ? -18 : 18);
    car.y += 0;
  } else {
    const ax = nearestOf(avX, car.x, 100);
    if (ax !== null) car.x = ax + (dy > 0 ? 18 : -18);
  }
}

// ---------- police chase AI ----------

export function updatePoliceCar(car, dt, target, world) {
  if (!target) return;
  const ang = Math.atan2(target.y - car.y, target.x - car.x);
  const d = angleDiff(car.angle, ang);
  const steer = clamp(d * 2, -1, 1);
  const distance = dist(car.x, car.y, target.x, target.y);
  const throttle = distance > 120 ? 1 : 0.4;
  const brake = distance < 70;
  updateCarPhysics(car, dt, throttle, steer, brake, world);
  car.siren = true;
  // ram damage when close
  if (distance < 40 && target.health !== undefined) {
    target.health -= 6 * dt;
  }
}

// ---------- drawing ----------

export function drawCar(ctx, car, time) {
  const t = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  // shadow
  ctx.fillStyle = 'rgba(30,25,45,0.4)';
  ctx.save();
  ctx.rotate(car.angle + 0.3);
  ctx.fillRect(-t.w / 2 + 4, -t.h / 2 + 6, t.w, t.h);
  ctx.restore();
  ctx.rotate(car.angle);

  // body
  ctx.fillStyle = car.dead ? '#3a3a3a' : car.color;
  roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, 5);
  ctx.fill();
  // warm top highlight
  ctx.fillStyle = 'rgba(255,190,110,0.3)';
  roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h / 2, 5);
  ctx.fill();
  // cabin
  ctx.fillStyle = car.police ? '#2a3440' : 'rgba(25,28,36,0.85)';
  roundRect(ctx, -t.w * 0.16, -t.h / 2 + 3, t.w * 0.42, t.h - 6, 3);
  ctx.fill();
  // windshield glint
  ctx.fillStyle = 'rgba(210,235,240,0.5)';
  ctx.fillRect(t.w * 0.12, -t.h / 2 + 4, 3, t.h - 8);

  if (car.police) {
    // livery stripe + light bar
    ctx.fillStyle = '#2a3c58';
    ctx.fillRect(-t.w / 2 + 4, -t.h / 2 + 2, t.w - 8, 4);
    ctx.fillRect(-t.w / 2 + 4, t.h / 2 - 6, t.w - 8, 4);
    const flash = Math.sin(time * 14) > 0;
    ctx.fillStyle = flash ? '#ff3a3a' : '#3a6aff';
    ctx.fillRect(-3, -t.h / 2 + 1, 5, 4);
    ctx.fillStyle = flash ? '#3a6aff' : '#ff3a3a';
    ctx.fillRect(-3, t.h / 2 - 5, 5, 4);
  }

  // headlights + brake lights
  ctx.fillStyle = '#ffe9b0';
  ctx.fillRect(t.w / 2 - 3, -t.h / 2 + 2, 3, 4);
  ctx.fillRect(t.w / 2 - 3, t.h / 2 - 6, 3, 4);
  const braking = car.speed < Math.hypot(car.vx, car.vy) - 1 || car.speed < 10;
  ctx.fillStyle = braking ? '#ff4a3a' : '#802018';
  ctx.fillRect(-t.w / 2, -t.h / 2 + 2, 3, 4);
  ctx.fillRect(-t.w / 2, t.h / 2 - 6, 3, 4);

  // damage darkness
  if (car.health < 60) {
    ctx.fillStyle = `rgba(30,25,20,${clamp((60 - car.health) / 90, 0, 0.5)})`;
    roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, 5);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
