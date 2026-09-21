const CONFIG='cattle.field-sync-config';
const QUEUE='cattle.field-sync-queue';
const RECEIPTS='cattle.field-sync-receipts';
const SNAPSHOT_COLLECTIONS=Object.freeze([
  'cattle.tasks',
  'cattle.animals',
  'cattle.lots',
  'cattle.sanitary-protocols',
  'cattle.inventory',
  'cattle.events',
  'cattle.traceability',
  'cattle.pastures',
  'cattle.pasture-occupancy',
  'cattle.breeding-seasons',
  'cattle.reproduction-genetics',
  'cattle.reproduction-dose-stock',
  'cattle.body-condition',
  'cattle.pasture-assessments',
  'cattle.pasture-rotation-plan'
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

export function normalizeFieldQuick(kind,input={},operationId=crypto.randomUUID()){
  const op=unique(operationId);
  const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
  const number=(value,label,{positive=false}={})=>{const parsed=Number(value);if(!Number.isFinite(parsed)||(positive&&parsed<=0))throw new TypeError(`${label} must be ${positive?'positive':'a finite number'}.`);return parsed};
  const ids=(value,label)=>{if(!Array.isArray(value)||value.length===0)throw new TypeError(`${label} requires at least one id.`);const normalized=value.map(item=>required(item,label));return Object.freeze([...new Set(normalized)])};
  const command=(screenId,action,normalized)=>Object.freeze({kind,screenId,action,input:normalized});

  if(kind==='task.complete')return command('tasks','complete',{id:required(input.id,'Task id')});
  if(kind==='weight.record')return command('weights','record',{id:required(input.id,'Animal id'),weightKg:number(input.weightKg,'Weight',{positive:true}),measuredAt:iso(input.measuredAt??nowIso(),'Measured at')});
  if(kind==='animal.move')return command('animals','move',{id:required(input.id,'Animal id'),toLotId:required(input.toLotId,'Destination lot'),movedAt:iso(input.movedAt??nowIso(),'Moved at'),reason:optional(input.reason)??'field-mobile'});
  if(kind==='sanitary.record')return command('sanitary','record',{id:optional(input.eventId)??optional(input.id)??`field-san-${op}`,animalId:required(input.animalId,'Animal id'),protocolId:required(input.protocolId,'Protocol id'),productItemId:optional(input.productItemId),dose:input.dose==null?undefined:number(input.dose,'Dose',{positive:true}),unit:optional(input.unit),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),nextDueAt:input.nextDueAt?iso(input.nextDueAt,'Next due at'):null,technicianPartyId:optional(input.technicianPartyId)});
  if(kind==='reproduction.record')return command('reproduction','record',{id:optional(input.eventId)??optional(input.id)??`field-repro-${op}`,animalId:required(input.animalId,'Animal id'),type:required(input.type,'Reproduction type'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),relatedAnimalId:optional(input.relatedAnimalId),metadata:input.metadata&&typeof input.metadata==='object'?{...input.metadata}:{...(optional(input.notes)?{notes:optional(input.notes)}:{})}});
  if(kind==='animal.birth')return command('animals','registerBirth',{id:required(input.id,'Animal id'),tag:required(input.tag,'Animal tag'),farmUnitId:required(input.farmUnitId,'Farm unit id'),birthDate:iso(input.birthDate??nowIso(),'Birth date'),sex:required(input.sex,'Sex'),damId:optional(input.damId),sireId:optional(input.sireId),lotId:optional(input.lotId),breedId:optional(input.breedId),categoryId:optional(input.categoryId),rfid:optional(input.rfid),name:optional(input.name),officialId:optional(input.officialId),purpose:optional(input.purpose)??'beef',notes:optional(input.notes),metadata:input.metadata&&typeof input.metadata==='object'?{...input.metadata}:{}});
  if(kind==='animal.weaning')return command('reproduction','record',{id:optional(input.eventId)??optional(input.id)??`field-wean-${op}`,animalId:required(input.animalId,'Animal id'),type:'weaning',occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),relatedAnimalId:optional(input.relatedAnimalId),metadata:input.metadata&&typeof input.metadata==='object'?{...input.metadata}:{...(optional(input.notes)?{notes:optional(input.notes)}:{})}});
  if(kind==='animal.death')return command('animals','lifecycle',{id:required(input.id??input.animalId,'Animal id'),type:'death',occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),reason:optional(input.reason)??'field-mobile'});
  if(kind==='rfid.bind')return command('iot','bindRfid',{tagId:required(input.tagId??input.rfid,'RFID tag'),animalId:required(input.animalId,'Animal id'),...(optional(input.stationId)?{stationId:optional(input.stationId)}:{})});
  if(kind==='traceability.save')return command('traceability','save',{id:optional(input.id)??`field-trace-${op}`,animalId:required(input.animalId,'Animal id'),officialId:optional(input.officialId),type:optional(input.type)??'identity',documentNumber:optional(input.documentNumber),issuer:optional(input.issuer),issuedAt:iso(input.issuedAt??nowIso(),'Issued at'),expiresAt:input.expiresAt?iso(input.expiresAt,'Expires at'):null,notes:optional(input.notes)});
  if(kind==='animal.batchMove')return command('animals','batchMove',{animalIds:ids(input.animalIds,'Animal id'),toLotId:required(input.toLotId,'Destination lot'),movedAt:iso(input.movedAt??nowIso(),'Moved at'),reason:optional(input.reason)??'field-mobile'});
  if(kind==='animal.batchLifecycle')return command('animals','batchLifecycle',{animalIds:ids(input.animalIds,'Animal id'),type:required(input.type,'Lifecycle type'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),reason:optional(input.reason)??'field-mobile'});
  if(kind==='sanitary.batchRecord')return command('sanitary','batchRecord',{idPrefix:optional(input.idPrefix)??`field-san-batch-${op}`,animalIds:ids(input.animalIds,'Animal id'),protocolId:required(input.protocolId,'Protocol id'),productItemId:optional(input.productItemId),dose:input.dose==null?undefined:number(input.dose,'Dose',{positive:true}),unit:optional(input.unit),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),nextDueAt:input.nextDueAt?iso(input.nextDueAt,'Next due at'):null,technicianPartyId:optional(input.technicianPartyId)});
  if(kind==='reproduction.batchRecord')return command('reproduction','batchRecord',{idPrefix:optional(input.idPrefix)??`field-repro-batch-${op}`,animalIds:ids(input.animalIds,'Animal id'),type:required(input.type,'Reproduction type'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),relatedAnimalId:optional(input.relatedAnimalId),metadata:input.metadata&&typeof input.metadata==='object'?{...input.metadata}:{...(optional(input.notes)?{notes:optional(input.notes)}:{})}});
  if(kind==='pasture.enterLot')return command('pastures','enterLot',{id:optional(input.id)??`field-pasture-${op}`,pastureId:required(input.pastureId,'Pasture id'),lotId:required(input.lotId,'Lot id'),enteredAt:iso(input.enteredAt??nowIso(),'Entered at'),animalUnits:input.animalUnits==null||input.animalUnits===''?null:number(input.animalUnits,'Animal units'),notes:optional(input.notes)});
  if(kind==='pasture.leaveLot')return command('pastures','leaveLot',{id:required(input.id,'Pasture occupancy id'),leftAt:iso(input.leftAt??nowIso(),'Left at')});
  if(kind==='animal.bodyScore')return command('animals','recordBodyCondition',{id:optional(input.id)??`field-body-${op}`,animalId:required(input.animalId,'Animal id'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),score:number(input.score,'Body condition score'),scaleId:optional(input.scaleId)??'bcs',scaleMin:input.scaleMin==null?undefined:number(input.scaleMin,'Scale minimum'),scaleMax:input.scaleMax==null?undefined:number(input.scaleMax,'Scale maximum'),notes:optional(input.notes)});
  if(kind==='pasture.score')return command('pastures','recordAssessment',{id:optional(input.id)??`field-pasture-score-${op}`,pastureId:required(input.pastureId,'Pasture id'),occurredAt:iso(input.occurredAt??nowIso(),'Occurred at'),score:number(input.score,'Pasture score'),scaleMin:input.scaleMin==null?undefined:number(input.scaleMin,'Scale minimum'),scaleMax:input.scaleMax==null?undefined:number(input.scaleMax,'Scale maximum'),heightCm:input.heightCm==null||input.heightCm===''?null:number(input.heightCm,'Height'),forageMassKgHa:input.forageMassKgHa==null||input.forageMassKgHa===''?null:number(input.forageMassKgHa,'Forage mass'),groundCoverPct:input.groundCoverPct==null||input.groundCoverPct===''?null:number(input.groundCoverPct,'Ground cover'),photoPaths:Array.isArray(input.photoPaths)?input.photoPaths.map(item=>required(item,'Photo path')):[],notes:optional(input.notes)});
  throw new Error(`Unsupported field quick operation: ${kind}`);
}
function touchesSnapshot(operation,collection,id){
  const input=operation?.input??{};
  const animalIds=Array.isArray(input.animalIds)?input.animalIds:[];
  if(operation.kind==='task.complete')return collection==='cattle.tasks'&&input.id===id;

  if(collection==='cattle.animals'){
    if(['weight.record','animal.move','animal.death','animal.birth'].includes(operation.kind))return input.id===id;
    if(['animal.batchMove','animal.batchLifecycle'].includes(operation.kind))return animalIds.includes(id);
  }

  if(collection==='cattle.events'){
    if(['sanitary.record','reproduction.record','animal.weaning'].includes(operation.kind))return input.id===id;
    if(operation.kind==='animal.birth')return `${input.id}:birth`===id;
    if(['sanitary.batchRecord','reproduction.batchRecord'].includes(operation.kind))return true;
  }

  if(collection==='cattle.inventory'&&['sanitary.record','sanitary.batchRecord'].includes(operation.kind))return true;
  if(collection==='cattle.traceability'&&operation.kind==='traceability.save')return input.id===id;
  if(collection==='cattle.pasture-occupancy'&&['pasture.enterLot','pasture.leaveLot'].includes(operation.kind))return input.id===id;
  if(collection==='cattle.pastures'&&operation.kind==='pasture.enterLot')return input.pastureId===id;
  if(collection==='cattle.body-condition'&&operation.kind==='animal.bodyScore')return input.id===id;
  if(collection==='cattle.pasture-assessments'&&operation.kind==='pasture.score')return input.id===id;
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
    const command=normalizeFieldQuick(kind,input,id);
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
        const command=normalizeFieldQuick(operation.kind,operation.input,operation.id);
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
