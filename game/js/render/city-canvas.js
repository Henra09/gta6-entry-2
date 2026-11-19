// Builds the static city once into a big offscreen canvas: asphalt roads with lane
// markings and crosswalks, sidewalks, blocks with buildings (lit windows, roofs,
// long soft shadows), palms, parks, beach, sea, billboards with fictional brands.
// Everything warm: late-afternoon sun from the south-west.

import { CITY, avX, avY, SEA_X, BEACH_X, WORLD_W, WORLD_H, parkBlocks, plazaBlocks } from '../data/city-map.js';
import { makeRng } from '../core/util.js';

const ROAD = '#2b2b31';
const ROAD_WARM = '#33323a';
const SIDEWALK = '#9d9484';
const SIDEWALK_LIGHT = '#b0a692';
const SUN = { x: -0.62, y: 0.78 }; // shadow direction (sun to the south-west, shadows to the north-east... flipped below)

const BRANDS = [
  ['SOL COLA', '#e05038', '#f8e8c8'],
  ['MARINA ROYALE', '#1c6f8c', '#f2ead0'],
  ['PELÍCANO AIR', '#d8a832', '#26303a'],
  ['TROPICO BANK', '#3a6e46', '#f0e6d2'],
  ['LAGO SUNGLASS', '#c2683a', '#f8f0dc'],
  ['PALMA FM 101', '#7c4a9e', '#f2e8f0'],
];

const ROOFS = ['#a34d38', '#b06a3e', '#8f5a44', '#9e4436', '#7d6a52', '#a8823e', '#6e7a86', '#93634a', '#5e6e5c', '#b5523a'];

const PAD = 400;
let cityCanvasRef = null;

