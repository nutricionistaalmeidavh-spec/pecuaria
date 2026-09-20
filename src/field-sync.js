const CONFIG='cattle.field-sync-config';
const QUEUE='cattle.field-sync-queue';
const RECEIPTS='cattle.field-sync-receipts';
const SNAPSHOT_COLLECTIONS=Object.freeze([
  'cattle.tasks',
  'cattle.animals',
  'cattle.lots',
  'cattle.sanitary-protocols',
  'cattle.inventory'
]);

export const FIELD_PAIRING_FORMAT='artisys-pecuaria-field-pairing';
export const FIELD_SYNC_FORMAT='artisys-pecuaria-field-sync';
export const FIELD_SYNC_VERSION=1;

const enc=new TextEncoder();
const dec=new TextDecoder();
const required=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim()};
const iso=(value,label)=>{const time=Date.parse(value);if(!Number.isFinite(time))throw new TypeError(`${label} must be a valid date.`);return new Date(time).toISOString()};
const nowIso=()=>new Date().toISOString();
const unique=value=>String(value??'').replace(/[^a-zA-Z0-9._:-]/g,'-');
const encode64=bytes=>{
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const decode64=value=>{
  const normalized=String(value??'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  try{return Uint8Array.from(atob(padded),char=>char.charCodeAt(0))}catch{throw new Error('Invalid field synchronization package encoding.')}
};
const randomKey=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return encode64(bytes)};
const aesKey=async encoded=>{
  const bytes=decode64(encoded);
  if(bytes.length!==32)throw new Error('Invalid field pairing key.');
  return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
};
const envelopeMetadata=value=>({
  format:value.format,
  version:value.version,
  productId:value.productId,
  sourceDeviceId:value.sourceDeviceId,
  createdAt:value.createdAt,
  expiresAt:value.expiresAt,
  nonce:value.nonce
});
const aad=value=>enc.encode(JSON.stringify(envelopeMetadata(value)));

function normalizeQuick(kind,input={},operationId=crypto.randomUUID()){
  if(kind==='task.complete')return Object.freeze({kind,screenId:'tasks',action:'complete',input:{id:required(input.id,'Task id')}});
  if(kind==='weight.record'){
    const weightKg=Number(input.weightKg);
    if(!Number.isFinite(weightKg)||weightKg<=0)throw new TypeError('Weight must be positive.');
    return Object.freeze({kind,screenId:'weights',action:'record',input:{id:required(input.id,'Animal id'),weightKg,measuredAt:iso(input.measuredAt??nowIso(),'Measured at')}});
  }
  if(kind==='animal.move')return Object.freeze({kind,screenId:'animals',action:'move',input:{id:required(input.id,'Animal id'),toLotId:required(input.toLotId,'Destination lot'),movedAt:iso(input.movedAt??nowIso(),'Moved at'),reason:input.reason?.trim?.()||'field-mobile'}});
  if(kind==='sanitary.record')return Object.freeze({kind,screenId:'sanitary',action:'record',input:{id:input.eventId?.trim?.()||`field-san-${unique(operationId)}`,animalId:required(input.animalId,'Animal id'),protocolId:required(input.protocolId,'Protocol id'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at')}});
  throw new Error(`Unsupported field quick operation: ${kind}`);
}

function touchesSnapshot(operation,collection,id){
  if(operation.kind==='task.complete')return collection==='cattle.tasks'&&operation.input?.id===id;
  if(operation.kind==='weight.record'||operation.kind==='animal.move')return collection==='cattle.animals'&&operation.input?.id===id;
  if(operation.kind==='sanitary.record'&&collection==='cattle.inventory')return true;
  return false;
}

export function createFieldSyncService(persistence,{productId=persistence?.productId??'agro-pecuaria'}={}){
  if(!persistence?.putRecord||!persistence?.listRecords)throw new TypeError('Persistence adapter is required for field synchronization.');
  const pid=required(productId,'Product id');

  async function configRecord(){return persistence.getRecord(CONFIG,'device')}
  async function requireConfig(){
    const record=await configRecord();
    if(!record?.payload?.paired||!record.payload.key)throw new Error('Field synchronization is not paired on this device.');
    return record;
  }
  async function pairingFor(config){return Object.freeze({format:FIELD_PAIRING_FORMAT,version:FIELD_SYNC_VERSION,productId:pid,key:config.key,createdAt:config.configuredAt})}

  async function configure({role,deviceName,pairing=null,rotateKey=false}={}){
    if(!['base','field'].includes(role))throw new TypeError('Field synchronization role must be base or field.');
    const current=await configRecord();
    let key=current?.payload?.key??null;
    if(role==='field'){
      if(pairing?.format!==FIELD_PAIRING_FORMAT||pairing?.version!==FIELD_SYNC_VERSION||pairing?.productId!==pid)throw new Error('Invalid field pairing package.');
      await aesKey(pairing.key);
      key=pairing.key;
    }else if(!key||rotateKey){key=randomKey()}
    const configuredAt=nowIso();
    const payload={id:'device',deviceId:current?.payload?.deviceId??crypto.randomUUID(),role,deviceName:required(deviceName,'Device name'),key,paired:true,configuredAt};
    await persistence.putRecord(CONFIG,'device',payload,{expectedVersion:current?.version??0});
    return Object.freeze({state:await state(),...(role==='base'?{pairing:await pairingFor(payload)}:{})});
  }

  async function state(){
    const config=await configRecord();
    if(!config?.payload?.paired)return Object.freeze({paired:false,role:null,deviceId:null,deviceName:null,pending:0,acknowledged:0,conflicts:0});
    const queue=(await persistence.listRecords(QUEUE)).map(record=>record.payload);
    return Object.freeze({
      paired:true,
      role:config.payload.role,
      deviceId:config.payload.deviceId,
      deviceName:config.payload.deviceName,
      pending:queue.filter(item=>['prepared','ready','exported'].includes(item.status)).length,
      acknowledged:queue.filter(item=>item.status==='acked').length,
      conflicts:queue.filter(item=>['conflict','local-failed'].includes(item.status)).length
    });
  }

  async function prepareQuick({kind,input={},actorId='system'}={}){
    const config=(await requireConfig()).payload;
    const id=crypto.randomUUID();
    const command=normalizeQuick(kind,input,id);
    const operation={id,sourceDeviceId:config.deviceId,kind:command.kind,input:command.input,createdAt:nowIso(),originActorId:actorId,status:config.role==='field'?'prepared':'local-only',localAppliedAt:null,lastExportedAt:null,error:null};
    if(config.role==='field')await persistence.putRecord(QUEUE,id,operation,{expectedVersion:0});
    return Object.freeze({operation,command,queued:config.role==='field'});
  }

  async function markQuickApplied(id){
    const current=await persistence.getRecord(QUEUE,id);
    if(!current)return null;
    const next={...current.payload,status:'ready',localAppliedAt:nowIso(),error:null};
    return persistence.putRecord(QUEUE,id,next,{expectedVersion:current.version});
  }
  async function markQuickFailed(id,error){
    const current=await persistence.getRecord(QUEUE,id);
    if(!current)return null;
    const next={...current.payload,status:'local-failed',error:String(error?.message??error??'Local operation failed.'),failedAt:nowIso()};
    return persistence.putRecord(QUEUE,id,next,{expectedVersion:current.version});
  }

  async function exportBundle(){
    const config=(await requireConfig()).payload;
    const queueRecords=(await persistence.listRecords(QUEUE)).filter(record=>['ready','exported'].includes(record.payload.status));
    const operations=queueRecords.map(record=>({id:record.payload.id,sourceDeviceId:record.payload.sourceDeviceId,kind:record.payload.kind,input:record.payload.input,createdAt:record.payload.createdAt,originActorId:record.payload.originActorId??null}));
    const receipts=(await persistence.listRecords(RECEIPTS)).map(record=>record.payload).slice(-1000);
    const snapshot=[];
    if(config.role==='base'){
      for(const collection of SNAPSHOT_COLLECTIONS){
        const records=(await persistence.listRecords(collection)).map(record=>({id:record.id,payload:record.payload,updatedAt:record.updatedAt??null}));
        snapshot.push({collection,records});
      }
    }
    const metadata={format:FIELD_SYNC_FORMAT,version:FIELD_SYNC_VERSION,productId:pid,sourceDeviceId:config.deviceId,createdAt:nowIso(),expiresAt:new Date(Date.now()+7*86400000).toISOString(),nonce:crypto.randomUUID()};
    const iv=new Uint8Array(12);crypto.getRandomValues(iv);
    const key=await aesKey(config.key);
    const plaintext=enc.encode(JSON.stringify({snapshot,operations,receipts}));
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(metadata)},key,plaintext));
    const exportedAt=nowIso();
    for(const record of queueRecords){
      await persistence.putRecord(QUEUE,record.id,{...record.payload,status:'exported',lastExportedAt:exportedAt},{expectedVersion:record.version});
    }
    return Object.freeze({...metadata,iv:encode64(iv),ciphertext:encode64(encrypted)});
  }

  async function decryptBundle(bundle,config){
    if(bundle?.format!==FIELD_SYNC_FORMAT||bundle?.version!==FIELD_SYNC_VERSION||bundle?.productId!==pid)throw new Error('Invalid field synchronization package.');
    if(!bundle.sourceDeviceId||!bundle.nonce)throw new Error('Invalid field synchronization package metadata.');
    const expires=Date.parse(bundle.expiresAt);
    if(!Number.isFinite(expires)||Date.now()>expires)throw new Error('Field synchronization package has expired.');
    try{
      const key=await aesKey(config.key);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(bundle.iv),additionalData:aad(bundle)},key,decode64(bundle.ciphertext));
      const content=JSON.parse(dec.decode(plain));
      if(!Array.isArray(content.operations)||!Array.isArray(content.receipts)||!Array.isArray(content.snapshot))throw new Error('Invalid decrypted package content.');
      return content;
    }catch(error){
      if(String(error?.message??'').startsWith('Invalid decrypted'))throw error;
      throw new Error('Invalid or unauthenticated field synchronization package.');
    }
  }

  async function acknowledgeReceipts(receipts,config){
    let acknowledged=0;
    for(const receipt of receipts){
      if(receipt?.sourceDeviceId!==config.deviceId||!receipt.operationId)continue;
      const current=await persistence.getRecord(QUEUE,receipt.operationId);
      if(!current||current.payload.status==='acked')continue;
      const status=receipt.status==='applied'?'acked':'conflict';
      await persistence.putRecord(QUEUE,current.id,{...current.payload,status,acknowledgedAt:nowIso(),remoteStatus:receipt.status,remoteError:receipt.error??null},{expectedVersion:current.version});
      acknowledged+=1;
    }
    return acknowledged;
  }

  async function applyOperations(operations,{apply,config}){
    let applied=0,skipped=0,conflicts=0;
    for(const operation of operations){
      if(!operation?.id||!operation?.sourceDeviceId){conflicts+=1;continue}
      if(operation.sourceDeviceId===config.deviceId){skipped+=1;continue}
      const receiptId=`${unique(operation.sourceDeviceId)}:${unique(operation.id)}`;
      const existing=await persistence.getRecord(RECEIPTS,receiptId);
      if(existing){skipped+=1;continue}
      const started={id:receiptId,sourceDeviceId:operation.sourceDeviceId,operationId:operation.id,status:'started',receivedAt:nowIso(),kind:operation.kind,error:null};
      const startedRecord=await persistence.putRecord(RECEIPTS,receiptId,started,{expectedVersion:0});
      try{
        const command=normalizeQuick(operation.kind,operation.input,operation.id);
        if(typeof apply!=='function')throw new Error('Field operation applier is unavailable.');
        await apply(command);
        await persistence.putRecord(RECEIPTS,receiptId,{...started,status:'applied',appliedAt:nowIso()},{expectedVersion:startedRecord.version});
        applied+=1;
      }catch(error){
        await persistence.putRecord(RECEIPTS,receiptId,{...started,status:'conflict',failedAt:nowIso(),error:String(error?.message??error)},{expectedVersion:startedRecord.version});
        conflicts+=1;
      }
    }
    return{applied,skipped,conflicts};
  }

  async function applySnapshot(snapshot,config){
    if(config.role!=='field')return{applied:0,skipped:0};
    const pending=(await persistence.listRecords(QUEUE)).map(record=>record.payload).filter(item=>['prepared','ready','exported','local-failed','conflict'].includes(item.status));
    let applied=0,skipped=0;
    for(const section of snapshot){
      if(!SNAPSHOT_COLLECTIONS.includes(section?.collection)||!Array.isArray(section.records))continue;
      for(const incoming of section.records){
        if(!incoming?.id||incoming.payload==null){skipped+=1;continue}
        if(pending.some(operation=>touchesSnapshot(operation,section.collection,incoming.id))){skipped+=1;continue}
        const current=await persistence.getRecord(section.collection,incoming.id,{includeDeleted:true});
        await persistence.putRecord(section.collection,incoming.id,incoming.payload,{expectedVersion:current?.version??0});
        applied+=1;
      }
    }
    return{applied,skipped};
  }

  async function importBundle(bundle,{apply=null}={}){
    const config=(await requireConfig()).payload;
    const content=await decryptBundle(bundle,config);
    const acknowledged=await acknowledgeReceipts(content.receipts,config);
    const operations=await applyOperations(content.operations,{apply,config});
    const snapshot=await applySnapshot(content.snapshot,config);
    return Object.freeze({operations,snapshot,acknowledged,state:await state()});
  }

  return Object.freeze({configure,state,prepareQuick,markQuickApplied,markQuickFailed,exportBundle,importBundle});
}
