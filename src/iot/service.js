import {IOT_PROFILES} from './profiles.js';
import {createPersistentDeviceRegistry} from './persistent-registry.js';
import {createDeviceManager} from './device-manager.js';
import {createCattleIoTBridge} from './cattle-bridge.js';

function createMemorySecretStore(){
  const values=new Map();
  return Object.freeze({
    async set(key,value){values.set(String(key),structuredClone(value));},
    async get(key){return values.has(String(key))?structuredClone(values.get(String(key))):null;},
    async delete(key){return values.delete(String(key));}
  });
}

const profileList=()=>Object.values(IOT_PROFILES).map(profile=>Object.freeze({...profile}));

export function createIoTService({persistence,animals,secretStore=createMemorySecretStore(),drivers=null,audit=null,correlationWindowMs=120000}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required for IoT service');
  if(!animals?.get||!animals?.save)throw new TypeError('Animal repository is required for IoT service');
  const registry=createPersistentDeviceRegistry({persistence,secretStore});
  const bridge=createCattleIoTBridge({
    registry,
    animals,
    correlationWindowMs,
    audit:async event=>{
      if(audit?.append)await audit.append({actorId:'iot-system',...event});
      else if(typeof audit==='function')await audit({actorId:'iot-system',...event});
    }
  });
  const processing=new Map();
  const manager=createDeviceManager({
    registry,
    connectorFactory:drivers?.connectorFactory??null,
    listSerialPorts:drivers?.listSerialPorts??(async()=>[]),
    onReading:event=>{
      const promise=Promise.resolve(bridge.handleReading(event));
      processing.set(event.deviceId,promise);
      promise.finally(()=>{if(processing.get(event.deviceId)===promise)processing.delete(event.deviceId);});
      return promise;
    }
  });

  async function saveDevice(input){
    const previous=await registry.getDevice(input?.id??'').catch(()=>null);
    if(previous)await manager.stopDevice(previous.id);
    return registry.saveDevice(input);
  }
  async function removeDevice(id){await manager.stopDevice(id);return registry.removeDevice(id);}
  async function listPorts(){try{return await manager.listPorts();}catch{return[];}}
  async function load(){
    const [devices,bindings,ports]=await Promise.all([registry.listDevices(),registry.listRfidBindings(),listPorts()]);
    return{
      rows:devices.map(device=>Object.freeze({...device,status:manager.getStatus(device.id).status,error:manager.getStatus(device.id).error??null})),
      bindings,
      profiles:profileList(),
      ports
    };
  }
  async function startEnabled(){
    const devices=await registry.listDevices(),results=[];
    for(const device of devices.filter(item=>item.enabled!==false)){
      try{await manager.startDevice(device.id);results.push(Object.freeze({deviceId:device.id,ok:true,status:manager.getStatus(device.id).status}));}
      catch(error){results.push(Object.freeze({deviceId:device.id,ok:false,status:manager.getStatus(device.id).status,error:error?.message??String(error)}));}
    }
    return results;
  }
  async function simulateAndWait(deviceId,payload){
    manager.simulate(deviceId,payload);
    return processing.get(String(deviceId))??null;
  }
  async function simulateRfid({deviceId,tagId}){return simulateAndWait(deviceId,{tagId});}
  async function simulateWeight({deviceId,value,unit='kg',stable=true}){return simulateAndWait(deviceId,{value,unit,stable});}

  return Object.freeze({
    registry,
    manager,
    bridge,
    load,
    saveDevice,
    removeDevice,
    testDevice:id=>manager.testDevice(id),
    startDevice:id=>manager.startDevice(id),
    stopDevice:id=>manager.stopDevice(id),
    getStatus:id=>manager.getStatus(id),
    listPorts,
    bindRfid:input=>registry.bindRfid(input),
    unbindRfid:tagId=>registry.unbindRfid(tagId),
    simulateRfid,
    simulateWeight,
    startEnabled,
    shutdown:()=>manager.stopAll()
  });
}
