// Canvas rendering: static map blit, pixel-lerp NPC sprites, day/night overlay.
import { MAP_W, MAP_H, TILE, TCOL, NPC_LERP_ALPHA } from './constants.js';
import { W, mapAt } from './world.js';

let _mapCanvas, _mapCtx;
let _canvas, _ctx;
let _camX = 0, _camY = 0;

export function initRenderer(canvas) {
  _canvas = canvas;
  _ctx = canvas.getContext('2d');
  _ctx.imageSmoothingEnabled = false;
  _bakeMap();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

export function resizeCanvas() {
  const area = _canvas.parentElement;
  _canvas.width  = area.clientWidth;
  _canvas.height = area.clientHeight;
  _ctx.imageSmoothingEnabled = false;
  _camX = Math.max(0, Math.floor((MAP_W * TILE - _canvas.width)  / 2));
  _camY = Math.max(0, Math.floor((MAP_H * TILE - _canvas.height) / 2));
}

function _bakeMap() {
  _mapCanvas = document.createElement('canvas');
  _mapCanvas.width  = MAP_W * TILE;
  _mapCanvas.height = MAP_H * TILE;
  _mapCtx = _mapCanvas.getContext('2d');
  _mapCtx.imageSmoothingEnabled = false;

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      _mapCtx.fillStyle = TCOL[mapAt(x, y)];
      _mapCtx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }

  // Deterministic building overdraw (colours pre-computed in buildMap)
  for (const [idx, col] of W.buildingColors) {
    const bx = (idx % MAP_W) * TILE;
    const by = Math.floor(idx / MAP_W) * TILE;
    _mapCtx.fillStyle = col;
    _mapCtx.fillRect(bx, by, TILE, TILE);
    _mapCtx.fillStyle = 'rgba(0,0,0,.12)';
    _mapCtx.fillRect(bx, by, TILE, 2);
  }

  _mapCtx.strokeStyle = 'rgba(180,160,100,.4)';
  _mapCtx.lineWidth = 1;
  _mapCtx.beginPath();
  _mapCtx.arc((W.plazaX + 3.5) * TILE, (W.plazaY + 3.5) * TILE, 3 * TILE, 0, Math.PI * 2);
  _mapCtx.stroke();

  _mapCtx.strokeStyle = 'rgba(0,0,0,.03)';
  _mapCtx.lineWidth = 0.5;
  for (let x = 0; x <= MAP_W; x++) {
    _mapCtx.beginPath(); _mapCtx.moveTo(x * TILE, 0); _mapCtx.lineTo(x * TILE, MAP_H * TILE); _mapCtx.stroke();
  }
  for (let y = 0; y <= MAP_H; y++) {
    _mapCtx.beginPath(); _mapCtx.moveTo(0, y * TILE); _mapCtx.lineTo(MAP_W * TILE, y * TILE); _mapCtx.stroke();
  }
}

function _dayNight(hr) {
  if (hr >= 22 || hr < 4) return { a: 0.38, rgb: '0,10,60' };
  if (hr >= 20)            return { a: (hr - 20) / 2 * 0.38, rgb: '0,10,60' };
  if (hr >= 4 && hr < 6)  return { a: (1 - (hr - 4) / 2) * 0.15, rgb: '255,140,0' };
  if (hr >= 6 && hr < 7)  return { a: (1 - (hr - 6)) * 0.08, rgb: '255,200,80' };
  return { a: 0, rgb: '0,0,0' };
}

export function render(realDt) {
  const cw = _canvas.width, ch = _canvas.height;
  const lerpAlpha = Math.min(1, NPC_LERP_ALPHA * realDt);

  for (const n of W.npcs) {
    n.px += (n.targetPX - n.px) * lerpAlpha;
    n.py += (n.targetPY - n.py) * lerpAlpha;
  }

  _ctx.drawImage(_mapCanvas, -_camX, -_camY);

  const { a, rgb } = _dayNight(W.time);
  if (a > 0.005) {
    _ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
    _ctx.fillRect(0, 0, cw, ch);
  }

  for (const n of W.npcs) {
    const sx = Math.round(n.px) - _camX;
    const sy = Math.round(n.py) - _camY;
    if (sx < -TILE || sx > cw || sy < -TILE || sy > ch) continue;

    _ctx.fillStyle = 'rgba(0,0,0,.18)';
    _ctx.fillRect(sx + 3, sy + TILE - 3, TILE - 6, 3);
    _ctx.fillStyle = n.color;
    _ctx.fillRect(sx + 2, sy + 4, TILE - 4, TILE - 6);
    _ctx.fillStyle = '#ffe0b2';
    _ctx.fillRect(sx + 4, sy + 1, TILE - 8, 4);

    if (n === W.selectedNPC) {
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1.5;
      _ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
    }
  }

  if (W.selectedNPC) {
    const s = W.selectedNPC;
    const ax = Math.round(s.px) - _camX + TILE / 2;
    const ay = Math.round(s.py) - _camY - 3;
    _ctx.fillStyle = '#fff';
    _ctx.beginPath();
    _ctx.moveTo(ax, ay); _ctx.lineTo(ax - 4, ay - 6); _ctx.lineTo(ax + 4, ay - 6);
    _ctx.fill();
  }
}
