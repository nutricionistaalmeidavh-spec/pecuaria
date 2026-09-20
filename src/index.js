import {calculateCattleSettlement,hasCommercialSettlementInput} from './commercial.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const positive=(v,l)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new TypeError(`${l} must be positive.`);return v};

export function createCattleLot({id,name,farmUnitId,purpose='beef',metadata={}}={}){
  return Object.freeze({id:text(id,'Lot id'),name:text(name,'Lot name'),farmUnitId:text(farmUnitId,'Farm unit id'),purpose:text(purpose,'Purpose'),metadata:Object.freeze({...metadata})});
}

export function createAnimal({id,tag,farmUnitId,purpose='beef',lotId=null,sex='unknown',status='active',name=null,breedId=null,categoryId=null,birthDate=null,damId=null,sireId=null,rfid=null,officialId=null,origin=null,metadata={}}={}){
  return Object.freeze({id:text(id,'Animal id'),tag:text(tag,'Animal tag'),farmUnitId:text(farmUnitId,'Farm unit id'),purpose:text(purpose,'Purpose'),lotId,sex,status,name:name?.trim?.()||null,breedId:breedId?.trim?.()||null,categoryId:categoryId?.trim?.()||null,birthDate:birthDate||null,damId:damId?.trim?.()||null,sireId:sireId?.trim?.()||null,rfid:rfid?.trim?.()||null,officialId:officialId?.trim?.()||null,origin:origin?.trim?.()||null,weights:Object.freeze([]),milkRecords:Object.freeze([]),metadata:Object.freeze({...metadata})});
}

export function recordWeight(animal,{weightKg,measuredAt}={}){
  const weight=positive(weightKg,'Weight'),at=text(measuredAt,'Measured at'),last=animal.weights.at(-1);
  if(last&&new Date(at)<new Date(last.measuredAt))throw new Error('Weight history must be chronological.');
  return Object.freeze({...animal,weights:Object.freeze([...animal.weights,Object.freeze({weightKg:weight,measuredAt:at})])});
}

export function recordMilkProduction(animal,{liters,measuredAt}={}){
  if(animal.purpose!=='dairy')throw new Error('Milk production requires dairy purpose.');
  return Object.freeze({...animal,milkRecords:Object.freeze([...animal.milkRecords,Object.freeze({liters:positive(liters,'Liters'),measuredAt:text(measuredAt,'Measured at')})])});
}

export function recordReproductionEvent({id,animalId,type,occurredAt,relatedAnimalId=null,metadata={}}={}){
  if(!new Set(['service','pregnancy-check','calving','weaning','pregnancy-loss','abortion']).has(type))throw new Error('Unsupported reproduction event type.');
  return Object.freeze({id:text(id,'Reproduction event id'),animalId:text(animalId,'Animal id'),type,occurredAt:text(occurredAt,'Occurred at'),relatedAnimalId,metadata:Object.freeze({...metadata})});
}

export function createCattleTrade({
  id,type,partyId,animalIds=[],totalAmountMinor=null,occurredAt,metadata={},
  liveWeightKg=null,carcassWeightKg=null,carcassYieldPct=null,pricePerCarcassArrobaMinor=null,
  deductionsMinor=0,freightMinor=0,commissionMinor=0
}={}){
  if(!['purchase','sale'].includes(type))throw new Error('Trade type must be purchase or sale.');
  let settlement=null;
  if(type==='sale'&&hasCommercialSettlementInput({liveWeightKg,carcassWeightKg,carcassYieldPct,pricePerCarcassArrobaMinor})){
    settlement=calculateCattleSettlement({liveWeightKg,carcassWeightKg,carcassYieldPct,pricePerCarcassArrobaMinor,deductionsMinor,freightMinor,commissionMinor});
  }
  const resolvedTotal=settlement?.netMinor??totalAmountMinor;
  if(!Number.isSafeInteger(resolvedTotal)||resolvedTotal<=0)throw new TypeError('Total amount must be a positive integer in minor units.');
  if(settlement&&totalAmountMinor!=null&&Number(totalAmountMinor)!==settlement.netMinor)throw new Error('Total amount differs from calculated commercial settlement.');
  return Object.freeze({
    id:text(id,'Trade id'),
    type,
    partyId:text(partyId,'Party id'),
    animalIds:Object.freeze([...new Set(animalIds)]),
    totalAmountMinor:resolvedTotal,
    occurredAt:text(occurredAt,'Occurred at'),
    metadata:Object.freeze({...metadata,...(settlement?{settlement}:{})})
  });
}

export * from './catalog.js';
export * from './operations.js';
export * from './finance.js';
export * from './finance-admin.js';
export * from './commercial.js';
export * from './reproduction.js';
export * from './documents.js';
export * from './security.js';
export * from './ui.js';
export * from './presentation.js';
export * from './p1.js';
