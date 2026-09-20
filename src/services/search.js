export const SEARCHABLE_COLLECTIONS=Object.freeze([
  'cattle.farm-units',
  'cattle.lots',
  'cattle.animals',
  'cattle.breeds',
  'cattle.categories',
  'cattle.sanitary-protocols',
  'cattle.events',
  'cattle.trades',
  'cattle.finance'
]);

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const labelFor=(payload,id)=>payload?.name??payload?.tag??payload?.description??payload?.title??payload?.id??id;

export function createLocalSearchService(persistence,{collections=SEARCHABLE_COLLECTIONS}={}){
  const allowed=new Set(collections);
  return Object.freeze({
    async query({term,collections:requested=null,limit=25}={}){
      const needle=normalize(term).trim();
      if(!needle)throw new TypeError('Search term is required.');
      const selected=requested??[...allowed];
      if(!Array.isArray(selected)||selected.some(collection=>!allowed.has(collection))){
        throw new Error('Search collection is not allowed for this product.');
      }
      const max=Math.max(1,Math.min(100,Number(limit)||25));
      const results=[];
      for(const collection of selected){
        for(const record of await persistence.listRecords(collection)){
          const haystack=normalize(JSON.stringify(record.payload));
          if(!haystack.includes(needle))continue;
          results.push(Object.freeze({collection,id:record.id,label:String(labelFor(record.payload,record.id)),payload:record.payload}));
          if(results.length>=max)return Object.freeze(results);
        }
      }
      return Object.freeze(results);
    }
  });
}
