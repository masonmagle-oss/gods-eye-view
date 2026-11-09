import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApplication} from './app/application.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function entry(loader, options = {}) {
  let viewerDestroyed=false, mounted=0, disposed=0, disposedBeforeViewer=false;
  const application=createApplication({
    createScene({defer}) { defer(()=>{viewerDestroyed=true;}); return {viewer:{}}; },
    createControls:()=>({}), createData:()=>({}), createTools:()=>({}),
  });
  const source=readFileSync(new URL('./main.js',import.meta.url),'utf8')
    .replace(/^import .*?;\s*/gm,'')
    .replaceAll('import.meta.env','environment')
    .replace("import('./missions/islandSupply/index.js')", 'loadMission()')
    .replace('export { application };','return application;');
  const mount=()=>{mounted++;options.onMount?.(application);return {destroy(){disposed++;disposedBeforeViewer=!viewerDestroyed;}};};
  new Function('createStandaloneApplication','describeError','environment','window','document','console','URLSearchParams','loadMission',source)(
    ()=>application,String,{}, {location:{search:options.search ?? '?mission=island-supply'}}, {querySelector:()=>null}, {error(){}}, URLSearchParams,
    ()=>loader?loader({mountIslandSupply:mount}):Promise.resolve({mountIslandSupply:mount}),
  );
  return {application,get mounted(){return mounted;},get disposed(){return disposed;},get disposedBeforeViewer(){return disposedBeforeViewer;}};
}

test('application teardown disposes its mounted mission before the viewer',async()=>{
  const h=entry();await h.application.start();await flush();assert.equal(h.mounted,1);
  await h.application.destroy();assert.equal(h.disposed,1);assert.equal(h.disposedBeforeViewer,true);
  await h.application.destroy();assert.equal(h.disposed,1);
});

test('destroy during the mission import prevents a late mount',async()=>{
  let release;const h=entry(module=>new Promise(resolve=>{release=()=>resolve(module);}));
  await h.application.start();await flush();await h.application.destroy();release();await flush();
  assert.equal(h.mounted,0);
});


test('synchronous destruction during mount still disposes the returned mission',async()=>{
  const h=entry(null,{onMount:application=>application.destroy()});
  await h.application.start();await flush();
  assert.equal(h.mounted,1);assert.equal(h.disposed,1);assert.equal(h.disposedBeforeViewer,true);
});

test('failed optional mission import leaves the normal application usable',async()=>{
  const h=entry(()=>Promise.reject(new Error('import unavailable')));
  await h.application.start();await flush();
  assert.equal(h.application.getState().status,'ready');assert.equal(h.mounted,0);
  await h.application.destroy();assert.equal(h.disposed,0);
});

test('normal dashboard startup never imports or mounts a mission',async()=>{
  let loads=0;const h=entry(()=>{loads++;throw new Error('unexpected import');},{search:''});
  await h.application.start();await flush();assert.equal(loads,0);assert.equal(h.mounted,0);
  await h.application.destroy();
});
