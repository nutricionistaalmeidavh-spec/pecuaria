import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const optionalText=v=>typeof v==='string'&&v.trim()?v.trim():null;
const iso=(v,l)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw new TypeError(`${l} must be a valid date.`);return new Date(t).toISOString()};
const number=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new TypeError(`${l} must be zero or positive.`);return n};
const finite=(v,l)=>{const n=Number(v);if(!Number.isFinite(n))throw new TypeError(`${l} must be finite.`);return n};
const scale=(score,min,max,label)=>{const value=finite(score,label);if(value<min||value>max)throw new RangeError(`${label} must be within scale ${min}-${max}.`);return value};
const optionalNumber=(v,l)=>v==null||v===''?null:number(v,l);
const operationalStatus=value=>{const status=value==='active'?'available':value??'available';if(!['available','occupied','resting','unavailable'].includes(status))throw new TypeError('Pasture status must be available, occupied, resting or unavailable.');return status};
const polygon=value=>{
  if(value==null)return null;
  if(!Array.isArray(value)||value.length<3)throw new TypeError('Pasture polygon requires at least three points.');
  return Object.freeze(value.map((point,index)=>{const x=finite(point?.x,`Polygon x ${index}`),y=finite(point?.y,`Polygon y ${index}`);if(x<0||x>100||y<0||y>100)throw new RangeError('Pasture polygon coordinates must be within 0 and 100.');return Object.freeze({x,y});}));
};

export const P1_COLLECTIONS=Object.freeze(['cattle.traceability','cattle.inventory','cattle.inventory-movements','cattle.pastures','cattle.pasture-occupancy','cattle.pasture-assessments','cattle.body-condition','cattle.pasture-rotation-plan','cattle.nutrition','cattle.tasks']);

export function createP1Repositories(persistence){return Object.freeze({
  traceability:createEntityRepository(persistence,{collection:'cattle.traceability'}),
  inventory:createEntityRepository(persistence,{collection:'cattle.inventory'}),
  inventoryMovements:createEntityRepository(persistence,{collection:'cattle.inventory-movements'}),
  pastures:createEntityRepository(persistence,{collection:'cattle.pastures'}),
  pastureOccupancy:createEntityRepository(persistence,{collection:'cattle.pasture-occupancy'}),
  pastureAssessments:createEntityRepository(persistence,{collection:'cattle.pasture-assessments'}),
  bodyCondition:createEntityRepository(persistence,{collection:'cattle.body-condition'}),
  pastureRotationPlan:createEntityRepository(persistence,{collection:'cattle.pasture-rotation-plan'}),
  nutrition:createEntityRepository(persistence,{collection:'cattle.nutrition'}),
  tasks:createEntityRepository(persistence,{collection:'cattle.tasks'})
})}

