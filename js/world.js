// World state singleton, event bus, seeded PRNG, map generation.
import { MAP_W, MAP_H, T, BCOLS } from './constants.js';

export function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _listeners = new Map();
export function on(event, fn) {
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event).push(fn);
}
export function emit(event, data) {
  const fns = _listeners.get(event);
  if (fns) for (const fn of fns) fn(data);
}

export const W = {
  time: 6.0, day: 1, speed: 1, paused: false,
  map: null,             // Uint8Array(MAP_W * MAP_H)
  buildingColors: null,  // Map<tileIdx, colorStr>
  plazaX: 0, plazaY: 0,
  npcs: [], selectedNPC: null,
  policies: { tax: 0.10, wage: 10, infra: 0.20, trade: true, guards: true },
  eco: {
    goods: {
      food:   { supply: 100, demand: 80,  price: 10, base: 10 },
      wood:   { supply: 60,  demand: 50,  price: 15, base: 15 },
      stone:  { supply: 40,  demand: 40,  price: 20, base: 20 },
      luxury: { supply: 20,  demand: 30,  price: 50, base: 50 }
    },
    treasury: 5000, income: 0
  }
};

export function mapAt(x, y)     { return W.map[y * MAP_W + x]; }
export function setMap(x, y, v) { W.map[y * MAP_W + x] = v; }

export function isWalkable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const t = mapAt(x, y);
  return t === T.ROAD || t === T.PLAZA;
}

export function randomRoadTile(rand) {
  for (let i = 0; i < 300; i++) {
    const x = 3 + Math.floor(rand() * (MAP_W - 6));
    const y = 3 + Math.floor(rand() * (MAP_H - 6));
    const t = mapAt(x, y);
    if (t === T.ROAD || t === T.PLAZA) return { x, y };
  }
  return { x: Math.floor(MAP_W / 2), y: Math.floor(MAP_H / 2) };
}

export function buildMap(rand) {
  W.map = new Uint8Array(MAP_W * MAP_H).fill(T.GRASS);
  W.buildingColors = new Map();

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (x < 2 || x >= MAP_W - 2 || y < 2 || y >= MAP_H - 2) setMap(x, y, T.WATER);
      else if (x < 3 || x >= MAP_W - 3 || y < 3 || y >= MAP_H - 3) setMap(x, y, T.TREE);
    }

  const mX = Math.floor(MAP_W / 2), mY = Math.floor(MAP_H / 2);

  for (let x = 3; x < MAP_W - 3; x++) { setMap(x, mY, T.ROAD); setMap(x, mY + 1, T.ROAD); }
  for (let y = 3; y < MAP_H - 3; y++) { setMap(mX, y, T.ROAD); setMap(mX + 1, y, T.ROAD); }

  for (const ry of [9, MAP_H - 10])
    for (let x = 3; x < MAP_W - 3; x++) setMap(x, ry, T.ROAD);
  for (const rx of [9, MAP_W - 10])
    for (let y = 3; y < MAP_H - 3; y++) setMap(rx, y, T.ROAD);

  W.plazaX = mX - 3; W.plazaY = mY - 3;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++)
      setMap(mX + dx, mY + dy, T.PLAZA);

  for (let y = 4; y < MAP_H - 4; y++)
    for (let x = 4; x < MAP_W - 4; x++)
      if (mapAt(x, y) === T.GRASS && rand() < 0.08) setMap(x, y, T.TREE);

  const zones = [
    [4, 4, mX - 2, 9], [mX + 3, 4, MAP_W - 4, 9],
    [4, 10, 9, mY - 2], [MAP_W - 10, 10, MAP_W - 4, mY - 2],
    [4, mY + 3, 9, MAP_H - 10], [MAP_W - 10, mY + 3, MAP_W - 4, MAP_H - 10],
    [4, MAP_H - 9, mX - 2, MAP_H - 4], [mX + 3, MAP_H - 9, MAP_W - 4, MAP_H - 4]
  ];

  for (const [x1, y1, x2, y2] of zones) {
    let cy = y1;
    while (cy < y2 - 1) {
      let cx = x1;
      while (cx < x2 - 1) {
        const bw = 2 + Math.floor(rand() * 2);
        const bh = 2 + Math.floor(rand() * 2);
        if (cx + bw <= x2 && cy + bh <= y2) {
          for (let by = cy; by < cy + bh; by++)
            for (let bx = cx; bx < cx + bw; bx++) {
              setMap(bx, by, T.BUILD);
              W.buildingColors.set(by * MAP_W + bx, BCOLS[(bx * 7 + by * 13) % BCOLS.length]);
            }
        }
        cx += bw + 1 + Math.floor(rand() * 2);
      }
      cy += 3 + Math.floor(rand() * 2);
    }
  }
}
