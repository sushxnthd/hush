import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {dashboardUrl,openLocalDashboard} from '../src/dashboard-launch.js';
test('dashboard launches stay on exact local port and never accept external or shell URLs',()=>{
  assert.equal(dashboardUrl('/dashboard/bootstrap/abc_DEF-123',9001),'http://localhost:9001/dashboard/bootstrap/abc_DEF-123');
  for(const path of ['https://evil.example/','//evil.example/','/dashboard/bootstrap/a?secret=x','/dashboard/bootstrap/a#secret','/dashboard/bootstrap/a&whoami','/'])assert.throws(()=>dashboardUrl(path,8787),/Invalid/);
});
test('missing system browser launcher reports a handled failure',async()=>{
  await assert.rejects(openLocalDashboard('/dashboard/bootstrap/opaque',8787,{spawnImpl:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',new Error('ENOENT')));return child;}}),/Could not open/);
});
test('valid dashboard launch uses argument arrays and detaches only after spawn',async()=>{
  let seen,detached=false;
  await openLocalDashboard('/dashboard/bootstrap/opaque',8787,{platform:'darwin',spawnImpl:(command,args,options)=>{seen={command,args,options};const child=new EventEmitter();child.unref=()=>detached=true;queueMicrotask(()=>child.emit('spawn'));return child;}});
  assert.equal(seen.command,'open');assert.equal(seen.args.length,1);assert.equal(seen.options.stdio,'ignore');assert.equal(detached,true);
});
