import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const iso=(v,l)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw new TypeError(`${l} must be a valid date.`);return new Date(t).toISOString()};
const number=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new TypeError(`${l} must be zero or positive.`);return n};

export const P1_COLLECTIONS=Object.freeze(['cattle.traceability','cattle.inventory','cattle.pastures','cattle.nutrition','cattle.tasks']);

export function createP1Repositories(persistence){return Object.freeze({
  traceability:createEntityRepository(persistence,{collection:'cattle.traceability'}),
  inventory:createEntityRepository(persistence,{collection:'cattle.inventory'}),
  pastures:createEntityRepository(persistence,{collection:'cattle.pastures'}),
  nutrition:createEntityRepository(persistence,{collection:'cattle.nutrition'}),
  tasks:createEntityRepository(persistence,{collection:'cattle.tasks'})
})}

export function createTraceabilityRecord({id,animalId,officialId,type='identity',documentNumber=null,issuer=null,issuedAt,expiresAt=null,notes=null}={}){
  return Object.freeze({id:text(id,'Traceability id'),animalId:text(animalId,'Animal id'),officialId:officialId?.trim?.()||null,type:text(type,'Traceability type'),documentNumber:documentNumber?.trim?.()||null,issuer:issuer?.trim?.()||null,issuedAt:iso(issuedAt,'Issued at'),expiresAt:expiresAt?iso(expiresAt,'Expires at'):null,notes:notes?.trim?.()||null});
}
export function createInventoryItem({id,name,kind='medicine',unit='unit',quantity=0,minQuantity=0,batch=null,expiresAt=null,costMinor=0}={}){
  return Object.freeze({id:text(id,'Inventory id'),name:text(name,'Inventory name'),kind:text(kind,'Inventory kind'),unit:text(unit,'Inventory unit'),quantity:number(quantity,'Quantity'),minQuantity:number(minQuantity,'Minimum quantity'),batch:batch?.trim?.()||null,expiresAt:expiresAt?iso(expiresAt,'Expires at'):null,costMinor:number(costMinor,'Cost')});
}
export function createPasture({id,name,farmUnitId,areaHa,capacityAu=null,status='active',forage=null}={}){
  return Object.freeze({id:text(id,'Pasture id'),name:text(name,'Pasture name'),farmUnitId:text(farmUnitId,'Farm unit id'),areaHa:number(areaHa,'Area'),capacityAu:capacityAu==null?null:number(capacityAu,'Capacity'),status:text(status,'Status'),forage:forage?.trim?.()||null});
}
export function createNutritionPlan({id,name,lotId,feedItemId=null,dailyKgPerHead,startsAt,endsAt=null,notes=null}={}){
  return Object.freeze({id:text(id,'Nutrition id'),name:text(name,'Nutrition name'),lotId:text(lotId,'Lot id'),feedItemId:feedItemId?.trim?.()||null,dailyKgPerHead:number(dailyKgPerHead,'Daily kg/head'),startsAt:iso(startsAt,'Starts at'),endsAt:endsAt?iso(endsAt,'Ends at'):null,notes:notes?.trim?.()||null});
}
export function createManagementTask({id,title,dueAt,kind='management',animalId=null,lotId=null,status='pending',notes=null}={}){
  return Object.freeze({id:text(id,'Task id'),title:text(title,'Task title'),dueAt:iso(dueAt,'Due at'),kind:text(kind,'Task kind'),animalId:animalId?.trim?.()||null,lotId:lotId?.trim?.()||null,status:text(status,'Task status'),notes:notes?.trim?.()||null});
}
