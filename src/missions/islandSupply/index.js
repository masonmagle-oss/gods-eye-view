import * as C from 'cesium';
import {
  hubs,
  fresh,
  valid,
  dispatch,
  recall,
  tick,
  position,
  quote,
  blocked,
  buyFuel,
  CONTRACTS,
} from './rules.js';
export function mountIslandSupply(viewer) {
  const key = 'gev-island-supply-v2';
  let state = fresh(),
    selected = 0,
    paused = true,
    last = performance.now(),
    lastSave = 0,
    closed = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (valid(saved)) state = saved;
  } catch {}
  const source = new C.CustomDataSource('SIMULATED Island Supply');
  viewer.dataSources.add(source);
  const panel = document.createElement('section');
  panel.id = 'island-supply';
  panel.setAttribute('aria-label', 'Fictional logistics game');
  panel.innerHTML = `<style>#island-supply{position:fixed;z-index:500;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));width:min(380px,calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));max-height:calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;box-sizing:border-box;padding:15px;border-radius:12px;border:1px solid #72b5c8;background:#091c2ff2;color:#e5f5ff;font:14px system-ui}#island-supply h2{font-size:19px;margin:7px 0}#island-supply p,#island-supply small{font-size:12px;line-height:1.5}#island-supply button,#island-supply select{font:inherit;min-height:44px;padding:8px;margin:3px;border:1px solid #528397;border-radius:7px;background:#173b50;color:#e5f5ff}#island-supply button:disabled{opacity:.45}#island-supply button:focus-visible{outline:3px solid #ffd18d}#island-supply .selected{border-color:#b6f7ff;background:#25576b}#island-supply .unit{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #375569}#island-supply .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:#143044;padding:9px;border-radius:8px}#island-supply progress{width:100%;accent-color:#84e2eb;height:8px}#is-result{padding:8px;border-left:3px solid #ffc77e}#island-supply .loss{color:#ffb5ad}#island-supply .win{color:#9ce5ba}@media(max-width:650px){#island-supply{top:auto;bottom:max(12px,env(safe-area-inset-bottom));max-height:52dvh}}</style><small>FICTIONAL SIMULATION / ACCELERATED TIME</small><h2>Island Supply</h2><label>Contract <select id='is-contract'>${Object.entries(
    CONTRACTS,
  )
    .map(([id, c]) => `<option value='${id}'>${c.name}</option>`)
    .join(
      '',
    )}</select></label><button id='is-new'>New contract</button><p id='is-brief'></p><div class='stats'><span>Time<br><strong id='is-time'></strong></span><span>Cash<br><strong id='is-cash'></strong></span><span>Fuel<br><strong id='is-fuel'></strong></span></div><div id='is-result' role='status' aria-live='polite'></div><div id='is-goals'></div><p id='is-supply'></p><div id='is-units'></div><label>Destination <select id='is-target'><option value='north'>North Hub</option><option value='east'>East Hub</option></select></label><label><input id='is-repeat' type='checkbox' checked> Repeat while affordable and destination needs cargo</label><p id='is-quote'></p><div><button id='is-dispatch'>Dispatch</button><button id='is-fuel-buy'>Buy 20 fuel / 60 credits</button><button id='is-recall'>Recall safely</button><button id='is-follow'>Follow</button><button id='is-overview'>Overview</button><button id='is-pause'>Start / Resume</button></div><p id='is-status' role='status' aria-live='polite'>Mission starts paused. Plan assignments before starting the clock. Fuel covers the full round trip; no unit can run dry in flight.</p>`;
  document.body.appendChild(panel);
  const q = (id) => panel.querySelector('#' + id),
    entities = new Map(),
    routes = new Map();
  q('is-contract').value = state.economy.contract;
  for (const h of hubs)
    source.entities.add({
      id: 'is-hub-' + h.id,
      position: C.Cartesian3.fromDegrees(h.lon, h.lat, 50),
      point: {
        pixelSize: 16,
        color: C.Color.GOLD,
        outlineColor: C.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Infinity,
      },
      label: {
        text: 'SIM ' + h.name,
        font: '14px sans-serif',
        pixelOffset: new C.Cartesian2(0, -24),
        showBackground: true,
        disableDepthTestDistance: Infinity,
      },
    });
  for (const u of state.units) {
    const name = (u.kind === 'aircraft' ? 'Aircraft ' : 'Vessel ') + (u.id + 1);
    entities.set(
      u.id,
      source.entities.add({
        id: 'is-unit-' + u.id,
        name: 'SIMULATED ' + name,
        point: {
          pixelSize: 13,
          color: u.kind === 'aircraft' ? C.Color.CYAN : C.Color.ORANGE,
          outlineColor: C.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Infinity,
        },
        label: {
          text: 'SIM ' + name,
          font: '12px sans-serif',
          pixelOffset: new C.Cartesian2(0, 18),
          showBackground: true,
          disableDepthTestDistance: Infinity,
        },
      }),
    );
    routes.set(
      u.id,
      source.entities.add({
        id: 'is-route-' + u.id,
        polyline: {
          positions: [],
          width: 2,
          material: C.Color.CYAN.withAlpha(0.5),
          arcType: C.ArcType.GEODESIC,
        },
      }),
    );
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      q('is-status').textContent = 'Local save unavailable; session continues.';
    }
  }
  function overview() {
    viewer.trackedEntity = undefined;
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(-157.95, 21.35, 420000),
      duration: 1.2,
    });
  }
  function render() {
    const e = state.economy,
      c = CONTRACTS[e.contract],
      u = state.units[selected],
      offer = quote(state, selected, q('is-target').value);
    q('is-brief').textContent =
      `${c.goal} cargo per hub in ${c.limit / 60} active minutes. Delivery reimbursement ${c.pay} credits/cargo. ${c.gates.map((g) => `${g.hub}: ${g.amount} by ${g.time}s`).join('; ')} ${c.reserveCash ? 'Finish with ' + c.reserveCash + ' cash and ' + c.reserveFuel + ' fuel.' : ''}`;
    q('is-time').textContent =
      `${Math.max(0, Math.ceil(c.limit - state.time))}s${paused ? ' paused' : ''}`;
    q('is-cash').textContent = e.money.toFixed(0);
    q('is-fuel').textContent = e.fuel;
    q('is-result').className =
      e.outcome === 'lost' ? 'loss' : e.outcome === 'won' ? 'win' : '';
    q('is-result').textContent =
      e.outcome === 'active'
        ? 'Contract active'
        : `${e.outcome.toUpperCase()}: ${e.reason}${e.medal ? ' Medal: ' + e.medal : ''}`;
    q('is-goals').innerHTML = ['north', 'east']
      .map(
        (id) =>
          `<div>${id}: ${state.delivered[id]} / ${c.goal}<progress max='${c.goal}' value='${Math.min(c.goal, state.delivered[id])}'></progress></div>`,
      )
      .join('');
    q('is-supply').textContent =
      `Cargo at base: ${state.supply}. Operating spend: ${e.spent}. Delivery income: ${e.income}.`;
    if (!q('is-units').children.length) {
      q('is-units').innerHTML = state.units
        .map(
          (x) =>
            `<div class='unit'><span id='is-unit-text-${x.id}'></span><button data-id='${x.id}'>Select</button></div>`,
        )
        .join('');
      q('is-units')
        .querySelectorAll('button')
        .forEach(
          (b) =>
            (b.onclick = () => {
              selected = Number(b.dataset.id);
              render();
            }),
        );
    }
    for (const x of state.units) {
      q('is-unit-text-' + x.id).textContent =
        `${x.kind} ${x.id + 1}: ${x.phase}, ${x.cargo} cargo${x.target ? ' → ' + x.target : ''}${x.phase === 'idle' && x.repeat && x.target ? ' (repeat waiting)' : ''}`;
      const b = q('is-units').querySelector(`[data-id='${x.id}']`);
      b.classList.toggle('selected', x.id === selected);
      b.textContent = x.id === selected ? 'Selected' : 'Select';
      const p = position(x),
        entity = entities.get(x.id),
        target = hubs.find((h) => h.id === x.target),
        route = routes.get(x.id);
      entity.position = C.Cartesian3.fromDegrees(p.lon, p.lat, p.height);
      entity.point.pixelSize = x.id === selected ? 19 : 13;
      entity.point.outlineWidth = x.id === selected ? 3 : 1;
      route.show = x.id === selected && x.phase !== 'idle' && !!target;
      if (target)
        route.polyline.positions = C.Cartesian3.fromDegreesArrayHeights([
          hubs[0].lon,
          hubs[0].lat,
          60,
          target.lon,
          target.lat,
          60,
        ]);
    }
    q('is-quote').textContent =
      `Dispatch: ${offer.money} credits + ${offer.fuel} fuel, reserved for round trip. First delivery about ${offer.arrival}s plus queue. ${blocked(state, selected, q('is-target').value)}`;
    q('is-dispatch').disabled = !!blocked(
      state,
      selected,
      q('is-target').value,
    );
    q('is-fuel-buy').disabled = e.outcome !== 'active' || e.money < 60;
    q('is-recall').disabled = e.outcome !== 'active';
    q('is-pause').disabled = e.outcome !== 'active';
    q('is-pause').textContent = paused ? 'Start / Resume' : 'Pause';
    viewer.scene.requestRender();
  }
  const removeSelection = viewer.selectedEntityChanged.addEventListener(
    (entity) => {
      if (typeof entity?.id === 'string' && entity.id.startsWith('is-unit-')) {
        selected = Number(entity.id.slice(8));
        render();
      }
    },
  );
  q('is-target').onchange = render;
  q('is-dispatch').onclick = () => {
    dispatch(state, selected, q('is-target').value, q('is-repeat').checked);
    q('is-status').textContent =
      'Order issued. Full-trip fuel and operating cost paid.';
    render();
    save();
  };
  q('is-fuel-buy').onclick = () => {
    buyFuel(state);
    q('is-status').textContent =
      'Fuel pack purchased. Dispatch idle units to resume routes.';
    render();
    save();
  };
  q('is-recall').onclick = () => {
    recall(state, selected);
    q('is-status').textContent =
      'Recall queued; existing cargo is delivered before return.';
    render();
    save();
  };
  q('is-follow').onclick = () =>
    (viewer.trackedEntity = entities.get(selected));
  q('is-overview').onclick = overview;
  q('is-pause').onclick = () => {
    paused = !paused;
    last = performance.now();
    render();
  };
  q('is-new').onclick = () => {
    if (
      window.confirm('Replace this mission with a fresh selected contract?')
    ) {
      state = fresh(q('is-contract').value);
      paused = true;
      selected = 0;
      last = performance.now();
      q('is-status').textContent = 'Fresh contract. Plan, then Start.';
      render();
      save();
    }
  };
  const timer = setInterval(() => {
    if (closed) return;
    const now = performance.now(),
      dt = (now - last) / 1000;
    last = now;
    if (!paused && !document.hidden) tick(state, dt);
    render();
    if (now - lastSave > 5000) {
      save();
      lastSave = now;
    }
  }, 500);
  function destroy() {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    save();
    removeSelection();
    if ([...entities.values()].includes(viewer.trackedEntity))
      viewer.trackedEntity = undefined;
    if (!viewer.isDestroyed()) viewer.dataSources.remove(source, true);
    panel.remove();
    window.removeEventListener('pagehide', destroy);
  }
  window.addEventListener('pagehide', destroy);
  overview();
  render();
  return { destroy };
}
