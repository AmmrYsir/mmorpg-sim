// Entry point: owns the rAF loop, wires all modules together.
import { GAME_SPEED } from './constants.js';
import { W, makePRNG, buildMap, emit } from './world.js';
import { spawnNPC, updateNPCs, getBatchIdx } from './npc.js';
import { updateEconomy } from './economy.js';
import { initRenderer, render } from './renderer.js';
import { initUI, updateUI, logEvent } from './ui.js';

let _lastTs = 0, _fps = 60, _fpsT = 0, _fpsF = 0;
let _rand;

function _loop(ts) {
  const rawDt = Math.min((ts - _lastTs) / 1000, 0.1);
  _lastTs = ts;

  _fpsF++; _fpsT += rawDt;
  if (_fpsT >= 1) { _fps = Math.round(_fpsF / _fpsT); _fpsT = 0; _fpsF = 0; }

  if (!W.paused) {
    const gameDt = rawDt * W.speed * GAME_SPEED;
    const prevHour = Math.floor(W.time);
    W.time += gameDt / 3600;
    if (W.time >= 24) {
      W.time -= 24; W.day++;
      logEvent(`Day ${W.day} begins`, 'economy');
    }
    if (Math.floor(W.time) !== prevHour) emit('hour', Math.floor(W.time));
    updateNPCs(gameDt, _rand);
    updateEconomy(gameDt);
  }

  render(rawDt);
  updateUI(ts, _fps, `${getBatchIdx()}/${W.npcs.length}`);
  requestAnimationFrame(_loop);
}

function init() {
  _rand = makePRNG(0xDEADBEEF);
  buildMap(_rand);

  const counts = { worker: 55, merchant: 15, guard: 15, politician: 5 };
  for (const [role, count] of Object.entries(counts))
    for (let i = 0; i < count; i++) W.npcs.push(spawnNPC(role, _rand));

  initUI();
  initRenderer(document.getElementById('game-canvas'));

  document.getElementById('sl-tax').addEventListener('input', e => {
    W.policies.tax = e.target.value / 100;
    document.getElementById('sv-tax').textContent = e.target.value + '%';
  });
  document.getElementById('sl-wage').addEventListener('input', e => {
    W.policies.wage = +e.target.value;
    document.getElementById('sv-wage').textContent = '$' + e.target.value;
    W.npcs.forEach(n => { n.wage = Math.max(W.policies.wage, n.wage); });
  });
  document.getElementById('sl-infra').addEventListener('input', e => {
    W.policies.infra = e.target.value / 100;
    document.getElementById('sv-infra').textContent = e.target.value + '%';
  });
  document.getElementById('ck-trade').addEventListener('change', e => {
    W.policies.trade = e.target.checked;
    logEvent('Trade: ' + (e.target.checked ? 'Open' : 'Closed'), 'govern');
  });
  document.getElementById('ck-guards').addEventListener('change', e => {
    W.policies.guards = e.target.checked;
    logEvent('Guard patrols: ' + (e.target.checked ? 'On' : 'Off'), 'govern');
  });

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = +btn.dataset.speed;
      W.speed = s; W.paused = s === 0;
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  logEvent('World of Aethoria initialized', 'economy');
  requestAnimationFrame(_loop);
}

init();
