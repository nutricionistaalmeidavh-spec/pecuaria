import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const iso=(v,l)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw new TypeError(`${l} must be a valid date.`);return new Date(t).toISOString()};
const number=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new TypeError(`${l} must be zero or positive.`);return n};

export const P1_COLLECTIONS=Object.freeze(['cattle.traceability','cattle.inventory','cattle.inventory-movements','cattle.pastures','cattle.pasture-occupancy','cattle.nutrition','cattle.tasks']);

export function createP1Repositories(persistence){return Object.freeze({
  traceability:createEntityRepository(persistence,{collection:'cattle.traceability'}),
  inventory:createEntityRepository(persistence,{collection:'cattle.inventory'}),
  inventoryMovements:createEntityRepository(persistence,{collection:'cattle.inventory-movements'}),
  pastures:createEntityRepository(persistence,{collection:'cattle.pastures'}),
  pastureOccupancy:createEntityRepository(persistence,{collection:'cattle.pasture-occupancy'}),
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

export function createInventoryMovement({id,itemId,type,quantity,occurredAt,reason=null,referenceType=null,referenceId=null,unitCostMinor=null}={}){
  if(!['in','out','adjustment'].includes(type))throw new TypeError('Unsupported inventory movement type.');
  return Object.freeze({id:text(id,'Inventory movement id'),itemId:text(itemId,'Inventory item id'),type,quantity:number(quantity,'Movement quantity'),occurredAt:iso(occurredAt,'Occurred at'),reason:reason?.trim?.()||null,referenceType:referenceType?.trim?.()||null,referenceId:referenceId?.trim?.()||null,unitCostMinor:unitCostMinor==null?null:number(unitCostMinor,'Unit cost')});
}
export function createPastureOccupancy({id,pastureId,lotId,enteredAt,leftAt=null,animalUnits=null,notes=null}={}){
  return Object.freeze({id:text(id,'Pasture occupancy id'),pastureId:text(pastureId,'Pasture id'),lotId:text(lotId,'Lot id'),enteredAt:iso(enteredAt,'Entered at'),leftAt:leftAt?iso(leftAt,'Left at'):null,animalUnits:animalUnits==null?null:number(animalUnits,'Animal units'),notes:notes?.trim?.()||null});
}
export function nutritionEconomics({plan,headCount=0,feedCostMinorPerKg=0,days=1}={}){
  const kgPerDay=Number(plan?.dailyKgPerHead??0)*Number(headCount||0);
  const costPerHeadDayMinor=Number(plan?.dailyKgPerHead??0)*Number(feedCostMinorPerKg||0);
  return Object.freeze({kgPerDay,totalKg:kgPerDay*Math.max(0,Number(days||0)),costPerHeadDayMinor,totalCostMinor:costPerHeadDayMinor*Number(headCount||0)*Math.max(0,Number(days||0))});
}
