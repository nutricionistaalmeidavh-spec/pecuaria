import {recordWeight} from '../index.js';

const stationKey=event=>String(event?.stationId??event?.deviceId??'').trim();
const kilograms=(value,unit='kg')=>{
  const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new TypeError('IoT weight must be positive');
  const normalized=String(unit??'kg').toLowerCase();
  if(normalized==='kg')return number;
  if(normalized==='g')return number/1000;
  if(normalized==='lb'||normalized==='lbs')return number*0.45359237;
  throw new TypeError(`Unsupported weight unit: ${unit}`);
};

export function createCattleIoTBridge({registry,animals,audit=async()=>{},now=()=>Date.now(),correlationWindowMs=120000}={}){
  if(!registry?.findRfid)throw new TypeError('RFID registry is required');
  if(!animals?.get||!animals?.save)throw new TypeError('Animal repository is required');
  if(!Number.isFinite(correlationWindowMs)||correlationWindowMs<=0)throw new TypeError('correlationWindowMs must be positive');
  const contexts=new Map();

  const getStationContext=stationId=>contexts.get(String(stationId))??null;

  async function handleRfid(event,key){
    const tagId=String(event.reading.tagId??'').trim();
    const binding=tagId?await registry.findRfid(tagId):null;
    if(!binding){contexts.delete(key);return Object.freeze({type:'rfid-unbound',stationId:key,tagId});}
    const record=await animals.get(binding.animalId);
    if(!record){contexts.delete(key);return Object.freeze({type:'rfid-animal-missing',stationId:key,tagId,animalId:binding.animalId});}
    const context=Object.freeze({stationId:key,tagId,animalId:binding.animalId,identifiedAt:now()});
    contexts.set(key,context);
    return Object.freeze({type:'animal-selected',stationId:key,tagId,animalId:binding.animalId});
  }

  async function handleWeight(event,key){
    if(event.reading.stable!==true)return Object.freeze({type:'weight-ignored',stationId:key,reason:'unstable'});
    const context=contexts.get(key);
    if(!context)return Object.freeze({type:'weight-ignored',stationId:key,reason:'no-animal'});
    if(now()-context.identifiedAt>correlationWindowMs){contexts.delete(key);return Object.freeze({type:'weight-ignored',stationId:key,reason:'expired'});}
    const current=await animals.get(context.animalId);
    if(!current){contexts.delete(key);return Object.freeze({type:'weight-ignored',stationId:key,reason:'animal-missing',animalId:context.animalId});}
    const weightKg=kilograms(event.reading.value,event.reading.unit);
    const measuredAt=event.receivedAt??new Date(now()).toISOString();
    const next=recordWeight(current.payload,{weightKg,measuredAt});
    const saved=await animals.save(next,{expectedVersion:current.version});
    contexts.delete(key);
    await audit({action:'iot.weight.record',entityType:'animal',entityId:context.animalId,metadata:{stationId:key,tagId:context.tagId,deviceId:event.deviceId??null,weightKg,measuredAt}});
    return Object.freeze({type:'weight-recorded',stationId:key,animalId:context.animalId,weightKg,measuredAt,version:saved?.version??null});
  }

  async function handleReading(event){
    const key=stationKey(event);if(!key)throw new TypeError('IoT reading requires stationId or deviceId');
    if(event?.reading?.kind==='rfid')return handleRfid(event,key);
    if(event?.reading?.kind==='weight')return handleWeight(event,key);
    return Object.freeze({type:'reading-ignored',stationId:key,reason:'unsupported-kind'});
  }

  return Object.freeze({handleReading,getStationContext});
}
