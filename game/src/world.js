// Frostline — the city of Frostline. A deterministic, seeded northern smuggling
// city: a frozen harbor on the west, a grid of snowy streets, the frozen lake
// Frostmere on the east with an ice-race loop, and five districts.
// Buildings, trees, caches and race gates are placed from one seed, so the
// city is the same every run and screenshots are reproducible.

import { makeRng, range, int, pick, shuffle, clamp } from './random.js';

export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const ROAD_W = 64;

// Road centrelines. Vertical roads run the full height, horizontal the full width.
export const ROADS_X = [350, 900, 1450, 2000, 2550, 3100, 3650];
export const ROADS_Y = [300, 800, 1300, 1800, 2300, 2800, 3300];

// The frozen lake occupies the far east; the frozen bay the far west strip.
export const LAKE = { x0: 3900, y0: 200, x1: 4800, y1: 3400 };
export const BAY = { x0: 0, y0: 0, x1: 330, y1: 3600 };

export const DISTRICTS = [
  { name: 'Frozen Harbor', x0: 0, y0: 0, x1: 900, y1: 3600 },
  { name: 'Old Town', x0: 900, y0: 800, x1: 3100, y1: 2300 },
  { name: 'Northgate', x0: 900, y0: 0, x1: 3650, y1: 800 },
  { name: 'Southworks', x0: 900, y0: 2300, x1: 3650, y1: 3600 },
  { name: 'Lake Frostmere', x0: 3900, y0: 0, x1: 4800, y1: 3600 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Frostline';
}

export function isLake(x, y) {
  return x >= LAKE.x0 && x <= LAKE.x1 && y >= LAKE.y0 && y <= LAKE.y1;
}

export function isBay(x, y) {
  return x >= BAY.x0 && x <= BAY.x1 && y >= BAY.y0 && y <= BAY.y1;
}

export function isIce(x, y) {
  return isLake(x, y) || isBay(x, y);
}

// True when a point sits on a road (centreline within half the road width).
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

const ROOF_COLORS = ['#7a4a3a', '#4a5a6a', '#6a5a7a', '#3a5a4a', '#8a6a3a', '#5a3a4a', '#445566'];

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Buildings fill the blocks between roads, never on the lake, the bay, or roads.
  for (let xi = 0; xi < ROADS_X.length - 1; xi++) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi++) {
      const bx0 = ROADS_X[xi] + ROAD_W / 2 + 56;
      const bx1 = ROADS_X[xi + 1] - ROAD_W / 2 - 56;
      const by0 = ROADS_Y[yi] + ROAD_W / 2 + 56;
      const by1 = ROADS_Y[yi + 1] - ROAD_W / 2 - 56;
      if (bx1 > WORLD_W - 40 || by1 > WORLD_H - 40) continue;
      // Keep the harbour strip and the lake clear of buildings.
      if (bx1 < 360 || bx0 >= LAKE.x0) continue;
      const count = int(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 90, 190);
        const h = range(rng, 80, 170);
        const x = range(rng, bx0, Math.max(bx0 + 1, bx1 - w));
        const y = range(rng, by0, Math.max(by0 + 1, by1 - h));
        // Keep mission-critical clearings free (warehouse, depots, safehouse).
        if (clearingHit(x, y, w, h)) continue;
        buildings.push({
          x, y, w, h,
          roof: pick(rng, ROOF_COLORS),
          wall: pick(rng, ['#9a8a7a', '#8a94a0', '#a08a7a', '#7a8a9a']),
          tall: chance(rng, 0.25),
        });
      }
    }
  }

  // Harbour warehouses: long sheds along the frozen bay.
  for (let i = 0; i < 4; i++) {
    buildings.push({
      x: 90, y: 300 + i * 820, w: 150, h: 260,
      roof: '#5a6a7a', wall: '#8a7a6a', tall: false, shed: true,
    });
  }
  // Northgate industrial halls.
  for (let i = 0; i < 3; i++) {
    buildings.push({
      x: 1500 + i * 620, y: 330, w: 260, h: 150,
      roof: '#4a5a6a', wall: '#7a7a72', tall: false, shed: true,
    });
  }

  // Pine trees with snow, scattered off-road and off-lake-centre.
  for (let i = 0; i < 150; i++) {
    const x = range(rng, 60, WORLD_W - 60);
    const y = range(rng, 60, WORLD_H - 60);
    if (onRoad(x, y)) continue;
    if (isLake(x, y) && range(rng, 0, 1) < 0.8) continue;
    if (hitsBuilding(buildings, x, y, 26)) continue;
    trees.push({ x, y, r: range(rng, 9, 15) });
  }

  // Street lamps along the roads.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry + ROAD_W / 2 + 8 });
    }
  }

  // Frozen caches: glowing supply crates hidden around the city.
  const cacheSpots = [
    [520, 640], [1180, 420], [1760, 1020], [2320, 560], [2900, 1560],
    [3380, 1080], [1120, 2060], [1760, 2620], [2900, 3060], [3480, 2560],
    [4200, 2400], [4480, 1500],
  ];
  const caches = shuffle(rng, cacheSpots).map(([x, y], i) => ({
    id: i, x, y, taken: false,
  }));

  // Ice-race loop on the frozen lake: six gates in a loop.
  const raceGates = [
    { x: 4150, y: 500 }, { x: 4600, y: 600 }, { x: 4650, y: 1700 },
    { x: 4550, y: 2900 }, { x: 4150, y: 3100 }, { x: 4050, y: 1500 },
  ];

  return {
    seed, buildings, trees, lamps, caches, raceGates,
    spawn: { x: 250, y: 1700, angle: 0 },
    harborDrop: { x: 250, y: 2050 },
  };
}

// Mission clearings: rectangles kept free of random buildings.
const CLEARINGS = [
  { x: 1450, y: 300, w: 700, h: 420 },   // Northgate warehouse + depot
  { x: 900, y: 1300, w: 600, h: 500 },   // Old Town shop
  { x: 700, y: 2800, w: 700, h: 450 },   // Southworks safehouse
  { x: 330, y: 1550, w: 620, h: 300 },   // Harbor exit: Ash can always drive out
];

function clearingHit(x, y, w, h) {
  for (const c of CLEARINGS) {
    if (x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y) return true;
  }
  return false;
}

function hitsBuilding(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

export function collidesBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if (Math.hypot(x - cx, y - cy) < r) return b;
  }
  return null;
}

function chance(rng, p) {
  return rng() < p;
}
