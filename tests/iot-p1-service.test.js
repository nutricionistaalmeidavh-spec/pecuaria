import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const serviceUrl=new URL('../src/iot/service.js',import.meta.url);
const secretStoreUrl=new URL('../runtime/iot/secret-store.mjs',import.meta.url);
const hasService=existsSync(fileURLToPath(serviceUrl));
const hasSecretStore=existsSync(fileURLToPath(secretStoreUrl));
const serviceModule=hasService?await import(serviceUrl):null;

function createMemoryPersistence(){
  const collections=new Map();
  const bucket=name=>{if(!collections.has(name))collections.set(name,new Map());return collections.get(name)};
  return{
    async putRecord(collection,id,payload,{expectedVersion}={}){const b=bucket(collection),cur=b.get(id),version=cur?.version??0;if(expectedVersion!==undefined&&expectedVersion!==version)throw new Error('Version conflict');const r={id,payload:structuredClone(payload),version:version+1,deleted:false};b.set(id,r);return structuredClone(r)},
    async getRecord(collection,id){const r=bucket(collection).get(id);return !r||r.deleted?null:structuredClone(r)},
    async listRecords(collection){return[...bucket(collection).values()].filter(r=>!r.deleted).map(r=>structuredClone(r))},
    async softDeleteRecord(collection,id){const b=bucket(collection),r=b.get(id);if(!r)return false;b.set(id,{...r,deleted:true,version:r.version+1});return true;}
  };
}
function createSecretStore(){const values=new Map();return{set:async(k,v)=>values.set(k,structuredClone(v)),get:async k=>values.has(k)?structuredClone(values.get(k)):null,delete:async k=>values.delete(k)};}
function createAnimalRepo(seed){const map=new Map(Object.entries(seed).map(([id,payload])=>[id,{id,payload:structuredClone(payload),version:1}]));return{async get(id){const r=map.get(id);return r?structuredClone(r):null},async save(entity,{expectedVersion}={}){const cur=map.get(entity.id);assert.equal(cur.version,expectedVersion);const r={id:entity.id,payload:structuredClone(entity),version:cur.version+1};map.set(entity.id,r);return structuredClone(r)},map};}
const animal=id=>({id,tag:`TAG-${id}`,farmUnitId:'fazenda-1',purpose:'beef',lotId:null,sex:'unknown',status:'active',weights:[],milkRecords:[],metadata:{}});

test('P1 exposes integrated IoT service and encrypted local secret store',()=>{assert.equal(hasService,true);assert.equal(hasSecretStore,true)});

test('simulators exercise the full RFID to cattle weighing flow without hardware',{skip:!hasService},async()=>{
  const persistence=createMemoryPersistence(),animals=createAnimalRepo({a1:animal('a1')}),audit=[];
  const service=serviceModule.createIoTService({persistence,animals,secretStore:createSecretStore(),audit:{append:async e=>audit.push(e)}});
  await service.saveDevice({id:'sim-rfid',name:'RFID teste',profileId:'simulator-rfid',stationId:'curral-1',enabled:true,config:{}});
  await service.saveDevice({id:'sim-scale',name:'Balança teste',profileId:'simulator-scale',stationId:'curral-1',enabled:true,config:{}});
  await service.bindRfid({tagId:'982000411823945',animalId:'a1'});

  await service.startDevice('sim-rfid');
  await service.startDevice('sim-scale');
  const identified=await service.simulateRfid({deviceId:'sim-rfid',tagId:'982000411823945'});
  const weighed=await service.simulateWeight({deviceId:'sim-scale',value:487.4,unit:'kg',stable:true});
  assert.equal(identified.type,'animal-selected');
  assert.equal(weighed.type,'weight-recorded');
  assert.equal(weighed.animalId,'a1');
  assert.equal(animals.map.get('a1').payload.weights.at(-1).weightKg,487.4);
  assert.equal(audit.some(e=>e.action==='iot.weight.record'),true);
});

test('service load exposes profiles, device status and bindings but not secrets',{skip:!hasService},async()=>{
  const service=serviceModule.createIoTService({persistence:createMemoryPersistence(),animals:createAnimalRepo({}),secretStore:createSecretStore()});
  await service.saveDevice({id:'mqtt-rfid',name:'RFID curral',profileId:'mqtt-rfid',stationId:'c1',config:{url:'mqtt://192.168.1.20:1883',topics:['curral/rfid'],username:'local',password:'nao-expor'}});
  await service.bindRfid({tagId:'123',animalId:'a1'});
  const data=await service.load();
  assert.equal(data.rows.length,1);
  assert.equal(data.rows[0].status,'disconnected');
  assert.equal(JSON.stringify(data).includes('nao-expor'),false);
  assert.equal(data.bindings[0].animalId,'a1');
  assert.equal(data.profiles.some(p=>p.id==='serial-scale'),true);
  assert.equal(data.profiles.some(p=>p.id==='simulator-rfid'),true);
});

test('startEnabled tolerates an unavailable customer device instead of crashing the product',{skip:!hasService},async()=>{
  const persistence=createMemoryPersistence();
  const service=serviceModule.createIoTService({persistence,animals:createAnimalRepo({}),secretStore:createSecretStore(),drivers:{listSerialPorts:async()=>[],connectorFactory:async()=>({status:'disconnected',onData(){return()=>{}},async connect(){throw new Error('COM4 unavailable')},async disconnect(){}})}});
  await service.saveDevice({id:'real-scale',name:'Balança',profileId:'serial-scale',stationId:'curral',enabled:true,config:{port:'COM4',baudRate:9600}});
  const results=await service.startEnabled();
  assert.equal(results.length,1);
  assert.equal(results[0].ok,false);
  assert.match(results[0].error,/COM4 unavailable/);
  assert.equal(service.getStatus('real-scale').status,'error');
});
