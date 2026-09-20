const iso=(v,l)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw new TypeError(`${l} must be a valid date.`);return new Date(t).toISOString()};
const positive=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new TypeError(`${l} must be positive.`);return n};
const money=(v,l)=>{const n=Number(v??0);if(!Number.isSafeInteger(n)||n<0)throw new TypeError(`${l} must be a non-negative integer in minor units.`);return n};

export function moveAnimal(animal,{toLotId,movedAt=new Date().toISOString(),reason='management'}={}){
  if(animal.status!=='active')throw new Error('Only active animal can move.');
  const movement=Object.freeze({fromLotId:animal.lotId??null,toLotId,reason,movedAt:iso(movedAt,'Movement date')});
  return Object.freeze({...animal,lotId:toLotId,movements:Object.freeze([...(animal.movements??[]),movement])});
}

export function recordAnimalLifecycle(animal,{type,occurredAt=new Date().toISOString(),reason=null}={}){
  if(!['birth','death','sale','disposal'].includes(type))throw new TypeError('Unsupported animal lifecycle event.');
  if(type!=='birth'&&animal.status!=='active')throw new Error('Only active animal can be closed.');
  const status=type==='death'?'dead':type==='sale'?'sold':type==='disposal'?'disposed':animal.status;
  const event=Object.freeze({type,occurredAt:iso(occurredAt,'Lifecycle date'),reason});
  return Object.freeze({...animal,status,lifecycle:Object.freeze([...(animal.lifecycle??[]),event])});
}

export function recordSanitaryEvent({
  id,animalId,protocolId=null,productItemId,dose,unit,occurredAt,nextDueAt=null,technicianPartyId=null,
  withdrawalUntil=null,productBatch=null,activeIngredient=null,costMinor=0
}={}){
  return Object.freeze({
    id,animalId,protocolId,productItemId,
    dose:positive(dose,'Dose'),
    unit,
    occurredAt:iso(occurredAt,'Sanitary event date'),
    nextDueAt:nextDueAt?iso(nextDueAt,'Next due date'):null,
    technicianPartyId,
    withdrawalUntil:withdrawalUntil?iso(withdrawalUntil,'Withdrawal date'):null,
    productBatch:productBatch?.trim?.()||null,
    activeIngredient:activeIngredient?.trim?.()||null,
    costMinor:money(costMinor,'Sanitary cost')
  });
}

export function cattleWeightGain(animal){
  if((animal.weights??[]).length<2)return null;
  const first=animal.weights[0],last=animal.weights.at(-1),days=Math.max(1,(Date.parse(last.measuredAt)-Date.parse(first.measuredAt))/86400000);
  return Object.freeze({gainKg:last.weightKg-first.weightKg,dailyGainKg:(last.weightKg-first.weightKg)/days});
}

export function cattleLotKpis(animals,{lotId}={}){
  const scoped=animals.filter(a=>a.lotId===lotId&&a.status==='active'),weights=scoped.map(a=>a.weights?.at(-1)?.weightKg).filter(Number.isFinite);
  return Object.freeze({headCount:scoped.length,averageWeightKg:weights.length?weights.reduce((a,b)=>a+b,0)/weights.length:null});
}
