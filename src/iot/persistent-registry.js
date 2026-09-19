import {splitSensitiveConfig,validateDeviceDefinition} from './profiles.js';

const DEVICE_COLLECTION='iot.devices';
const RFID_COLLECTION='iot.rfid-bindings';
const clean=(value,field)=>{const text=String(value??'').trim();if(!text)throw new TypeError(`${field} is required`);return text;};
const payloadOf=record=>record?.payload??null;

export function createPersistentDeviceRegistry({persistence,secretStore=null}={}){
  if(!persistence?.putRecord||!persistence?.getRecord||!persistence?.listRecords)throw new TypeError('Persistence adapter is required');
  const secretKey=id=>`iot-device:${id}`;

  async function saveDevice(input){
    const validated=validateDeviceDefinition(input);
    const existing=await persistence.getRecord(DEVICE_COLLECTION,validated.id);
    const {publicConfig,secrets}=splitSensitiveConfig(validated.config);
    const secretNames=Object.keys(secrets);
    if(secretNames.length){
      if(!secretStore?.set)throw new Error('A local secret store is required for IoT credentials');
      const current=secretStore.get?await secretStore.get(secretKey(validated.id)):null;
      await secretStore.set(secretKey(validated.id),{...(current??{}),...secrets});
    }
    const payload={...validated,config:{...publicConfig},secretKeys:Object.freeze([...new Set([...(existing?.payload?.secretKeys??[]),...secretNames])])};
    const record=await persistence.putRecord(DEVICE_COLLECTION,validated.id,payload,{expectedVersion:existing?.version??0});
    return Object.freeze({...record.payload,config:Object.freeze({...record.payload.config})});
  }

  async function getDevice(id){return payloadOf(await persistence.getRecord(DEVICE_COLLECTION,clean(id,'device.id')));}
  async function listDevices(){return(await persistence.listRecords(DEVICE_COLLECTION)).map(record=>Object.freeze({...record.payload,config:Object.freeze({...record.payload.config})}));}
  async function resolveDevice(id){
    const device=await getDevice(id);if(!device)return null;
    const secrets=secretStore?.get?await secretStore.get(secretKey(device.id)):null;
    return Object.freeze({...device,config:Object.freeze({...device.config,...(secrets??{})})});
  }
  async function removeDevice(id){
    const key=clean(id,'device.id');
    const removed=await persistence.softDeleteRecord(DEVICE_COLLECTION,key);
    if(secretStore?.delete)await secretStore.delete(secretKey(key));
    return removed;
  }

  async function bindRfid({tagId,animalId}){
    const tag=clean(tagId,'rfid.tagId'),animal=clean(animalId,'rfid.animalId');
    const id=`rfid:${tag}`;const existing=await persistence.getRecord(RFID_COLLECTION,id);
    const record=await persistence.putRecord(RFID_COLLECTION,id,{tagId:tag,animalId:animal},{expectedVersion:existing?.version??0});
    return Object.freeze({...record.payload});
  }
  async function findRfid(tagId){return payloadOf(await persistence.getRecord(RFID_COLLECTION,`rfid:${clean(tagId,'rfid.tagId')}`));}
  async function listRfidBindings(){return(await persistence.listRecords(RFID_COLLECTION)).map(record=>Object.freeze({...record.payload}));}
  async function unbindRfid(tagId){return persistence.softDeleteRecord(RFID_COLLECTION,`rfid:${clean(tagId,'rfid.tagId')}`);}

  return Object.freeze({saveDevice,getDevice,listDevices,resolveDevice,removeDevice,bindRfid,findRfid,listRfidBindings,unbindRfid});
}
