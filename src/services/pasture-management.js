import {createP1Repositories,createPasture,createPastureAssessment,createBodyCondition,createPastureRotationPlan,createPastureOccupancy} from '../p1.js';

const rows=records=>(records??[]).map(record=>record?.payload??record);
const entityOf=value=>value?.payload??value;
const required=(value,label)=>{if(!value)throw new Error(`${label} not found.`);return value};
const tx=(persistence,fn)=>typeof persistence.transaction==='function'?persistence.transaction(fn):fn(persistence);
const dayMs=86400000;
const days=(from,to)=>{const a=Date.parse(from),b=Date.parse(to);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,(b-a)/dayMs):null};
const reposFor=store=>createP1Repositories(store);

export function legacyPastureStatus(status){return status==='active'?'available':status??'available'}

export function createPastureManagementService(persistence){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=reposFor(persistence);

  async function savePasture(input){const entity=createPasture(input),current=await repos.pastures.get(entity.id);return entityOf(await repos.pastures.save(entity,{expectedVersion:current?.version??0}));}
  async function recordAssessment(input){required(await repos.pastures.get(input?.pastureId),'Pasture');const entity=createPastureAssessment(input);return entityOf(await repos.pastureAssessments.save(entity,{expectedVersion:0}));}
  async function recordBodyCondition(input){required(await persistence.getRecord('cattle.animals',input?.animalId),'Animal');const entity=createBodyCondition(input);return entityOf(await repos.bodyCondition.save(entity,{expectedVersion:0}));}
  async function saveRotationPlan(input){required(await repos.pastures.get(input?.pastureId),'Pasture');required(await persistence.getRecord('cattle.lots',input?.lotId),'Lot');const entity=createPastureRotationPlan(input),current=await repos.pastureRotationPlan.get(entity.id);return entityOf(await repos.pastureRotationPlan.save(entity,{expectedVersion:current?.version??0}));}

  async function enterLot(input){return entityOf(await tx(persistence,async store=>{const scoped=reposFor(store);required(await scoped.pastures.get(input?.pastureId),'Pasture');required(await store.getRecord('cattle.lots',input?.lotId),'Lot');const active=rows(await scoped.pastureOccupancy.list()).find(item=>item.lotId===input.lotId&&!item.leftAt);if(active)throw new Error(`Lot already has active pasture occupancy: ${active.id}.`);const entity=createPastureOccupancy(input);return scoped.pastureOccupancy.save(entity,{expectedVersion:0});}));}
  async function leaveLot({id,leftAt}={}){return entityOf(await tx(persistence,async store=>{const scoped=reposFor(store),current=required(await scoped.pastureOccupancy.get(id),'Pasture occupancy');if(current.payload.leftAt)return current;const next=createPastureOccupancy({...current.payload,leftAt});return scoped.pastureOccupancy.save(next,{expectedVersion:current.version});}));}

  async function snapshot({now=new Date().toISOString()}={}){
    const nowTime=Date.parse(now);if(!Number.isFinite(nowTime))throw new TypeError('Pasture snapshot now must be a valid date.');
    const [pastureRecords,occupancyRecords,assessmentRecords,bodyRecords,planRecords]=await Promise.all([repos.pastures.list(),repos.pastureOccupancy.list(),repos.pastureAssessments.list(),repos.bodyCondition.list(),repos.pastureRotationPlan.list()]);
    const pastures=rows(pastureRecords),occupancy=rows(occupancyRecords),assessments=rows(assessmentRecords),plans=rows(planRecords);
    const enriched=pastures.map(pasture=>{
      const history=occupancy.filter(item=>item.pastureId===pasture.id),active=history.filter(item=>!item.leftAt),lastExit=history.map(item=>item.leftAt).filter(Boolean).sort().at(-1)??null,manual=legacyPastureStatus(pasture.status),restDays=lastExit?days(lastExit,now):null;
      let operationalStatus=manual;if(manual!=='unavailable'){if(active.length)operationalStatus='occupied';else if(lastExit&&Number(pasture.restTargetDays??0)>0&&restDays<Number(pasture.restTargetDays))operationalStatus='resting';else operationalStatus='available';}
      const latestAssessment=assessments.filter(item=>item.pastureId===pasture.id).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt))).at(-1)??null;
      return Object.freeze({...pasture,status:legacyPastureStatus(pasture.status),operationalStatus,restDays,activeOccupancies:active,latestAssessment});
    });
    return Object.freeze({pastures:Object.freeze(enriched),occupancy:Object.freeze(occupancy),assessments:Object.freeze(assessments),bodyCondition:Object.freeze(rows(bodyRecords)),rotationPlans:Object.freeze(plans)});
  }

  return Object.freeze({savePasture,recordAssessment,recordBodyCondition,saveRotationPlan,enterLot,leaveLot,snapshot});
}
