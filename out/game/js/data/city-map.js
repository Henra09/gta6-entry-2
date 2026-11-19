// City layout: a hand-authored grid for SOL DORADO. One definition the world builds
// from, the minimap draws from and traffic routes through.
//
// Coordinates are in world pixels. The grid: ROAD_SPACING apart, roads RUN_W wide
// along x = k*spacing (vertical avenues) and y = k*spacing (horizontal streets).
// The sea sits beyond x > SEA_X with a beach strip; a park occupies some blocks.

export const CITY = {
  name: 'SOL DORADO',
  spacing: 560,        // distance between road centerlines
  runW: 96,            // full road width (two lanes + shoulder)
  sidewalk: 26,        // sidewalk width each side of the road
  blockW: 560 - 96,    // buildable block width between roads
  gridN: 7,            // number of vertical avenues (0..6)
  gridM: 8,            // number of horizontal streets (0..7)
  seaX: 6.6 * 560,     // water starts here (east edge)
  beachW: 130,
};

export const WORLD_W = CITY.gridN * CITY.spacing + 300;
export const WORLD_H = CITY.gridM * CITY.spacing + 400;

// Road centerline coordinates.
export const avX = [];   // vertical avenues (x centers)
export const avY = [];   // horizontal streets (y centers)
for (let i = 0; i < CITY.gridN; i++) avX.push(i * CITY.spacing + 200);
for (let j = 0; j < CITY.gridM; j++) avY.push(j * CITY.spacing + 160);

export const SEA_X = avX[CITY.gridN - 1] + CITY.spacing * 0.72;
export const BEACH_X = SEA_X - CITY.beachW;

// Named districts for flavor text and the HUD.
export const districts = [
  { name: 'OLD HARBOR', x0: 0, x1: avX[1], y0: 0, y1: avY[3] },
  { name: 'PALM HEIGHTS', x0: avX[2], x1: avX[4], y0: 0, y1: avY[3] },
  { name: 'MIRADOR STRIP', x0: avX[1], x1: avX[5], y0: avY[3], y1: avY[5] },
  { name: 'EL CORAZON', x0: 0, x1: avX[2], y0: avY[3], y1: avY[7] },
  { name: 'COSTA VISTA', x0: avX[4], x1: WORLD_W, y0: avY[4], y1: WORLD_H },
];

export function districtAt(x, y) {
  for (const d of districts) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'SOL DORADO';
}

// Park blocks: block indices (i avenue, j street) that are green instead of built.
export const parkBlocks = new Set(['3,1', '1,5', '4,4', '2,6']);

// Plazas (open concrete blocks with palms): no building, walkable, good for shootouts.
export const plazaBlocks = new Set(['5,2']);

// Fixed special locations (world coords): mission givers, shops, garage.
// Each block spans between two roads; we place markers on sidewalks near corners.
function blockCenter(i, j) {
  return { x: (avX[i] + avX[i + 1]) / 2, y: (avY[j] + avY[j + 1]) / 2 };
}
function sidewalkSpot(i, j, dx, dy) {
  // A point on the sidewalk near the block corner (i,j): just inside the road edge.
  return {
    x: avX[i] + CITY.runW / 2 + CITY.sidewalk / 2 + dx,
    y: avY[j] + CITY.runW / 2 + CITY.sidewalk / 2 + dy,
  };
}

export const locations = {
  missionGivers: [
    { id: 'm0', name: 'ROSARIO', x: sidewalkSpot(0, 0, 60, 40).x, y: sidewalkSpot(0, 0, 60, 40).y },
    { id: 'm1', name: 'EL CHINO', x: sidewalkSpot(2, 2, 80, 40).x, y: sidewalkSpot(2, 2, 80, 40).y },
    { id: 'm2', name: 'CAPITÁN VEGA', x: sidewalkSpot(4, 3, 60, 60).x, y: sidewalkSpot(4, 3, 60, 60).y },
    { id: 'm3', name: 'MARISOL', x: sidewalkSpot(3, 5, 60, 40).x, y: sidewalkSpot(3, 5, 60, 40).y },
    { id: 'm4', name: 'BRUNO', x: sidewalkSpot(1, 4, 40, 60).x, y: sidewalkSpot(1, 4, 40, 60).y },
    { id: 'm5', name: 'LA SOMBRA', x: sidewalkSpot(5, 5, 80, 40).x, y: sidewalkSpot(5, 5, 80, 40).y },
    { id: 'm6', name: 'ROSARIO', x: sidewalkSpot(0, 6, 60, 40).x, y: sidewalkSpot(0, 6, 60, 40).y },
    { id: 'm7', name: 'ROSARIO', x: sidewalkSpot(2, 0, 60, 40).x, y: sidewalkSpot(2, 0, 60, 40).y },
  ],
  gunShop: sidewalkSpot(3, 1, 40, 30),
  gunShopLabel: 'OSO ARMERÍA',
  garage: sidewalkSpot(4, 0, 40, 30),
  garageLabel: 'TALLER COSTA',
  raceStart: { x: avX[5] + CITY.runW / 2 + 40, y: avY[1] },
  rampages: [
    sidewalkSpot(1, 1, 40, 30),
    sidewalkSpot(4, 6, 60, 30),
    sidewalkSpot(2, 4, 30, 40),
  ],
  deliverySpots: [
    blockCenter(0, 1), blockCenter(3, 3), blockCenter(5, 0),
    blockCenter(1, 6), blockCenter(4, 5), blockCenter(0, 4),
  ],
};

// Is this world point on the road (including intersection)?
export function onRoad(x, y) {
  for (const ax of avX) if (Math.abs(x - ax) < CITY.runW / 2) return true;
  for (const ay of avY) if (Math.abs(y - ay) < CITY.runW / 2) return true;
  return false;
}

// Nearest lane center point for traffic spawning: returns {x, y, dir} where dir is
// 0:+x 1:+y 2:-x 3:-y (right-hand traffic).
export function nearestLane(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ay of avY) {
    for (const ax of avX) {
      for (const dir of [0, 2]) {
        const laneY = ay + (dir === 0 ? -18 : 18);
        const d = Math.abs(y - laneY);
        if (d < bestD) { bestD = d; best = { x, y: laneY, dir, axis: 'h', road: ay }; }
      }
      for (const dir of [1, 3]) {
        const laneX = ax + (dir === 1 ? 18 : -18);
        const d = Math.abs(x - laneX);
        if (d < bestD) { bestD = d; best = { x: laneX, y, dir, axis: 'v', road: ax }; }
      }
    }
  }
  return best;
}

// Directions as vectors.
export const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]];
