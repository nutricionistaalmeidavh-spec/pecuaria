const SENSITIVE_KEYS=new Set(['password','passwordhash','passwordsalt','token','tokenhash','authorization','secret']);

function sanitize(value){
  if(Array.isArray(value))return value.map(sanitize);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [key,item] of Object.entries(value)){
    if(SENSITIVE_KEYS.has(String(key).toLowerCase()))continue;
    out[key]=sanitize(item);
  }
  return out;
}

function required(value,label){
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);
  return value.trim();
}

export function createAuditService(persistence,{productId='agro-pecuaria'}={}){
  if(!persistence?.putRecord||!persistence?.listRecords)throw new TypeError('Persistence adapter is required.');
  const collection=`audit:${required(productId,'Product id')}`;
  return Object.freeze({
    async append(value,{persistence:store=persistence}={}){
      const entry=Object.freeze({
        id:value?.id??crypto.randomUUID(),
        at:new Date(value?.at??Date.now()).toISOString(),
        actorId:required(value?.actorId,'Audit actor id'),
        action:required(value?.action,'Audit action'),
        entityType:value?.entityType??null,
        entityId:value?.entityId??null,
        metadata:Object.freeze(sanitize(value?.metadata??{}))
      });
      await store.putRecord(collection,entry.id,entry,{expectedVersion:0});
      return entry;
    },
    async list({actorId=null,action=null,entityType=null,entityId=null,limit=null}={}){
      let entries=(await persistence.listRecords(collection)).map(row=>row.payload);
      if(actorId)entries=entries.filter(entry=>entry.actorId===actorId);
      if(action)entries=entries.filter(entry=>entry.action===action);
      if(entityType)entries=entries.filter(entry=>entry.entityType===entityType);
      if(entityId)entries=entries.filter(entry=>entry.entityId===entityId);
      entries.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
      if(Number.isInteger(limit)&&limit>=0)entries=entries.slice(-limit);
      return entries;
    }
  });
}

export const sanitizeAuditMetadata=sanitize;
