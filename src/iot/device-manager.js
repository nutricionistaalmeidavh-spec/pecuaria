import {normalizeRfidReading} from './adapters/rfid.js';
import {normalizeScaleReading} from './adapters/scale.js';

const text=(value,field)=>{const result=String(value??'').trim();if(!result)throw new TypeError(`${field} is required`);return result;};
const state=(status,error=null)=>Object.freeze({status,error});

function extractPayload(device,payload){
  const isBuffer=Boolean(globalThis.Buffer?.isBuffer?.(payload));
  if(isBuffer||typeof payload!=='object'||payload===null)return payload;
  if(Object.prototype.hasOwnProperty.call(payload,'payload'))return payload.payload;
  if(device.kind==='rfid')return payload.tagId??payload.rfid??payload.tag??payload.value??payload.id??'';
  if(device.kind==='scale'){
    const value=payload.weightKg??payload.weight??payload.value;
    if(value!==undefined){
      const stable=payload.stable===true?'ST ':payload.stable===false?'US ':'';
      const unit=payload.unit??'kg';
      return `${stable}${value} ${unit}`;
    }
  }
  return JSON.stringify(payload);
}

function normalize(device,payload){
  const value=extractPayload(device,payload);
  if(device.kind==='rfid')return normalizeRfidReading(value);
  if(device.kind==='scale')return normalizeScaleReading(value);
  throw new TypeError(`Unsupported IoT device kind: ${device.kind}`);
}

export function createDeviceManager({registry,connectorFactory=null,onReading=()=>{},listSerialPorts=async()=>[]}={}){
  if(!registry?.resolveDevice)throw new TypeError('Device registry is required');
  const active=new Map();
  const devices=new Map();
  const statuses=new Map();

  const setStatus=(id,status,error=null)=>statuses.set(id,state(status,error));
  const getStatus=id=>statuses.get(String(id))??state('disconnected');

  async function resolve(id){
    const key=text(id,'device.id');
    const device=await registry.resolveDevice(key);
    if(!device)throw new Error(`IoT device not found: ${key}`);
    devices.set(key,device);
    return device;
  }

  function ingest(id,payload){
    const key=text(id,'device.id'),device=devices.get(key);
    if(!device)throw new Error(`IoT device is not active: ${key}`);
    const reading=normalize(device,payload);
    const event=Object.freeze({deviceId:key,stationId:device.stationId??null,farmId:device.farmId??null,profileId:device.profileId??null,reading,receivedAt:new Date().toISOString()});
    const result=onReading(event);
    if(result&&typeof result.then==='function')result.catch(error=>setStatus(key,'error',error?.message??String(error)));
    return event;
  }

  async function startDevice(id){
    const device=await resolve(id),key=device.id;
    if(device.enabled===false)throw new Error(`IoT device is disabled: ${key}`);
    if(active.has(key))return getStatus(key);
    setStatus(key,'connecting');
    if(device.transport==='simulator'){
      active.set(key,{device,connector:null,unsubscribe:null});
      setStatus(key,'connected');
      return getStatus(key);
    }
    if(typeof connectorFactory!=='function'){
      setStatus(key,'error','No connector factory available');
      throw new Error('No connector factory available');
    }
    let connector,unsubscribe=null;
    try{
      connector=await connectorFactory(device);
      if(!connector||typeof connector.connect!=='function')throw new TypeError('Connector factory returned an invalid connector');
      if(typeof connector.onData==='function')unsubscribe=connector.onData(payload=>{try{ingest(key,payload)}catch(error){setStatus(key,'error',error?.message??String(error));}});
      active.set(key,{device,connector,unsubscribe});
      await connector.connect();
      setStatus(key,connector.status==='disconnected'?'disconnected':'connected');
      return getStatus(key);
    }catch(error){
      try{unsubscribe?.();await connector?.disconnect?.();}catch{}
      active.delete(key);
      setStatus(key,'error',error?.message??String(error));
      throw error;
    }
  }

  async function stopDevice(id){
    const key=text(id,'device.id'),entry=active.get(key);
    if(!entry){setStatus(key,'disconnected');return getStatus(key);}
    try{entry.unsubscribe?.();await entry.connector?.disconnect?.();}
    finally{active.delete(key);setStatus(key,'disconnected');}
    return getStatus(key);
  }

  async function testDevice(id){
    const device=await resolve(id),key=device.id;
    if(device.transport==='simulator'){setStatus(key,'disconnected');return Object.freeze({ok:true,status:'disconnected'});}
    if(typeof connectorFactory!=='function')throw new Error('No connector factory available');
    let connector;
    try{
      setStatus(key,'connecting');
      connector=await connectorFactory(device);
      await connector.connect();
      await connector.disconnect();
      setStatus(key,'disconnected');
      return Object.freeze({ok:true,status:'disconnected'});
    }catch(error){
      try{await connector?.disconnect?.();}catch{}
      setStatus(key,'error',error?.message??String(error));
      throw error;
    }
  }

  function simulate(id,payload){
    const key=text(id,'device.id'),device=devices.get(key);
    if(!device||device.transport!=='simulator')throw new Error(`IoT simulator is not active: ${key}`);
    return ingest(key,payload);
  }

  async function listPorts(){return(await listSerialPorts()).map(port=>({...port}));}
  async function stopAll(){for(const id of [...active.keys()])await stopDevice(id);}

  return Object.freeze({startDevice,stopDevice,testDevice,simulate,ingest,getStatus,listPorts,stopAll});
}
