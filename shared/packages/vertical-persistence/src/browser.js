const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const clone=v=>structuredClone(v);
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
function openDb(name){return new Promise((res,rej)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('entries');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}

export function createBrowserPersistence({productId,dbName=`artisys-${productId}`}={}){
  const pid=text(productId,'Product id');
  let dbp=openDb(dbName),transactionTail=Promise.resolve();
  const key=(c,id)=>`record:${encodeURIComponent(c)}:${encodeURIComponent(id)}`;
  const hist=(c,id,v)=>`history:${encodeURIComponent(c)}:${encodeURIComponent(id)}:${String(v).padStart(12,'0')}`;
  async function getRaw(k){const db=await dbp,tx=db.transaction('entries','readonly');return req(tx.objectStore('entries').get(k))}
  async function putRaw(k,v){const db=await dbp,tx=db.transaction('entries','readwrite');await req(tx.objectStore('entries').put(clone(v),k))}
  async function keys(){const db=await dbp,tx=db.transaction('entries','readonly');return (await req(tx.objectStore('entries').getAllKeys())).map(String)}

  const api={
    productId:pid,
    async putRecord(c,id,payload,{expectedVersion}={}){
      const cur=await api.getRecord(c,id,{includeDeleted:true}),version=cur?.version??0;
      if(expectedVersion!==undefined&&expectedVersion!==version)throw new Error('version conflict');
      const rec={collection:c,id,payload:clone(payload),version:version+1,deletedAt:null,updatedAt:new Date().toISOString()};
      await putRaw(key(c,id),rec);await putRaw(hist(c,id,rec.version),rec);return clone(rec);
    },
    async getRecord(c,id,{includeDeleted=false}={}){const r=await getRaw(key(c,id));return !r||(!includeDeleted&&r.deletedAt)?null:clone(r)},
    async listRecords(c,{includeDeleted=false}={}){const prefix=`record:${encodeURIComponent(c)}:`,out=[];for(const k of (await keys()).filter(k=>k.startsWith(prefix))){const r=await getRaw(k);if(includeDeleted||!r.deletedAt)out.push(clone(r))}return out.sort((a,b)=>a.id.localeCompare(b.id))},
    async listCollections(){const out=new Set;for(const k of await keys())if(k.startsWith('record:'))out.add(decodeURIComponent(k.split(':')[1]));return [...out].sort()},
    async softDeleteRecord(c,id,{expectedVersion}={}){const cur=await api.getRecord(c,id,{includeDeleted:true});if(!cur)throw new Error('not found');if(expectedVersion!==undefined&&expectedVersion!==cur.version)throw new Error('version conflict');const rec={...cur,version:cur.version+1,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await putRaw(key(c,id),rec);await putRaw(hist(c,id,rec.version),rec);return rec},
    async recordHistory(c,id){const prefix=`history:${encodeURIComponent(c)}:${encodeURIComponent(id)}:`,out=[];for(const k of (await keys()).filter(k=>k.startsWith(prefix)))out.push(await getRaw(k));return out.sort((a,b)=>a.version-b.version)},
    async exportSnapshot(){const entries=[];for(const k of await keys())entries.push({key:k,value:await getRaw(k)});return{schemaVersion:1,productId:pid,entries}},
    async importSnapshot(s){if(s?.productId!==pid)throw new TypeError('Invalid snapshot.');const db=await dbp;{const tx=db.transaction('entries','readwrite');await req(tx.objectStore('entries').clear())}for(const e of s.entries)await putRaw(e.key,e.value);return{restored:true}},
    async transaction(fn){
      if(typeof fn!=='function')throw new TypeError('Transaction callback is required.');
      const run=async()=>{
        const before=await api.exportSnapshot();
        const txView=Object.freeze({
          productId:pid,
          putRecord:api.putRecord,
          getRecord:api.getRecord,
          listRecords:api.listRecords,
          listCollections:api.listCollections,
          softDeleteRecord:api.softDeleteRecord,
          recordHistory:api.recordHistory,
          health:api.health
        });
        try{return await fn(txView)}catch(error){await api.importSnapshot(before);throw error}
      };
      const result=transactionTail.then(run,run);
      transactionTail=result.then(()=>undefined,()=>undefined);
      return result;
    },
    async health(){return{ok:true,productId:pid,driver:'indexeddb'}},
    async close(){const db=await dbp;db.close()}
  };
  return Object.freeze(api);
}

export function createBrowserRecovery(persistence,{productId=persistence.productId}={}){
  const backups=new Map;
  return Object.freeze({
    async createBackup({id=`backup-${Date.now()}`}={}){const backup={id,productId,createdAt:new Date().toISOString(),snapshot:await persistence.exportSnapshot()};backups.set(id,backup);return backup},
    async listBackups(){return [...backups.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))},
    async restoreBackup(id){const b=backups.get(id);if(!b)throw new Error('Backup not found.');await persistence.importSnapshot(b.snapshot);return{restored:true,backupId:id}},
    async restoreByRecoveryCode(){throw new Error('Recovery code unavailable in browser QA adapter.')}
  });
}