export function buildCity() {
  const canvas = document.createElement('canvas');
  cityCanvasRef = canvas;
  cityCanvasRef.width = WORLD_W + PAD * 2;
  cityCanvasRef.height = WORLD_H + PAD * 2;
  const ctx = canvas.getContext('2d');

  ctx.translate(PAD, PAD);

  // ---- ground: warm sand/earth base ----
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(-PAD, -PAD, canvas.width, canvas.height);

  // ---- sea (east) ----
  const seaGrad = ctx.createLinearGradient(SEA_X, 0, WORLD_W + 200, 0);
  seaGrad.addColorStop(0, '#2e8f96');
  seaGrad.addColorStop(0.5, '#1e7080');
  seaGrad.addColorStop(1, '#125a6e');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(SEA_X, -PAD, WORLD_W + PAD * 2 - SEA_X, canvas.height);

  // gentle wave lines on the sea
  ctx.strokeStyle = 'rgba(240,248,230,0.18)';
  ctx.lineWidth = 2;
  const rngW = makeRng(7);
  for (let i = 0; i < 120; i++) {
    const wy = rngW() * WORLD_H;
    const wx = SEA_X + 20 + rngW() * (WORLD_W - SEA_X + 200);
    const wl = 20 + rngW() * 50;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + wl / 2, wy - 4, wx + wl, wy);
    ctx.stroke();
  }

  // ---- beach strip ----
  const beachGrad = ctx.createLinearGradient(BEACH_X - 60, 0, SEA_X, 0);
  beachGrad.addColorStop(0, '#e2cf9e');
  beachGrad.addColorStop(1, '#f0dfa8');
  ctx.fillStyle = beachGrad;
  ctx.fillRect(BEACH_X, -PAD, SEA_X - BEACH_X, canvas.height);
  // wet sand edge
  ctx.fillStyle = 'rgba(90,130,120,0.35)';
  ctx.fillRect(SEA_X - 10, -PAD, 10, canvas.height);
  // umbrellas on the beach
  const rngB = makeRng(31);
  for (let i = 0; i < 26; i++) {
    const ux = BEACH_X + 20 + rngB() * (SEA_X - BEACH_X - 50);
    const uy = rngB() * WORLD_H;
    ctx.fillStyle = ['#d44838', '#4455aa', '#d8aa32', '#44aa88'][i % 4];
    ctx.beginPath();
    ctx.arc(ux, uy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    ctx.fillRect(ux - 1, uy - 2, 2, 10);
    // shadow
    ctx.fillStyle = 'rgba(40,30,50,0.2)';
    ctx.beginPath();
    ctx.ellipse(ux + 8, uy + 10, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- blocks: ground under everything ----
  drawBlockGrounds(ctx);

  // ---- roads ----
  drawRoads(ctx);

  // ---- buildings, trees, props per block ----
  drawBlocks(ctx);

  // ---- warm sunlight grade over land ----
  const sunGrad = ctx.createLinearGradient(0, WORLD_H, WORLD_W * 0.4, 0);
  sunGrad.addColorStop(0, 'rgba(255,166,60,0.14)');
  sunGrad.addColorStop(1, 'rgba(255,190,90,0.03)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(-PAD, -PAD, canvas.width, canvas.height);

  return { canvas, pad: PAD };
}

function drawBlockGrounds(ctx) {
  for (let i = 0; i < CITY.gridN - 1; i++) {
    for (let j = 0; j < CITY.gridM - 1; j++) {
      const x0 = avX[i] + CITY.runW / 2;
      const y0 = avY[j] + CITY.runW / 2;
      const w = avX[i + 1] - avX[i] - CITY.runW;
      const h = avY[j + 1] - avY[j] - CITY.runW;
      const key = i + ',' + j;
      if (parkBlocks.has(key)) {
        ctx.fillStyle = '#5e8c48';
        ctx.fillRect(x0, y0, w, h);
        // mown stripes
        ctx.fillStyle = 'rgba(255,255,220,0.05)';
        for (let s = 0; s < w; s += 34) ctx.fillRect(x0 + s, y0, 17, h);
      } else if (plazaBlocks.has(key)) {
        ctx.fillStyle = '#c0ab8a';
        ctx.fillRect(x0, y0, w, h);
        ctx.strokeStyle = 'rgba(80,60,40,0.25)';
        ctx.lineWidth = 3;
        for (let s = 0; s <= w; s += 80) {
          ctx.beginPath(); ctx.moveTo(x0 + s, y0); ctx.lineTo(x0 + s, y0 + h); ctx.stroke();
        }
        for (let s = 0; s <= h; s += 80) {
          ctx.beginPath(); ctx.moveTo(x0, y0 + s); ctx.lineTo(x0 + w, y0 + s); ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#8f8574';
        ctx.fillRect(x0, y0, w, h);
      }
    }
  }
}

function drawRoads(ctx) {
  // asphalt
  ctx.fillStyle = ROAD;
  for (const ax of avX) ctx.fillRect(ax - CITY.runW / 2, -PAD, CITY.runW, cityCanvasRef.height);
  for (const ay of avY) ctx.fillRect(-PAD, ay - CITY.runW / 2, cityCanvasRef.width, CITY.runW);

  // warm tint on sun-facing lane
  ctx.fillStyle = 'rgba(255,170,80,0.05)';
  for (const ax of avX) ctx.fillRect(ax - CITY.runW / 2, -PAD, CITY.runW / 2, cityCanvasRef.height);
  for (const ay of avY) ctx.fillRect(-PAD, ay - CITY.runW / 2, cityCanvasRef.width, CITY.runW / 2);

  // dashed center lines
  ctx.strokeStyle = '#d8c96a';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const ax of avX) {
    ctx.beginPath();
    ctx.moveTo(ax, -PAD);
    ctx.lineTo(ax, WORLD_H + PAD);
    ctx.stroke();
  }
  for (const ay of avY) {
    ctx.beginPath();
    ctx.moveTo(-PAD, ay);
    ctx.lineTo(WORLD_W + PAD, ay);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // edge lines (white, where sidewalk meets asphalt)
  ctx.strokeStyle = 'rgba(230,225,210,0.6)';
  ctx.lineWidth = 2;
  for (const ax of avX) {
    for (const off of [-CITY.runW / 2 + 4, CITY.runW / 2 - 4]) {
      ctx.beginPath();
      ctx.moveTo(ax + off, -PAD);
      ctx.lineTo(ax + off, WORLD_H + PAD);
      ctx.stroke();
    }
  }
  for (const ay of avY) {
    for (const off of [-CITY.runW / 2 + 4, CITY.runW / 2 - 4]) {
      ctx.beginPath();
      ctx.moveTo(-PAD, ay + off);
      ctx.lineTo(WORLD_W + PAD, ay + off);
      ctx.stroke();
    }
  }

  // crosswalks at every intersection
  for (const ax of avX) {
    for (const ay of avY) {
      drawCrosswalk(ctx, ax, ay);
    }
  }

  // asphalt patch stains for texture
  const rngP = makeRng(99);
  for (let i = 0; i < 240; i++) {
    const px = rngP() * WORLD_W;
    const py = rngP() * WORLD_H;
    if (!nearRoad(px, py)) continue;
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rngP() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 8 + rngP() * 22, 6 + rngP() * 14, rngP() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function nearRoad(x, y) {
  for (const ax of avX) if (Math.abs(x - ax) < CITY.runW / 2 + 30) return true;
  for (const ay of avY) if (Math.abs(y - ay) < CITY.runW / 2 + 30) return true;
  return false;
}

function drawCrosswalk(ctx, ax, ay) {
  const half = CITY.runW / 2;
  ctx.fillStyle = 'rgba(225,220,205,0.75)';
  // four crossings of striped bars
  for (let s = -half + 14; s < half - 10; s += 14) {
    // north & south crossings (over the avenue)
    ctx.fillRect(ax + s, ay - half - 24, 8, 20);
    ctx.fillRect(ax + s, ay + half + 4, 8, 20);
    // east & west crossings (over the street)
    ctx.fillRect(ax - half - 24, ay + s, 20, 8);
    ctx.fillRect(ax + half + 4, ay + s, 20, 8);
  }
}

function drawBlocks(ctx) {
  for (let i = 0; i < CITY.gridN - 1; i++) {
    for (let j = 0; j < CITY.gridM - 1; j++) {
      const key = i + ',' + j;
      const x0 = avX[i] + CITY.runW / 2;
      const y0 = avY[j] + CITY.runW / 2;
      const w = avX[i + 1] - avX[i] - CITY.runW;
      const h = avY[j + 1] - avY[j] - CITY.runW;
      // sidewalks ring each block
      ctx.fillStyle = SIDEWALK;
      ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = SIDEWALK_LIGHT;
      ctx.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      // curb line
      ctx.strokeStyle = 'rgba(60,55,50,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);

      if (parkBlocks.has(key)) drawPark(ctx, x0, y0, w, h, i * 7 + j);
      else if (plazaBlocks.has(key)) drawPlaza(ctx, x0, y0, w, h);
      else drawBuildings(ctx, x0 + 26, y0 + 26, w - 52, h - 52, i * 7 + j);
    }
  }
  // streetlights along every road (both sides), palm clusters on beach road
  drawStreetProps(ctx);
  // billboards on some corners
  drawBillboards(ctx);
}

function drawPark(ctx, x0, y0, w, h, seed) {
  const rng = makeRng(seed * 13 + 5);
  // pond
  ctx.fillStyle = '#3a7d8a';
  ctx.beginPath();
  ctx.ellipse(x0 + w * 0.4, y0 + h * 0.55, w * 0.2, h * 0.16, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // paths
  ctx.strokeStyle = '#c9b88f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x0 + 20, y0 + 20);
  ctx.quadraticCurveTo(x0 + w / 2, y0 + h * 0.3, x0 + w - 20, y0 + h - 30);
  ctx.stroke();
  // palms and benches
  for (let i = 0; i < 9; i++) {
    drawPalm(ctx, x0 + 40 + rng() * (w - 80), y0 + 40 + rng() * (h - 80), 0.9 + rng() * 0.5);
  }
  ctx.fillStyle = '#7a5c3a';
  for (let i = 0; i < 4; i++) ctx.fillRect(x0 + 60 + rng() * (w - 120), y0 + 40 + rng() * (h - 90), 22, 8);
}

function drawPlaza(ctx, x0, y0, w, h) {
  // fountain center + palms on corners
  ctx.fillStyle = '#8fc4c9';
  ctx.beginPath();
  ctx.arc(x0 + w / 2, y0 + h / 2, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a909c';
  ctx.beginPath();
  ctx.arc(x0 + w / 2, y0 + h / 2, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(240,250,235,0.5)';
  ctx.beginPath();
  ctx.arc(x0 + w / 2 - 8, y0 + h / 2 - 10, 10, 0, Math.PI * 2);
  ctx.fill();
  drawPalm(ctx, x0 + 50, y0 + 50, 1.1);
  drawPalm(ctx, x0 + w - 50, y0 + 50, 1.2);
  drawPalm(ctx, x0 + 50, y0 + h - 50, 1.0);
  drawPalm(ctx, x0 + w - 50, y0 + h - 50, 1.15);
}

function drawBuildings(ctx, x0, y0, w, h, seed) {
  const rng = makeRng(seed * 31 + 17);
  // Split the block into 2-4 building footprints.
  const rows = rng() < 0.5 ? 1 : 2;
  const cols = rng() < 0.6 ? 2 : 1;
  const gap = 12;
  const bw = (w - gap * (cols - 1)) / cols;
  const bh = (h - gap * (rows - 1)) / rows;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inset = 4 + rng() * 10;
      const bx = x0 + c * (bw + gap) + inset;
      const by = y0 + r * (bh + gap) + inset;
      const bwid = bw - inset * 2;
      const bhei = bh - inset * 2;
      if (bwid < 60 || bhei < 60) continue;
      drawBuilding(ctx, bx, by, bwid, bhei, rng, seed * 10 + idx++);
    }
  }
}

function drawBuilding(ctx, x, y, w, h, rng, seed) {
  const shade = 0.75 + rng() * 0.25;          // bigger buildings darker roofs
  const roofColor = ROOFS[Math.floor(rng() * ROOFS.length)];
  const tall = rng() < 0.3;                    // taller = more shadow offset

  // long soft shadow to the south-east (sun from the north-west)
  const shx = 16 + (tall ? 20 : 8);
  const shy = 22 + (tall ? 26 : 10);
  const grad = ctx.createLinearGradient(x, y, x + shx * 2, y + shy * 2);
  grad.addColorStop(0, 'rgba(30,25,45,0.38)');
  grad.addColorStop(1, 'rgba(30,25,45,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + shx, y + shy);
  ctx.lineTo(x + shx, y + h + shy);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  // sunlit west/south face — warm highlight strip
  ctx.fillStyle = '#e8c68a';
  ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
  ctx.fillStyle = 'rgba(255,200,120,0.5)';
  ctx.fillRect(x - 5, y - 5, 6, h + 10);
  ctx.fillRect(x - 5, y + h + 4, w + 10, 6);

  // roof
  ctx.fillStyle = roofColor;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  // roof gradient shading (south-west lit)
  const rg = ctx.createLinearGradient(x, y + h, x + w, y);
  rg.addColorStop(0, 'rgba(255,210,140,0.22)');
  rg.addColorStop(0.5, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(20,15,40,0.3)');
  ctx.fillStyle = rg;
  ctx.fillRect(x, y, w, h);

  // roof details: AC boxes, stair house
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const nBox = 2 + Math.floor(rng() * 4);
  for (let b = 0; b < nBox; b++) {
    ctx.fillRect(x + 12 + rng() * (w - 30), y + 12 + rng() * (h - 30), 14 + rng() * 14, 10 + rng() * 10);
  }
  ctx.fillStyle = shade > 0.85 ? '#c8b394' : '#a8987c';
  ctx.fillRect(x + w * 0.3, y + h * 0.3, 30, 24);

  // lit windows around the roof edge (top-down: windows read as small glowing cells on faces)
  const rngL = makeRng(seed * 7 + 3);
  const winCols = Math.max(2, Math.floor(w / 42));
  const winRows = Math.max(2, Math.floor(h / 42));
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      if (rngL() < 0.72) continue;
      const wx = x + 14 + c * (w - 28) / winCols;
      const wy = y + 14 + r * (h - 28) / winRows;
      ctx.fillStyle = rngL() < 0.5 ? '#ffd98a' : '#ffc35e';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(wx, wy, 8, 5);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(wx - 3, wy - 3, 14, 11);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPalm(ctx, x, y, scale) {
  // shadow
  ctx.fillStyle = 'rgba(30,25,45,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 14 * scale, y + 16 * scale, 20 * scale, 9 * scale, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // trunk
  ctx.strokeStyle = '#8a6a48';
  ctx.lineWidth = 5 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * scale);
  ctx.quadraticCurveTo(x + 4 * scale, y, x + 7 * scale, y - 8 * scale);
  ctx.stroke();
  // fronds
  ctx.strokeStyle = '#3f7d3a';
  ctx.lineWidth = 4 * scale;
  for (let a = 0; a < 6; a++) {
    const ang = a * Math.PI / 3 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + 7 * scale, y - 8 * scale);
    ctx.quadraticCurveTo(
      x + 7 * scale + Math.cos(ang) * 20 * scale, y - 8 * scale + Math.sin(ang) * 20 * scale - 6 * scale,
      x + 7 * scale + Math.cos(ang) * 32 * scale, y - 8 * scale + Math.sin(ang) * 26 * scale + 4 * scale,
    );
    ctx.stroke();
  }
  ctx.fillStyle = '#2f6e30';
  ctx.beginPath();
  ctx.arc(x + 7 * scale, y - 8 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawStreetProps(ctx) {
  for (const ax of avX) {
    for (let y = 100; y < WORLD_H; y += 280) {
      streetLight(ctx, ax - CITY.runW / 2 - 14, y);
      streetLight(ctx, ax + CITY.runW / 2 + 14, y + 140);
    }
  }
  // palms along the beach road
  for (let y = 120; y < WORLD_H; y += 170) {
    drawPalm(ctx, BEACH_X - 26, y, 1.1);
    drawPalm(ctx, BEACH_X + 6, y + 70, 0.9);
  }
}

function streetLight(ctx, x, y) {
  ctx.fillStyle = 'rgba(30,25,45,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#565b66';
  ctx.fillRect(x - 2, y - 2, 5, 10);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x, y + 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(x, y + 6, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBillboards(ctx) {
  const rng = makeRng(4242);
  const spots = [];
  for (let i = 1; i < CITY.gridN - 1; i += 2) {
    for (let j = 1; j < CITY.gridM - 1; j += 2) {
      spots.push([avX[i] + CITY.runW / 2 + 4, avY[j] + CITY.runW / 2 + 6]);
    }
  }
  for (let s = 0; s < spots.length; s++) {
    if (rng() < 0.35) continue;
    const [x, y] = spots[s];
    const brand = BRANDS[Math.floor(rng() * BRANDS.length)];
    ctx.fillStyle = 'rgba(30,25,45,0.35)';
    ctx.fillRect(x - 26, y - 16, 62, 44);
    ctx.fillStyle = '#4a4238';
    ctx.fillRect(x - 24, y - 14, 58, 40);
    ctx.fillStyle = brand[1];
    ctx.fillRect(x - 21, y - 11, 52, 34);
    ctx.fillStyle = brand[2];
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(brand[0], x + 5, y + 7);
    ctx.textAlign = 'left';
  }
}
