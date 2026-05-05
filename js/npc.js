// NPC state machine, BFS pathfinding (pre-allocated buffers), batch update.
import { MAP_W, MAP_H, BATCH, NPC_MOVE_SPEED, DIRS4, SCHED, ROLE_COLOR, FNAMES, MNAMES } from './constants.js';
import { W, isWalkable, randomRoadTile, emit } from './world.js';

// Pre-allocated BFS buffers — never reallocated, cleared with fill(0) per search
const _vis  = new Uint8Array(MAP_W * MAP_H);
const _parX = new Int16Array(MAP_W * MAP_H);
const _parY = new Int16Array(MAP_W * MAP_H);
const _qX   = new Int16Array(MAP_W * MAP_H);
const _qY   = new Int16Array(MAP_W * MAP_H);

// LRU path cache: key "sx,sy,tx,ty" → Object.freeze(path)
const _pathCache = new Map();
const _CACHE_MAX = 64;

function _cacheGet(key) {
  if (!_pathCache.has(key)) return null;
  const v = _pathCache.get(key);
  _pathCache.delete(key);
  _pathCache.set(key, v); // move to end (MRU)
  return v;
}

function _cachePut(key, path) {
  if (_pathCache.size >= _CACHE_MAX)
    _pathCache.delete(_pathCache.keys().next().value);
  _pathCache.set(key, path);
}

export function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return Object.freeze([]);
  const key = `${sx},${sy},${tx},${ty}`;
  const cached = _cacheGet(key);
  if (cached) return cached;

  _vis.fill(0);
  let head = 0, tail = 0;
  _qX[tail] = sx; _qY[tail] = sy; tail++;
  _vis[sy * MAP_W + sx] = 1;
  let found = false;

  outer:
  while (head < tail) {
    const cx = _qX[head], cy = _qY[head++];
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS4[d][0], ny = cy + DIRS4[d][1];
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (_vis[ni]) continue;
      if (!isWalkable(nx, ny)) continue;
      _vis[ni] = 1;
      _parX[ni] = cx; _parY[ni] = cy;
      if (nx === tx && ny === ty) { found = true; break outer; }
      _qX[tail] = nx; _qY[tail++] = ny;
    }
  }

  let path;
  if (!found) {
    path = Object.freeze([[tx, ty]]);
  } else {
    const steps = [];
    let cx = tx, cy = ty, safe = 0;
    while ((cx !== sx || cy !== sy) && safe++ < 400) {
      steps.push([cx, cy]);
      const ni = cy * MAP_W + cx;
      const px = _parX[ni], py = _parY[ni];
      cx = px; cy = py;
    }
    steps.reverse();
    path = Object.freeze(steps);
  }
  _cachePut(key, path);
  return path;
}

let _nameIdx = 0;
let _npcId   = 0;

function _rndName(rand) {
  const pool = rand() < 0.5 ? MNAMES : FNAMES;
  const name = pool[_nameIdx % pool.length] + ' ' + String.fromCharCode(65 + Math.floor(rand() * 26));
  _nameIdx++;
  return name;
}

export function spawnNPC(role, rand) {
  const home = randomRoadTile(rand);
  const work = role === 'politician'
    ? { x: W.plazaX + 2, y: W.plazaY + 2 }
    : randomRoadTile(rand);
  return {
    id: _npcId++,
    name: _rndName(rand),
    role,
    state: 'sleep',
    x: home.x, y: home.y,
    targetPX: home.x * 16, targetPY: home.y * 16,
    px: home.x * 16,       py: home.y * 16,
    homeX: home.x, homeY: home.y,
    workX: work.x, workY: work.y,
    path: Object.freeze([]),
    pathIdx: 0,
    moveT: 0,
    wanderT: 0,
    wallet: 80 + rand() * 120,
    happiness: 0.6 + rand() * 0.4,
    wage: Math.max(10, 10 + rand() * 20),
    color: ROLE_COLOR[role],
    active: true,
    _dState: true, _dHappy: true, _dWallet: true
  };
}

function _schedState(role, hr) {
  for (const [s, e, st] of SCHED[role])
    if (s < e ? (hr >= s && hr < e) : (hr >= s || hr < e)) return st;
  return 'sleep';
}