export function createTraceabilityRecord({id,animalId,officialId,type='identity',documentNumber=null,issuer=null,issuedAt,expiresAt=null,notes=null}={}){
  return Object.freeze({id:text(id,'Traceability id'),animalId:text(animalId,'Animal id'),officialId:officialId?.trim?.()||null,type:text(type,'Traceability type'),documentNumber:documentNumber?.trim?.()||null,issuer:issuer?.trim?.()||null,issuedAt:iso(issuedAt,'Issued at'),expiresAt:expiresAt?iso(expiresAt,'Expires at'):null,notes:notes?.trim?.()||null});
}
export function createInventoryItem({id,name,kind='medicine',unit='unit',quantity=0,minQuantity=0,batch=null,expiresAt=null,costMinor=0}={}){
  return Object.freeze({id:text(id,'Inventory id'),name:text(name,'Inventory name'),kind:text(kind,'Inventory kind'),unit:text(unit,'Inventory unit'),quantity:number(quantity,'Quantity'),minQuantity:number(minQuantity,'Minimum quantity'),batch:batch?.trim?.()||null,expiresAt:expiresAt?iso(expiresAt,'Expires at'):null,costMinor:number(costMinor,'Cost')});
}
export function createPasture({id,name,farmUnitId,areaHa,capacityAu=null,status='available',forage=null,color=null,polygon:shape=null,restTargetDays=null,occupancyTargetDays=null,targetHeightCm=null,notes=null}={}){
  return Object.freeze({id:text(id,'Pasture id'),name:text(name,'Pasture name'),farmUnitId:text(farmUnitId,'Farm unit id'),areaHa:number(areaHa,'Area'),capacityAu:capacityAu==null?null:number(capacityAu,'Capacity'),status:operationalStatus(status),forage:optionalText(forage),color:optionalText(color),polygon:polygon(shape),restTargetDays:optionalNumber(restTargetDays,'Rest target days'),occupancyTargetDays:optionalNumber(occupancyTargetDays,'Occupancy target days'),targetHeightCm:optionalNumber(targetHeightCm,'Target height'),notes:optionalText(notes)});
}
export function createPastureAssessment({id,pastureId,occurredAt,score,scaleMin=1,scaleMax=5,heightCm=null,forageMassKgHa=null,groundCoverPct=null,notes=null,photoPaths=[]}={}){
  const min=finite(scaleMin,'Assessment scale minimum'),max=finite(scaleMax,'Assessment scale maximum');if(max<=min)throw new RangeError('Assessment scale maximum must be greater than minimum.');
  if(!Array.isArray(photoPaths)||photoPaths.some(path=>typeof path!=='string'||!path.trim()))throw new TypeError('Pasture photo paths must contain local path strings only.');
  const cover=groundCoverPct==null?null:number(groundCoverPct,'Ground cover');if(cover!=null&&cover>100)throw new RangeError('Ground cover must be within 0 and 100.');
  return Object.freeze({id:text(id,'Pasture assessment id'),pastureId:text(pastureId,'Pasture id'),occurredAt:iso(occurredAt,'Occurred at'),score:scale(score,min,max,'Pasture score'),scaleMin:min,scaleMax:max,heightCm:optionalNumber(heightCm,'Pasture height'),forageMassKgHa:optionalNumber(forageMassKgHa,'Forage mass'),groundCoverPct:cover,notes:optionalText(notes),photoPaths:Object.freeze(photoPaths.map(path=>path.trim()))});
}
export function createBodyCondition({id,animalId,occurredAt,score,scaleId='bovine-1-5',scaleMin=1,scaleMax=5,notes=null}={}){
  const min=finite(scaleMin,'Body condition scale minimum'),max=finite(scaleMax,'Body condition scale maximum');if(max<=min)throw new RangeError('Body condition scale maximum must be greater than minimum.');
  return Object.freeze({id:text(id,'Body condition id'),animalId:text(animalId,'Animal id'),occurredAt:iso(occurredAt,'Occurred at'),score:scale(score,min,max,'Body condition score'),scaleId:text(scaleId,'Body condition scale id'),scaleMin:min,scaleMax:max,notes:optionalText(notes)});
}
export function createPastureRotationPlan({id,pastureId,lotId,plannedEnterAt,plannedLeaveAt,status='planned',notes=null}={}){
  if(!['planned','active','completed','cancelled'].includes(status))throw new TypeError('Rotation status must be planned, active, completed or cancelled.');
  const enter=iso(plannedEnterAt,'Planned enter at'),leave=iso(plannedLeaveAt,'Planned leave at');if(Date.parse(leave)<=Date.parse(enter))throw new RangeError('Planned leave must be after planned enter.');
  return Object.freeze({id:text(id,'Rotation plan id'),pastureId:text(pastureId,'Pasture id'),lotId:text(lotId,'Lot id'),plannedEnterAt:enter,plannedLeaveAt:leave,status,notes:optionalText(notes)});
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
  const enter=iso(enteredAt,'Entered at'),leave=leftAt?iso(leftAt,'Left at'):null;if(leave&&Date.parse(leave)<=Date.parse(enter))throw new RangeError('Left at must be after entered at.');
  return Object.freeze({id:text(id,'Pasture occupancy id'),pastureId:text(pastureId,'Pasture id'),lotId:text(lotId,'Lot id'),enteredAt:enter,leftAt:leave,animalUnits:animalUnits==null?null:number(animalUnits,'Animal units'),notes:notes?.trim?.()||null});
}
export function nutritionEconomics({plan,headCount=0,feedCostMinorPerKg=0,days=1}={}){
  const kgPerDay=Number(plan?.dailyKgPerHead??0)*Number(headCount||0);
  const costPerHeadDayMinor=Number(plan?.dailyKgPerHead??0)*Number(feedCostMinorPerKg||0);
  return Object.freeze({kgPerDay,totalKg:kgPerDay*Math.max(0,Number(days||0)),costPerHeadDayMinor,totalCostMinor:costPerHeadDayMinor*Number(headCount||0)*Math.max(0,Number(days||0))});
}
