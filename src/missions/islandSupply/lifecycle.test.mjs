import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from 'cesium';
import * as rules from './rules.js';

// Exercise the mounted controller with a deterministic browser clock. Cesium
// entities and mission rules are real; only DOM, events and scheduling are fake.
function harness() {
  const document = new EventTarget(), window = new EventTarget();
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: id === '#is-target' ? 'north' : '', checked: true,
      children: [{}], classList: { toggle() {} },
      querySelector: node, querySelectorAll: () => [], setAttribute() {},
      remove() { this.removed = true; },
    });
    return nodes.get(id);
  }
  const panel = node('panel');
  document.createElement = () => panel;
  document.body = { appendChild() {} };
  document.hidden = false;
  let now = 0, interval, clears = 0;
  const saved = new Map();
  const viewer = {
    dataSources: { add() {}, remove() {} },
    camera: { flyTo() {} }, clock: { currentTime: C.JulianDate.now() },
    scene: { requestRender() {} }, isDestroyed: () => false,
    selectedEntityChanged: { addEventListener: () => () => {} },
  };
  const code = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export function mountIslandSupply', 'function mountIslandSupply');
  const names = ['C', ...Object.keys(rules), 'setOverlayEntries', 'clearOverlaySource', 'document', 'window', 'performance', 'localStorage', 'setInterval', 'clearInterval'];
  const mount = new Function(...names, code + '\nreturn mountIslandSupply;')(
    C, ...Object.values(rules), () => {}, () => {}, document, window,
    { now: () => now },
    { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    fn => { interval = fn; return 1; }, () => { clears++; },
  );
  const controller = mount(viewer);
  return {
    start: () => node('#is-pause').onclick(),
    advance(ms, fire = true) { now += ms; if (fire) interval(); },
    visibility(hidden) { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); },
    pagehide(persisted) { const event = new Event('pagehide'); event.persisted = persisted; window.dispatchEvent(event); },
    snapshot() { controller.destroy(); return JSON.parse(saved.get('gev-island-supply-v2')); },
    readSaved: () => JSON.parse(saved.get('gev-island-supply-v2')),
    panel, node, controller, get clears() { return clears; },
  };
}

test('returning after throttled hidden timers does not charge hidden mission time', () => {
  const h = harness();
  h.start(); h.advance(1000);
  h.visibility(true); h.advance(60000, false); h.visibility(false);
  h.advance(500);
  assert.equal(h.snapshot().time, 1.5);
});

test('visibility transitions preserve manual pause and existing cargo/save state', () => {
  const h = harness();
  h.node('#is-dispatch').onclick();
  h.visibility(true); h.advance(60000, false); h.visibility(false); h.advance(500);
  const s = h.snapshot();
  assert.equal(s.time, 0);
  assert.equal(s.units[0].phase, 'outbound');
  assert.equal(s.units[0].cargo, 15);
  assert.equal(s.economy.money, 1110);
});

test('cached pagehide saves and pauses without destroying the mounted mission', () => {
  const h = harness(); h.start(); h.advance(1000); h.pagehide(true);
  assert.equal(h.readSaved().time, 1);
  assert.equal(h.panel.removed, undefined);
  assert.equal(h.clears, 0);
  h.advance(60000); assert.match(h.node('#is-time').textContent, /paused/);
  h.start(); h.advance(500);
  assert.equal(h.snapshot().time, 1.5);
  assert.equal(h.clears, 1);
});
