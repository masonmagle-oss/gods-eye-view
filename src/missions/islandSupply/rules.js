import * as core from './simulation.js';
export const { hubs, position, conservation } = core;
export const CONTRACTS = {
  relief: {
    name: 'Emergency Relief',
    limit: 420,
    goal: 100,
    cash: 1200,
    fuel: 80,
    pay: 3,
    gates: [
      { hub: 'north', amount: 30, time: 120 },
      { hub: 'east', amount: 30, time: 180 },
    ],
    reserveCash: 0,
    reserveFuel: 0,
  },
  rapid: {
    name: 'Rapid Response',
    limit: 300,
    goal: 80,
    cash: 900,
    fuel: 70,
    pay: 4,
    gates: [],
    reserveCash: 0,
    reserveFuel: 0,
  },
  economy: {
    name: 'Lean Operations',
    limit: 600,
    goal: 80,
    cash: 1200,
    fuel: 80,
    pay: 4,
    gates: [],
    reserveCash: 1000,
    reserveFuel: 20,
  },
};
export function fresh(contract = 'relief') {
  if (!CONTRACTS[contract]) contract = 'relief';
  const s = core.fresh(),
    c = CONTRACTS[contract];
  s.economy = {
    contract,
    money: c.cash,
    fuel: c.fuel,
    spent: 0,
    fuelBought: 0,
    income: 0,
    outcome: 'active',
    reason: '',
    medal: null,
  };
  return s;
}
export function valid(s) {
  const e = s?.economy;
  return (
    core.valid(s) &&
    e &&
    CONTRACTS[e.contract] &&
    ['money', 'fuel', 'spent', 'fuelBought', 'income'].every(
      (k) => Number.isFinite(e[k]) && e[k] >= 0,
    ) &&
    ['active', 'won', 'lost'].includes(e.outcome)
  );
}
export function quote(s, id, target) {
  const u = s.units[id];
  if (!u || !['north', 'east'].includes(target)) return null;
  return {
    money: u.kind === 'aircraft' ? 90 : 55,
    fuel: u.kind === 'aircraft' ? 18 : 10,
    arrival:
      (u.kind === 'aircraft' ? 60 : 120) * (target === 'north' ? 1.15 : 1) + 5,
  };
}
export function blocked(s, id, target) {
  const e = s.economy,
    q = quote(s, id, target);
  if (e.outcome !== 'active') return 'Mission has ended.';
  if (!q) return 'Choose a valid unit and destination.';
  if (s.units[id].phase !== 'idle')
    return 'Unit is busy; recall finishes its delivery.';
  if (s.supply <= 0) return 'No cargo remains at base.';
  if (e.money < q.money) return 'Insufficient cash for dispatch.';
  if (e.fuel < q.fuel) return 'Insufficient fuel; buy a 20-unit fuel pack.';
  return '';
}
export function dispatch(s, id, target, repeat = true) {
  if (blocked(s, id, target)) return false;
  const q = quote(s, id, target);
  if (!core.dispatch(s, id, target, repeat)) return false;
  s.economy.money -= q.money;
  s.economy.spent += q.money;
  s.economy.fuel -= q.fuel;
  return true;
}
export function recall(s, id) {
  core.recall(s, id);
}
function finish(s, outcome, reason) {
  const e = s.economy;
  e.outcome = outcome;
  e.reason = reason;
  if (outcome === 'won') {
    const c = CONTRACTS[e.contract];
    e.medal =
      e.money >= c.cash && e.fuel >= 20
        ? 'gold'
        : s.time < c.limit * 0.8
          ? 'silver'
          : 'bronze';
  }
  s.complete = outcome === 'won';
}
export function evaluate(s) {
  const e = s.economy,
    c = CONTRACTS[e.contract];
  if (e.outcome !== 'active') return;
  for (const gate of c.gates)
    if (s.time >= gate.time && s.delivered[gate.hub] < gate.amount) {
      finish(s, 'lost', 'Missed ' + gate.hub + ' emergency delivery deadline.');
      return;
    }
  const supplied = ['north', 'east'].every((k) => s.delivered[k] >= c.goal);
  if (supplied && e.money >= c.reserveCash && e.fuel >= c.reserveFuel) {
    finish(s, 'won', c.name + ' completed.');
    return;
  }
  if (s.time >= c.limit) {
    finish(
      s,
      'lost',
      supplied
        ? 'Time expired before required cash/fuel reserves were secured.'
        : 'Mission clock expired before both hubs were supplied.',
    );
    return;
  }
  const missing = ['north', 'east'].reduce(
    (n, k) => n + Math.max(0, c.goal - s.delivered[k]),
    0,
  );
  const inbound = ['north', 'east'].reduce(
    (n, k) =>
      n +
      Math.min(
        Math.max(0, c.goal - s.delivered[k]),
        s.units.filter((u) => u.target === k).reduce((v, u) => v + u.cargo, 0),
      ),
    0,
  );
  if (s.supply + inbound < missing) {
    finish(
      s,
      'lost',
      'Cargo exhausted or committed to the wrong hub; remaining objectives cannot be met.',
    );
    return;
  }
  if (
    supplied &&
    e.money >=
      c.reserveCash + Math.ceil(Math.max(0, c.reserveFuel - e.fuel) / 20) * 60
  )
    return;
  if (!s.units.some((u) => u.phase !== 'idle')) {
    const possible =
      s.supply > 0 &&
      s.units.some((u) => {
        const q = quote(s, u.id, 'east'),
          packs = Math.ceil(Math.max(0, q.fuel - e.fuel) / 20);
        return e.money >= q.money + packs * 60;
      });
    if (!possible) {
      const fees = s.units.some((u) => e.money >= quote(s, u.id, 'east').money);
      finish(
        s,
        'lost',
        fees
          ? 'Fuel exhausted with no affordable refuel-and-dispatch plan.'
          : 'Operating budget exhausted with no deliveries in transit.',
      );
    }
  }
}
export function buyFuel(s) {
  const e = s.economy;
  if (e.outcome !== 'active' || e.money < 60) return false;
  e.money -= 60;
  e.spent += 60;
  e.fuel += 20;
  e.fuelBought += 20;
  evaluate(s);
  return true;
}
export function tick(s, seconds) {
  let left = Math.max(0, Math.min(5, seconds));
  while (left > 1e-8 && s.economy.outcome === 'active') {
    const dt = Math.min(0.25, left);
    left -= dt;
    const phases = s.units.map((u) => u.phase),
      repeat = s.units.map((u) => u.repeat),
      before = s.delivered.north + s.delivered.east;
    for (const u of s.units) u.repeat = false;
    core.tick(s, dt);
    s.units.forEach((u, i) => (u.repeat = repeat[i]));
    const income =
      (s.delivered.north + s.delivered.east - before) *
      CONTRACTS[s.economy.contract].pay;
    s.economy.money += income;
    s.economy.income += income;
    s.complete = false;
    evaluate(s);
    if (s.economy.outcome !== 'active') break;
    for (const u of s.units)
      if (
        phases[u.id] === 'returning' &&
        u.phase === 'idle' &&
        u.repeat &&
        s.delivered[u.target] < CONTRACTS[s.economy.contract].goal
      )
        dispatch(s, u.id, u.target, true);
    evaluate(s);
  }
}
