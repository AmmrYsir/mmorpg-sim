// DOM updates: dirty-flag patching, keyed NPC list, inspector, event log.
import { W, on } from './world.js';

// Skip DOM write if value unchanged (expando cache on element)
function _sic(el, val) {
  if (el._c === val) return;
  el._c = val;
  el.textContent = val;
}

// Keyed NPC rows — append-only, patch via dirty flags
const _npcRows = new Map();
let _lastInspNPC = null;
let _logCount    = 0;
let _lastUpdate  = 0;

let $clock, $day, $treasury, $income, $happy;
let $pFood, $pWood, $pStone, $pLuxury;
let $npcList, $inspector;
let $svTax, $svWage, $svInfra, $slTax, $slWage, $slInfra;
let $dbFps, $dbNpcs, $dbBatch, $dbEvent, $log;

export function initUI() {
  $clock    = document.getElementById('clock-display');
  $day      = document.getElementById('day-counter');
  $treasury = document.getElementById('sv-treasury');
  $income   = document.getElementById('sv-income');
  $happy    = document.getElementById('sv-happy');
  $pFood    = document.getElementById('pv-food');
  $pWood    = document.getElementById('pv-wood');
  $pStone   = document.getElementById('pv-stone');
  $pLuxury  = document.getElementById('pv-luxury');
  $npcList  = document.getElementById('npc-list');
  $inspector = document.getElementById('inspector');
  $svTax    = document.getElementById('sv-tax');
  $svWage   = document.getElementById('sv-wage');
  $svInfra  = document.getElementById('sv-infra');
  $slTax    = document.getElementById('sl-tax');
  $slWage   = document.getElementById('sl-wage');
  $slInfra  = document.getElementById('sl-infra');
  $dbFps    = document.getElementById('db-fps');
  $dbNpcs   = document.getElementById('db-npcs');
  $dbBatch  = document.getElementById('db-batch');
  $dbEvent  = document.getElementById('db-event');
  $log      = document.getElementById('event-log');

  on('policyChanged', p => {
    $slTax.value  = p.tax * 100;
    $slWage.value = p.wage;
    _sic($svTax,  (p.tax * 100).toFixed(0) + '%');
    _sic($svWage, '$' + p.wage);
  });
  on('log', ({ msg, type }) => _appendLog(msg, type));
}

export function updateUI(ts, fps, batchStr) {
  if (ts - _lastUpdate < 500) return;
  _lastUpdate = ts;

  const h = Math.floor(W.time), m = Math.floor((W.time % 1) * 60);
  _sic($clock, `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h >= 6 && h < 20 ? '☀' : '🌙'}`);
  _sic($day, `Day ${W.day}`);

  const t = W.eco.treasury;
  const tStr = '$' + Math.floor(t).toLocaleString();
  if ($treasury._c !== tStr) {
    $treasury._c = tStr; $treasury.textContent = tStr;
    $treasury.className = 'sval ' + (t >= 0 ? 'pos' : 'neg');
  }
  const inc = W.eco.income;
  const iStr = (inc >= 0 ? '+' : '') + Math.floor(inc);
  if ($income._c !== iStr) {
    $income._c = iStr; $income.textContent = iStr;
    $income.className = 'sval ' + (inc >= 0 ? 'pos' : 'neg');
  }

  const avgH = W.npcs.length ? W.npcs.reduce((s, n) => s + n.happiness, 0) / W.npcs.length : 0;
  _sic($happy,  (avgH * 100).toFixed(0) + '%');
  _sic($pFood,  '$' + W.eco.goods.food.price.toFixed(1));
  _sic($pWood,  '$' + W.eco.goods.wood.price.toFixed(1));
  _sic($pStone, '$' + W.eco.goods.stone.price.toFixed(1));
  _sic($pLuxury,'$' + W.eco.goods.luxury.price.toFixed(1));
  _sic($dbFps,  String(fps));
  _sic($dbNpcs, String(W.npcs.length));
  _sic($dbBatch, batchStr);

  _updateNPCList();
  _updateInspector();
}

function _updateNPCList() {
  for (const n of W.npcs) {
    if (!_npcRows.has(n.id)) {
      const el = document.createElement('div');
      el.className = 'npc-item';
      el.innerHTML = `<div class="npc-dot" style="background:${n.color}"></div>
        <div style="flex:1;min-width:0">
          <div class="npc-name">${n.name}</div>
          <div class="hbar"><div class="hfill" style="width:${(n.happiness*100).toFixed(0)}%"></div></div>
        </div>
        <div class="npc-badge">${n.state}</div>`;
      const hfill = el.querySelector('.hfill');
      const badge = el.querySelector('.npc-badge');
      el.addEventListener('click', () => { W.selectedNPC = n; _updateNPCList(); _updateInspector(); });
      $npcList.appendChild(el);
      _npcRows.set(n.id, { el, hfill, badge });
    }

    const row = _npcRows.get(n.id);
    const wantClass = 'npc-item' + (n === W.selectedNPC ? ' selected' : '');
    if (row.el.className !== wantClass) row.el.className = wantClass;
    if (n._dHappy) { row.hfill.style.width = (n.happiness * 100).toFixed(0) + '%'; n._dHappy = false; }
    if (n._dState) { _sic(row.badge, n.state); n._dState = false; }
  }
}

function _updateInspector() {
  const n = W.selectedNPC;
  if (n === _lastInspNPC) {
    if (!n) return;
    const vals = $inspector.querySelectorAll('.ival');
    if (vals.length >= 5) {
      _sic(vals[0], n.state);
      _sic(vals[1], '$' + Math.floor(n.wallet));
      _sic(vals[2], '$' + n.wage.toFixed(1) + '/hr');
      _sic(vals[3], (n.happiness * 100).toFixed(0) + '%');
      _sic(vals[4], `${n.x},${n.y}`);
    }
    return;
  }
  _lastInspNPC = n;
  if (!n) {
    $inspector.innerHTML = '<div style="color:#adb5bd;font-size:12px">Select an NPC</div>';
    return;
  }
  $inspector.innerHTML = `
    <div id="inspector-name">${n.name}</div>
    <div style="font-size:10px;color:${n.color};font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${n.role}</div>
    <div class="irow"><span>State</span><span class="ival">${n.state}</span></div>
    <div class="irow"><span>Wallet</span><span class="ival">$${Math.floor(n.wallet)}</span></div>
    <div class="irow"><span>Wage</span><span class="ival">$${n.wage.toFixed(1)}/hr</span></div>
    <div class="irow"><span>Happiness</span><span class="ival">${(n.happiness * 100).toFixed(0)}%</span></div>
    <div class="irow"><span>Pos</span><span class="ival">${n.x},${n.y}</span></div>`;
}

export function logEvent(msg, type = 'info') { _appendLog(msg, type); }

function _appendLog(msg, type) {
  const h = Math.floor(W.time), m = Math.floor((W.time % 1) * 60);
  const d = document.createElement('div');
  d.className = `ev ${type}`;
  d.innerHTML = `<span class="et">D${W.day} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}</span>${msg}`;
  $log.insertBefore(d, $log.firstChild);
  _logCount++;
  if (_logCount > 40) { $log.removeChild($log.lastChild); _logCount--; }
  _sic($dbEvent, msg.slice(0, 45));
}
