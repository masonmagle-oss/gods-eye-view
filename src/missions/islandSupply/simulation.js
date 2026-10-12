export const hubs = [
  { id: 'base', name: 'Command Hub', lon: -157.9, lat: 21.3 },
  { id: 'north', name: 'North Training Hub', lon: -159.4, lat: 21.98 },
  { id: 'east', name: 'East Training Hub', lon: -156.47, lat: 20.89 },
];
export function fresh() {
  return {
    v: 1,
    time: 0,
    supply: 400,
    delivered: { north: 0, east: 0 },
    units: Array.from({ length: 6 }, (_, id) => ({
      id,
      kind: id < 3 ? 'aircraft' : 'vessel',
      phase: 'idle',
      target: null,
      cargo: 0,
      t: 0,
      duration: 0,
      repeat: true,
    })),
    complete: false,
  };
}
export function valid(s) {
  return (
    !!s &&
    s.v === 1 &&
    Number.isFinite(s.time) &&
    s.time >= 0 &&
    Number.isFinite(s.supply) &&
    s.supply >= 0 &&
    s.supply <= 400 &&
    s.delivered &&
    ['north', 'east'].every(
      (k) => Number.isFinite(s.delivered[k]) && s.delivered[k] >= 0,
    ) &&
    Array.isArray(s.units) &&
    s.units.length === 6 &&
    s.units.every(
      (u, i) =>
        u.id === i &&
        u.kind === (i < 3 ? 'aircraft' : 'vessel') &&
        ['idle', 'outbound', 'queued', 'unloading', 'returning'].includes(
          u.phase,
        ) &&
        [null, 'north', 'east'].includes(u.target) &&
        Number.isFinite(u.cargo) &&
        u.cargo >= 0 &&
        u.cargo <= (i < 3 ? 15 : 30) &&
        Number.isFinite(u.t) &&
        u.t >= 0 &&
        Number.isFinite(u.duration) &&
        u.duration >= 0,
    )
  );
}
export function dispatch(s, id, target, repeat = true) {
  const u = s.units[id];
  if (
    !u ||
    u.phase !== 'idle' ||
    !['north', 'east'].includes(target) ||
    s.supply <= 0
  )
    return false;
  u.target = target;
  u.repeat = repeat;
  u.cargo = Math.min(u.kind === 'aircraft' ? 15 : 30, s.supply);
  s.supply -= u.cargo;
  u.phase = 'outbound';
  u.t = 0;
  u.duration =
    (u.kind === 'aircraft' ? 60 : 120) * (target === 'north' ? 1.15 : 1);
  return true;
}
export function recall(s, id) {
  if (s.units[id]) s.units[id].repeat = false;
}
export function tick(s, seconds) {
  let left = Math.max(0, Math.min(5, seconds));
  while (left > 1e-8) {
    const dt = Math.min(0.25, left);
    left -= dt;
    s.time += dt;
    for (const u of s.units) {
      if (u.phase === 'idle') continue;
      u.t += dt;
      if (u.phase === 'outbound' && u.t >= u.duration) {
        u.phase = 'queued';
        u.t = 0;
      } else if (u.phase === 'unloading' && u.t >= 5) {
        s.delivered[u.target] += u.cargo;
        u.cargo = 0;
        u.phase = 'returning';
        u.t = 0;
      } else if (u.phase === 'returning' && u.t >= u.duration) {
        u.phase = 'idle';
        u.t = 0;
        if (u.repeat) dispatch(s, u.id, u.target, true);
      }
    }
    for (const target of ['north', 'east'])
      if (
        !s.units.some((u) => u.target === target && u.phase === 'unloading')
      ) {
        const q = s.units
          .filter((u) => u.target === target && u.phase === 'queued')
          .sort((a, b) => b.t - a.t || a.id - b.id)[0];
        if (q) {
          q.phase = 'unloading';
          q.t = 0;
        }
      }
    s.complete = s.delivered.north >= 100 && s.delivered.east >= 100;
  }
}
export function position(u) {
  const a = hubs[0],
    b = hubs.find((h) => h.id === u.target) || a;
  const p =
    u.phase === 'outbound'
      ? Math.min(1, u.t / Math.max(0.1, u.duration))
      : u.phase === 'returning'
        ? 1 - Math.min(1, u.t / Math.max(0.1, u.duration))
        : ['queued', 'unloading'].includes(u.phase)
          ? 1
          : 0;
  return {
    lon: a.lon + (b.lon - a.lon) * p,
    lat: a.lat + (b.lat - a.lat) * p,
    height: u.kind === 'aircraft' ? 1200 : 30,
  };
}
export function conservation(s) {
  return (
    s.supply +
    s.delivered.north +
    s.delivered.east +
    s.units.reduce((n, u) => n + u.cargo, 0)
  );
}