let _batchIdx = 0;
export function getBatchIdx() { return _batchIdx; }

export function updateNPCs(gameDt, rand) {
  const npcs = W.npcs;
  if (!npcs.length) return;
  const end = Math.min(_batchIdx + BATCH, npcs.length);

  for (let i = _batchIdx; i < end; i++) {
    const n = npcs[i];
    if (!n.active) continue;

    const desired = _schedState(n.role, W.time);
    if (n.state !== desired) {
      n.state = desired;
      n._dState = true;
      n.path = Object.freeze([]);
      n.pathIdx = 0;
      if      (desired === '→work')  n.path = findPath(n.x, n.y, n.workX, n.workY);
      else if (desired === '→home')  n.path = findPath(n.x, n.y, n.homeX, n.homeY);
      else if (desired === '→plaza') n.path = findPath(n.x, n.y,
        W.plazaX + 1 + Math.floor(rand() * 5),
        W.plazaY + 1 + Math.floor(rand() * 5));
      else if (desired === 'govern') _governNPC(n);
    }

    // Tile advancement (pathIdx cursor — no Array.shift)
    n.moveT += gameDt;
    while (n.moveT >= NPC_MOVE_SPEED && n.pathIdx < n.path.length) {
      n.moveT -= NPC_MOVE_SPEED;
      const step = n.path[n.pathIdx++];
      n.x = step[0]; n.y = step[1];
      n.targetPX = n.x * 16;
      n.targetPY = n.y * 16;
    }

    // Wander
    if (n.state === 'social') {
      n.wanderT -= gameDt;
      if (n.wanderT <= 0) {
        n.wanderT = 2 + rand() * 3;
        for (let d = 0; d < 4; d++) {
          const nx = n.x + DIRS4[d][0], ny = n.y + DIRS4[d][1];
          if (isWalkable(nx, ny)) {
            n.x = nx; n.y = ny;
            n.targetPX = nx * 16; n.targetPY = ny * 16;
            break;
          }
        }
      }
    }

    // Earn
    if (n.state === 'work') { n.wallet += n.wage * gameDt / 3600; n._dWallet = true; }

    // Spend
    if (n.state === 'social' && n.wallet > 20 && rand() < 0.0005) {
      const goods = Object.values(W.eco.goods);
      const g = goods[Math.floor(rand() * goods.length)];
      if (n.wallet >= g.price) {
        n.wallet -= g.price; n._dWallet = true;
        g.demand += 0.2;
        W.eco.treasury += g.price * W.policies.tax;
      }
    }

    // Happiness
    const target = Math.min(1, 0.4 + (n.wallet / 300) * 0.3 + W.policies.infra * 0.4 - W.policies.tax * 0.5);
    const prevH = n.happiness;
    n.happiness = Math.max(0, Math.min(1, n.happiness + (target - n.happiness) * gameDt * 0.0005));
    if (Math.abs(n.happiness - prevH) > 0.005) n._dHappy = true;

    // Guard patrol boost
    if (W.policies.guards && n.state === 'social' && n.happiness < 0.5)
      n.happiness = Math.min(0.5, n.happiness + 0.001 * gameDt);
  }

  _batchIdx = end >= npcs.length ? 0 : end;
}

function _governNPC(npc) {
  const npcs = W.npcs;
  const avgH = npcs.reduce((s, n) => s + n.happiness, 0) / npcs.length;
  let msg;
  if (avgH < 0.35 && W.policies.tax > 0.05) {
    W.policies.tax = Math.max(0.05, W.policies.tax - 0.02);
    msg = `${npc.name} cut taxes → ${(W.policies.tax * 100).toFixed(0)}%`;
  } else if (W.eco.treasury < 800 && W.policies.tax < 0.30) {
    W.policies.tax = Math.min(0.30, W.policies.tax + 0.02);
    msg = `${npc.name} raised taxes → ${(W.policies.tax * 100).toFixed(0)}%`;
  } else if (W.eco.treasury > 4000 && W.policies.infra < 0.35) {
    W.policies.infra = Math.min(0.40, W.policies.infra + 0.05);
    msg = `${npc.name} boosted infrastructure`;
  } else {
    msg = `${npc.name} held current policies`;
  }
  emit('policyChanged', W.policies);
  emit('log', { msg, type: 'govern' });
}
