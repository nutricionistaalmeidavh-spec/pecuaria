import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapRpc} from '../runtime/map-rpc.mjs';

function harness({withPackages=true}={}){
  const permissions=[];const audits=[];
  const presentation={services:{security:{authorize:async({permission})=>{permissions.push(permission);return{user:{id:'u1'}}}},audit:{append:async value=>audits.push(value)}}};
  const mapService={snapshot:async()=>({bounds:[-48,-22,-47,-21],pastures:[],points:[]}),savePastureGeometry:async input=>({saved:'geometry',input}),savePoint:async input=>({saved:'point',input}),removePastureGeometry:async id=>({removed:id}),removePoint:async id=>({removed:id})};
  const mapPackageManager=withPackages?{snapshot:async()=>({available:true,catalogVersion:'2026.09.1'}),refreshCatalog:async()=>({releaseVersion:'2026.09.1'}),planFarmMap:async input=>({planned:input}),installFarmMap:async input=>({installed:input}),verifyFarmMap:async input=>({verified:input}),removeFarmMap:async input=>({removed:input})}:null;
  return{permissions,audits,rpc:createMapRpc({presentation,mapService,mapPackageManager})};
}

test('state exposes cattle map and package provider',async()=>{
  const {rpc,permissions}=harness();const result=await rpc({operation:'state',auth:{sessionId:'s'}});
  assert.deepEqual(result.map.bounds,[-48,-22,-47,-21]);assert.equal(result.provider.available,true);assert.equal(permissions.at(-1),'cattle:read');
});

test('desktop package operations use stable RPC surface and settings permission',async()=>{
  const {rpc,permissions}=harness();
  assert.equal((await rpc({operation:'installFarmMap',input:{farmUnitId:'f1'},auth:{}})).installed.farmUnitId,'f1');
  assert.equal((await rpc({operation:'verifyFarmMap',input:{id:'m1'},auth:{}})).verified.id,'m1');
  assert.equal((await rpc({operation:'removeFarmMap',input:{id:'m1'},auth:{}})).removed.id,'m1');
  assert.ok(permissions.slice(-3).every(p=>p==='settings:write'));
});

test('browser runtime has explicit unavailable provider instead of missing maps method',async()=>{
  const {rpc}=harness({withPackages:false});const state=await rpc({operation:'state',auth:{}});assert.equal(state.provider.available,false);
  await assert.rejects(()=>rpc({operation:'installFarmMap',input:{},auth:{}}),error=>error.code==='MAP_UNSUPPORTED_RUNTIME');
});

test('planOffline defaults to cattle snapshot bounds',async()=>{
  const {rpc}=harness();const result=await rpc({operation:'planOffline',input:{farmUnitId:'f1'},auth:{}});assert.deepEqual(result.planned.bounds,[-48,-22,-47,-21]);
});
