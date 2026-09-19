import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const profilesUrl=new URL('../src/iot/profiles.js',import.meta.url);
const registryUrl=new URL('../src/iot/persistent-registry.js',import.meta.url);
const hasModules=existsSync(fileURLToPath(profilesUrl))&&existsSync(fileURLToPath(registryUrl));
const profiles=hasModules?await import(profilesUrl):null;
const registryModule=hasModules?await import(registryUrl):null;

function createMemoryPersistence(){
  const collections=new Map();
  const bucket=name=>{if(!collections.has(name))collections.set(name,new Map());return collections.get(name)};
  return{
    async putRecord(collection,id,payload,{expectedVersion}={}){
      const b=bucket(collection),current=b.get(id),version=current?.version??0;
      if(expectedVersion!==undefined&&expectedVersion!==version)throw new Error('Version conflict');
      const record={id,payload:structuredClone(payload),version:version+1,deleted:false};b.set(id,record);return structuredClone(record);
    },
    async getRecord(collection,id){const r=bucket(collection).get(id);return !r||r.deleted?null:structuredClone(r)},
    async listRecords(collection){return [...bucket(collection).values()].filter(r=>!r.deleted).map(r=>structuredClone(r))},
    async softDeleteRecord(collection,id){const b=bucket(collection),r=b.get(id);if(!r)return false;b.set(id,{...r,deleted:true,version:r.version+1});return true;}
  };
}

function createSecretStore(){
  const values=new Map();
  return{
    async set(key,value){values.set(key,structuredClone(value));},
    async get(key){return values.has(key)?structuredClone(values.get(key)):null;},
    async delete(key){values.delete(key);},
    raw:values
  };
}

test('P1 exposes persistent registry and device profiles',()=>{
  assert.equal(hasModules,true);
});

test('profiles validate Serial, MQTT and HTTP configurations',{skip:!hasModules},()=>{
  const serial=profiles.validateDeviceDefinition({id:'scale-1',name:'Balança 1',profileId:'serial-scale',stationId:'curral-a',config:{port:'COM4',baudRate:9600}});
  assert.equal(serial.transport,'serial');
  assert.equal(serial.kind,'scale');
  assert.equal(serial.config.port,'COM4');
  assert.throws(()=>profiles.validateDeviceDefinition({id:'bad',name:'Sem porta',profileId:'serial-rfid',config:{}}),/port/i);

  const mqtt=profiles.validateDeviceDefinition({id:'rfid-mqtt',name:'RFID MQTT',profileId:'mqtt-rfid',config:{url:'mqtt://192.168.1.20:1883',topics:['curral/rfid'],username:'fazenda',password:'segredo'}});
  assert.equal(mqtt.transport,'mqtt');
  assert.deepEqual(mqtt.config.topics,['curral/rfid']);
  assert.throws(()=>profiles.validateDeviceDefinition({id:'bad-http',name:'HTTP',profileId:'http-scale',config:{baseUrl:'ftp://x'}}),/http/i);
});

test('persistent registry survives recreation and never exposes stored secrets',{skip:!hasModules},async()=>{
  const persistence=createMemoryPersistence(),secretStore=createSecretStore();
  const registry=registryModule.createPersistentDeviceRegistry({persistence,secretStore});
  await registry.saveDevice({id:'mqtt-scale-1',name:'Balança MQTT',profileId:'mqtt-scale',stationId:'curral-a',enabled:true,config:{url:'mqtt://10.0.0.2:1883',topics:['peso'],username:'operador',password:'senha-local'}});

  const listed=await registry.listDevices();
  assert.equal(listed.length,1);
  assert.equal(listed[0].config.username,'operador');
  assert.equal(listed[0].config.password,undefined);
  assert.equal(JSON.stringify(listed).includes('senha-local'),false);

  const recreated=registryModule.createPersistentDeviceRegistry({persistence,secretStore});
  const resolved=await recreated.resolveDevice('mqtt-scale-1');
  assert.equal(resolved.config.password,'senha-local');
  assert.equal(resolved.stationId,'curral-a');
});

test('RFID bindings persist independently of device definitions',{skip:!hasModules},async()=>{
  const persistence=createMemoryPersistence();
  const registry=registryModule.createPersistentDeviceRegistry({persistence,secretStore:createSecretStore()});
  await registry.bindRfid({tagId:' 982000411823945 ',animalId:'animal-42'});
  assert.deepEqual(await registry.findRfid('982000411823945'),{tagId:'982000411823945',animalId:'animal-42'});
  assert.equal((await registry.listRfidBindings()).length,1);
  await registry.unbindRfid('982000411823945');
  assert.equal(await registry.findRfid('982000411823945'),null);
});
