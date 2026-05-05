// Supply/demand economy: one tick per in-game hour.
import { W } from './world.js';

let _ecoTimer = 0;

export function updateEconomy(gameDt) {
  _ecoTimer += gameDt;
  if (_ecoTimer < 3600) return;
  _ecoTimer -= 3600;

  for (const g of Object.values(W.eco.goods)) {
    const ratio = g.demand / Math.max(1, g.supply);
    g.price = Math.max(1, g.price * 0.9 + g.base * ratio * 0.1);
    // Open trade gives a supply bonus
    g.supply = Math.min(200, g.supply * (W.policies.trade ? 1.05 : 1.02) + 0.5);
    g.demand = Math.max(10, g.demand * 0.98);
  }

  const totalWage = W.npcs.reduce((s, n) => s + n.wage, 0);
  const taxIn     = totalWage * W.policies.tax / 24;
  const infraOut  = Math.max(0, W.eco.treasury) * W.policies.infra / 24;
  W.eco.treasury += taxIn - infraOut;
  W.eco.income    = (taxIn - infraOut) * 24;
}
