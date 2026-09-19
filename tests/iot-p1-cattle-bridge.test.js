import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const bridgeUrl=new URL('../src/iot/cattle-bridge.js',import.meta.url);
const hasBridge=existsSync(fileURLToPath(bridgeUrl));
const bridgeModule=hasBridge?await import(bridgeUrl):null;

function animalRepo(seed){
  const records=new Map(Object.entries(seed).map(([id,payload])=>[id,{id,payload:structuredClone(payload),version:1}]));
  const saves=[];
  return{
    async get(id){const record=records.get(id);return record?structuredClone(record):null},
    async save(entity,{expectedVersion}={}){const current=records.get(entity.id);assert.equal(current.version,expectedVersion);const record={id:entity.id,payload:structuredClone(entity),version:current.version+1};records.set(entity.id,record);saves.push(structuredClone(record));return structuredClone(record)},
    records,saves
  };
}

const animal=id=>({id,tag:`TAG-${id}`,farmUnitId:'fazenda-1',purpose:'beef',lotId:null,sex:'unknown',status:'active',weights:[],milkRecords:[],metadata:{}});

function registry(bindings){return{findRfid:async tagId=>bindings[tagId]?{tagId,animalId:bindings[tagId]}:null};}
const rfid=(stationId,tagId,receivedAt='2026-09-19T18:00:00-03:00')=>({deviceId:`rfid-${stationId}`,stationId,receivedAt,reading:{kind:'rfid',tagId}});
const weight=(stationId,value,{stable=true,unit='kg',receivedAt='2026-09-19T18:00:05-03:00'}={})=>({deviceId:`scale-${stationId}`,stationId,receivedAt,reading:{kind:'weight',value,unit,stable}});

test('P1 exposes cattle IoT bridge',()=>assert.equal(hasBridge,true));

test('bound RFID selects an animal only inside its station',{skip:!hasBridge},async()=>{
  const repo=animalRepo({a1:animal('a1'),a2:animal('a2')});
  const bridge=bridgeModule.createCattleIoTBridge({registry:registry({'111':'a1','222':'a2'}),animals:repo,now:()=>new Date('2026-09-19T21:00:00Z').getTime()});
  assert.equal((await bridge.handleReading(rfid('curral-a','111'))).animalId,'a1');
  assert.equal((await bridge.handleReading(rfid('curral-b','222'))).animalId,'a2');
  assert.equal(bridge.getStationContext('curral-a').animalId,'a1');
  assert.equal(bridge.getStationContext('curral-b').animalId,'a2');
});

test('unknown RFID clears station context and cannot weigh the previous animal',{skip:!hasBridge},async()=>{
  const repo=animalRepo({a1:animal('a1')});
  const bridge=bridgeModule.createCattleIoTBridge({registry:registry({'111':'a1'}),animals:repo,now:()=>new Date('2026-09-19T21:00:00Z').getTime()});
  await bridge.handleReading(rfid('curral-a','111'));
  const unknown=await bridge.handleReading(rfid('curral-a','999'));
  assert.equal(unknown.type,'rfid-unbound');
  assert.equal(bridge.getStationContext('curral-a'),null);
  const result=await bridge.handleReading(weight('curral-a',480));
  assert.equal(result.reason,'no-animal');
  assert.equal(repo.saves.length,0);
});

test('unstable weight is never persisted',{skip:!hasBridge},async()=>{
  const repo=animalRepo({a1:animal('a1')});
  const bridge=bridgeModule.createCattleIoTBridge({registry:registry({'111':'a1'}),animals:repo,now:()=>new Date('2026-09-19T21:00:00Z').getTime()});
  await bridge.handleReading(rfid('curral-a','111'));
  const result=await bridge.handleReading(weight('curral-a',477.2,{stable:false}));
  assert.equal(result.reason,'unstable');
  assert.equal(repo.saves.length,0);
  assert.equal(bridge.getStationContext('curral-a').animalId,'a1');
});

test('stable weight persists on the bound animal and consumes station context',{skip:!hasBridge},async()=>{
  const repo=animalRepo({a1:animal('a1')});
  const audits=[];
  let clock=new Date('2026-09-19T21:00:00Z').getTime();
  const bridge=bridgeModule.createCattleIoTBridge({registry:registry({'111':'a1'}),animals:repo,audit:event=>audits.push(event),now:()=>clock});
  await bridge.handleReading(rfid('curral-a','111'));
  clock+=5000;
  const result=await bridge.handleReading(weight('curral-a',481.7));
  assert.equal(result.type,'weight-recorded');
  assert.equal(result.animalId,'a1');
  assert.equal(repo.saves.length,1);
  assert.equal(repo.saves[0].payload.weights[0].weightKg,481.7);
  assert.equal(bridge.getStationContext('curral-a'),null);
  assert.equal(audits[0].action,'iot.weight.record');
});

test('station correlation expires and units are converted to kilograms',{skip:!hasBridge},async()=>{
  const repo=animalRepo({a1:animal('a1')});
  let clock=1000;
  const bridge=bridgeModule.createCattleIoTBridge({registry:registry({'111':'a1'}),animals:repo,now:()=>clock,correlationWindowMs:100});
  await bridge.handleReading({deviceId:'r',stationId:'a',receivedAt:new Date(clock).toISOString(),reading:{kind:'rfid',tagId:'111'}});
  clock=1201;
  const expired=await bridge.handleReading({deviceId:'s',stationId:'a',receivedAt:new Date(clock).toISOString(),reading:{kind:'weight',value:1000,unit:'g',stable:true}});
  assert.equal(expired.reason,'expired');
  assert.equal(repo.saves.length,0);

  clock=1300;
  await bridge.handleReading({deviceId:'r',stationId:'a',receivedAt:new Date(clock).toISOString(),reading:{kind:'rfid',tagId:'111'}});
  clock=1350;
  await bridge.handleReading({deviceId:'s',stationId:'a',receivedAt:new Date(clock).toISOString(),reading:{kind:'weight',value:1000,unit:'g',stable:true}});
  assert.equal(repo.saves.at(-1).payload.weights.at(-1).weightKg,1);
});
