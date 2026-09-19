const FORMAT='artisys-pecuaria-export';
const VERSION=1;
const PRODUCT='agro-pecuaria';
export const TRANSFERABLE_COLLECTIONS=Object.freeze([
  'cattle.lots',
  'cattle.animals',
  'cattle.breeds',
  'cattle.categories',
  'cattle.sanitary-protocols',
  'cattle.events',
  'cattle.trades',
  'cattle.finance'
]);

const requiredText=(value,label)=>{
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);
  return value.trim();
};

function validateCollection(collection){
  const name=requiredText(collection,'Collection');
  if(!TRANSFERABLE_COLLECTIONS.includes(name))throw new Error(`Collection is not allowed for transfer: ${name}.`);
  return name;
}

function validateDocument(document){
  if(!document||document.format!==FORMAT)throw new Error('Invalid transfer format.');
  if(document.version!==VERSION)throw new Error('Unsupported transfer version.');
  if(document.productId!==PRODUCT)throw new Error('Transfer document belongs to another product.');
  const collection=validateCollection(document.collection);
  if(!Array.isArray(document.records))throw new TypeError('Transfer records must be an array.');
  const seen=new Set();
  const records=document.records.map(record=>{
    const id=requiredText(record?.id,'Record id');
    if(seen.has(id))throw new Error(`Duplicate record id in transfer document: ${id}.`);
    seen.add(id);
    if(!record?.payload||typeof record.payload!=='object'||Array.isArray(record.payload))throw new TypeError(`Record payload must be an object: ${id}.`);
    return Object.freeze({id,payload:record.payload});
  });
  return{collection,records};
}

export function createCattleTransferService(persistence){
  if(!persistence?.listRecords||!persistence?.putRecord)throw new TypeError('Persistence is required.');

  async function detectExisting(store,collection,records){
    const existing=[];
    for(const record of records){
      if(await store.getRecord(collection,record.id))existing.push(record.id);
    }
    if(existing.length)throw new Error(`Duplicate or existing record ids: ${existing.join(', ')}.`);
  }

  return Object.freeze({
    async exportCollection(collection){
      const name=validateCollection(collection);
      const records=(await persistence.listRecords(name)).map(record=>Object.freeze({id:record.id,payload:record.payload}));
      return Object.freeze({format:FORMAT,version:VERSION,productId:PRODUCT,collection:name,exportedAt:new Date().toISOString(),records:Object.freeze(records)});
    },
    async importCollection(document,{mode='validate'}={}){
      if(!['validate','append'].includes(mode))throw new Error('Import mode must be validate or append.');
      const {collection,records}=validateDocument(document);
      await detectExisting(persistence,collection,records);
      if(mode==='validate')return Object.freeze({valid:true,mode,collection,count:records.length,imported:0});

      const write=async store=>{
        await detectExisting(store,collection,records);
        for(const record of records){
          await store.putRecord(collection,record.id,record.payload,{expectedVersion:0});
        }
      };
      if(typeof persistence.transaction==='function')await persistence.transaction(write);
      else await write(persistence);
      return Object.freeze({valid:true,mode,collection,count:records.length,imported:records.length});
    }
  });
}
