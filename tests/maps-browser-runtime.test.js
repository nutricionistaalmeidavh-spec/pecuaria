import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserMapsRuntime} from '../web/maps/browser-runtime.js';

const service={snapshot:async()=>({bounds:null,pastures:[],points:[]}),savePastureGeometry:async input=>({kind:'geometry',input}),savePoint:async input=>({kind:'point',input}),removePastureGeometry:async id=>({removed:id}),removePoint:async id=>({removed:id})};

test('browser maps runtime exposes spatial CRUD and explicit desktop-only provider',async()=>{
  const maps=createBrowserMapsRuntime({mapService:service});
  const state=await maps({operation:'state'});assert.equal(state.provider.available,false);assert.equal(state.provider.platform,'browser');
  assert.equal((await maps({operation:'savePoint',input:{id:'p1'}})).kind,'point');
  assert.equal((await maps({operation:'removePoint',input:{id:'p1'}})).removed,'p1');
});

test('browser maps runtime rejects package lifecycle with stable code',async()=>{
  const maps=createBrowserMapsRuntime({mapService:service});
  for(const operation of ['refreshCatalog','planOffline','installFarmMap','verifyFarmMap','removeFarmMap'])await assert.rejects(()=>maps({operation,input:{}}),error=>error.code==='MAP_UNSUPPORTED_RUNTIME');
});
