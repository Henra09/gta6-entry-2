// Minimap: a scaled-down render of the real city layout (roads, sea, park blocks),
// with blips for the player, mission marker, police, cars and shops. Cached canvas.

import { CITY, avX, avY, SEA_X, BEACH_X, WORLD_W, WORLD_H, parkBlocks, locations } from '../data/city-map.js';
import { clamp } from '../core/util.js';

let cached = null;

function buildBase() {
  const S = 2.2; // px per world-100 ... choose: map is WORLD_W/100 wide
  const scale = S / 100;
  const w = Math.ceil(WORLD_W * scale);
  const h = Math.ceil(WORLD_H * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  // land
  ctx.fillStyle = '#5a5245';
  ctx.fillRect(0, 0, w, h);
  // sea + beach
  ctx.fillStyle = '#e0cd9c';
  ctx.fillRect(BEACH_X * scale, 0, w - BEACH_X * scale, h);
  ctx.fillStyle = '#1e6a78';
  ctx.fillRect(SEA_X * scale, 0, w - SEA_X * scale, h);
  // parks
  ctx.fillStyle = '#4e7a42';
  for (let i = 0; i < CITY.gridN - 1; i++) {
    for (let j = 0; j < CITY.gridM - 1; j++) {
      if (!parkBlocks.has(i + ',' + j)) continue;
      ctx.fillRect((avX[i] + CITY.runW / 2) * scale, (avY[j] + CITY.runW / 2) * scale,
        (avX[i + 1] - avX[i] - CITY.runW) * scale, (avY[j + 1] - avY[j] - CITY.runW) * scale);
    }
  }
  // roads
  ctx.strokeStyle = '#c8bfa8';
  ctx.lineWidth = Math.max(2, CITY.runW * scale);
  for (const ax of avX) {
    ctx.beginPath();
    ctx.moveTo(ax * scale, 0);
    ctx.lineTo(ax * scale, h);
    ctx.stroke();
  }
  for (const ay of avY) {
    ctx.beginPath();
    ctx.moveTo(0, ay * scale);
    ctx.lineTo(w, ay * scale);
    ctx.stroke();
  }
  return { c, scale };
}

export function drawMinimap(ctx, world, x, y, w, h) {
  if (!cached) cached = buildBase();
  const { c, scale } = cached;

  // frame
  ctx.save();
  ctx.fillStyle = 'rgba(12,14,18,0.75)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.strokeStyle = 'rgba(240,225,190,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // center on the player, zoomed
  const p = world.player;
  const zoom = 2.2;
  const px = p.x * scale, py = p.y * scale;
  const cx = px - w / (2 * zoom);
  const cy = py - h / (2 * zoom);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, cx, cy, w / zoom, h / zoom, x, y, w, h);

  // blips
  const blip = (wx, wy, color, r, outline) => {
    const bx = x + (wx * scale - cx) * zoom;
    const by = y + (wy * scale - cy) * zoom;
    if (bx < x - 8 || bx > x + w + 8 || by < y - 8 || by > y + h + 8) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  for (const car of world.cars) {
    if (car.dead) continue;
    if (car.police) blip(car.x, car.y, Math.sin(world.time * 10) > 0 ? '#ff4a4a' : '#4a6aff', 3.4, true);
    else blip(car.x, car.y, 'rgba(220,220,210,0.75)', 2.2);
  }
  for (const q of world.peds) {
    if (q.cop && !q.dead) blip(q.x, q.y, '#4a9aff', 2.4);
  }
  const mk = world.missionMarker;
  if (mk) blip(mk.x, mk.y, '#ffd23a', 4, true);
  if (world.nextGiver && !mk) blip(world.nextGiver.x, world.nextGiver.y, '#7ae07a', 4, true);
  blip(locations.gunShop.x, locations.gunShop.y, '#e08a3a', 3, true);
  blip(locations.garage.x, locations.garage.y, '#e03a8a', 3, true);

  // player arrow
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4.5);
  ctx.lineTo(-4, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
