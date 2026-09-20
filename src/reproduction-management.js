import {recordReproductionEvent} from './index.js';

const GENETICS='cattle.reproduction-genetics';
const DOSES='cattle.reproduction-dose-stock';
const SEASONS='cattle.breeding-seasons';
const EVENTS='cattle.events';
const ANIMALS='cattle.animals';
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim()};
const integer=(value,label,{min=0}={})=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<min)throw new TypeError(`${label} must be an integer >= ${min}.`);return n};
const iso=(value,label)=>{const time=Date.parse(value);if(!Number.isFinite(time))throw new TypeError(`${label} must be a valid date.`);return new Date(time).toISOString()};
const payloads=records=>(records??[]).map(record=>record?.payload??record);
const positive=value=>['positive','pregnant','yes','sim','positivo','prenhe'].includes(String(value??'').trim().toLowerCase());
const pct=(a,b)=>b?Number(((a/b)*100).toFixed(1)):null;

function aggregateServices(services,pregnantIds,keyOf,labelOf){
  const map=new Map();
  for(const service of services){
    const key=keyOf(service);if(!key)continue;
    const row=map.get(key)??{key,label:labelOf?.(key)??key,services:0,pregnant:0,conceptionRatePct:null};
    row.services+=1;if(pregnantIds.has(service.id))row.pregnant+=1;map.set(key,row);
  }
  return [...map.values()].map(row=>({...row,conceptionRatePct:pct(row.pregnant,row.services)})).sort((a,b)=>(b.conceptionRatePct??-1)-(a.conceptionRatePct??-1)||b.services-a.services);
}

export function createReproductionManagementService(persistence,{audit=null}={}){
  if(!persistence?.listRecords||!persistence?.putRecord)throw new TypeError('Persistence is required.');
  const auditMutation=(actorId,action,entityType,entityId,metadata={})=>audit?.append?.({actorId:actorId??'system',action,entityType,entityId,metadata})??Promise.resolve(null);

  async function save(collection,entity,actorId){
    const current=await persistence.getRecord(collection,entity.id);
    const saved=await persistence.putRecord(collection,entity.id,entity,{expectedVersion:current?.version??0});
    await auditMutation(actorId,`${collection}.save`,collection,entity.id,{});
    return saved;
  }

  async function saveGenetics(input,{actorId='system'}={}){
    const type=text(input?.type,'Genetics type').toLowerCase();
    if(!['bull','semen'].includes(type))throw new TypeError('Genetics type must be bull or semen.');
    const entity={id:text(input?.id,'Genetics id'),type,name:text(input?.name,'Genetics name'),registry:input?.registry?.trim?.()||null,breed:input?.breed?.trim?.()||null,supplier:input?.supplier?.trim?.()||null,active:input?.active!==false,notes:input?.notes?.trim?.()||null};
    return save(GENETICS,entity,actorId);
  }

  async function saveDoseStock(input,{actorId='system'}={}){
    const genetics=await persistence.getRecord(GENETICS,text(input?.geneticsId,'Genetics id'));
    if(!genetics)throw new Error('Genetics not found.');
    if(genetics.payload.type!=='semen')throw new Error('Dose stock requires semen genetics.');
    const entity={id:text(input?.id,'Dose stock id'),geneticsId:genetics.payload.id,batch:text(input?.batch,'Dose batch'),quantityDoses:integer(input?.quantityDoses,'Dose quantity'),minDoses:integer(input?.minDoses??0,'Minimum doses'),expiresAt:input?.expiresAt?iso(input.expiresAt,'Dose expiration'):null,costPerDoseMinor:integer(input?.costPerDoseMinor??0,'Cost per dose'),active:input?.active!==false,notes:input?.notes?.trim?.()||null};
    return save(DOSES,entity,actorId);
  }

  async function adjustDoseStock({id,delta,reason=null,occurredAt=new Date().toISOString()}={}, {actorId='system'}={}){
    const current=await persistence.getRecord(DOSES,text(id,'Dose stock id'));
    if(!current)throw new Error('Dose stock not found.');
    const change=Number(delta);if(!Number.isSafeInteger(change)||change===0)throw new TypeError('Dose delta must be a non-zero integer.');
    const quantityDoses=Number(current.payload.quantityDoses)+change;if(quantityDoses<0)throw new Error('Insufficient semen doses.');
    const next={...current.payload,quantityDoses,lastAdjustment:{delta:change,reason:reason?.trim?.()||null,occurredAt:iso(occurredAt,'Adjustment date')}};
    const saved=await persistence.putRecord(DOSES,next.id,next,{expectedVersion:current.version});
    await auditMutation(actorId,'cattle.reproduction.dose.adjust','reproduction-dose-stock',next.id,{delta:change,reason:next.lastAdjustment.reason});
    return saved;
  }

  async function saveBreedingSeason(input,{actorId='system'}={}){
    const startAt=iso(input?.startAt,'Breeding season start'),endAt=iso(input?.endAt,'Breeding season end');
    if(Date.parse(endAt)<=Date.parse(startAt))throw new Error('Breeding season end must be after start.');
    const status=input?.status??'planned';if(!['planned','active','closed'].includes(status))throw new TypeError('Invalid breeding season status.');
    const target=input?.targetConceptionPct==null?null:Number(input.targetConceptionPct);if(target!=null&&(!Number.isFinite(target)||target<0||target>100))throw new TypeError('Target conception must be between 0 and 100.');
    return save(SEASONS,{id:text(input?.id,'Breeding season id'),name:text(input?.name,'Breeding season name'),startAt,endAt,status,targetConceptionPct:target,notes:input?.notes?.trim?.()||null},actorId);
  }

  async function recordProfessionalService(input,{actorId='system'}={}){
    const animal=await persistence.getRecord(ANIMALS,text(input?.animalId,'Animal id'));
    if(!animal)throw new Error('Animal not found.');
    if(animal.payload.status!=='active'||animal.payload.sex!=='female')throw new Error('Professional reproduction service requires an active female.');
    const genetics=await persistence.getRecord(GENETICS,text(input?.geneticsId,'Genetics id'));
    if(!genetics?.payload?.active)throw new Error('Active genetics not found.');
    const season=await persistence.getRecord(SEASONS,text(input?.breedingSeasonId,'Breeding season id'));
    if(!season)throw new Error('Breeding season not found.');
    const occurredAt=iso(input?.occurredAt,'Service date');
    if(Date.parse(occurredAt)<Date.parse(season.payload.startAt)||Date.parse(occurredAt)>Date.parse(season.payload.endAt))throw new Error('Service date is outside the breeding season.');
    const dosesUsed=genetics.payload.type==='semen'?integer(input?.dosesUsed??1,'Doses used',{min:1}):0;
    const write=async store=>{
      let dose=null;
      if(genetics.payload.type==='semen'){
        dose=await store.getRecord(DOSES,text(input?.doseStockId,'Dose stock id'));
        if(!dose||dose.payload.geneticsId!==genetics.payload.id||!dose.payload.active)throw new Error('Active semen dose stock not found.');
        if(Number(dose.payload.quantityDoses)<dosesUsed)throw new Error('Insufficient semen doses.');
        await store.putRecord(DOSES,dose.payload.id,{...dose.payload,quantityDoses:Number(dose.payload.quantityDoses)-dosesUsed},{expectedVersion:dose.version});
      }
      const metadata={...(input?.metadata??{}),method:input?.method??'natural',protocol:input?.protocol?.trim?.()||null,geneticsId:genetics.payload.id,geneticsName:genetics.payload.name,doseStockId:dose?.payload?.id??null,dosesUsed,breedingSeasonId:season.payload.id,breedingSeason:season.payload.name,bullOrSemen:genetics.payload.name,expectedCalvingAt:input?.expectedCalvingAt?iso(input.expectedCalvingAt,'Expected calving date'):null,notes:input?.notes?.trim?.()||null};
      const event={...recordReproductionEvent({id:text(input?.id,'Reproduction event id'),animalId:animal.payload.id,type:'service',occurredAt,relatedAnimalId:genetics.payload.type==='bull'&&input?.relatedAnimalId?input.relatedAnimalId:null,metadata}),kind:'reproduction'};
      return store.putRecord(EVENTS,event.id,event,{expectedVersion:0});
    };
    const saved=typeof persistence.transaction==='function'?await persistence.transaction(write):await write(persistence);
    await auditMutation(actorId,'cattle.reproduction.professional-service','reproduction-event',saved.payload?.id??input.id,{geneticsId:genetics.payload.id,breedingSeasonId:season.payload.id,dosesUsed});
    return saved;
  }

  async function efficiency(){
    const [eventRecords,geneticsRecords,seasonRecords]=await Promise.all([persistence.listRecords(EVENTS),persistence.listRecords(GENETICS),persistence.listRecords(SEASONS)]);
    const events=payloads(eventRecords).filter(event=>event.kind==='reproduction').slice().sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
    const services=events.filter(event=>event.type==='service'&&(event.metadata?.geneticsId||event.metadata?.breedingSeasonId||event.metadata?.protocol));
    const pregnantIds=new Set();
    for(const check of events.filter(event=>event.type==='pregnancy-check'&&positive(event.metadata?.result))){
      const prior=services.filter(service=>service.animalId===check.animalId&&Date.parse(service.occurredAt)<=Date.parse(check.occurredAt)).at(-1);if(prior)pregnantIds.add(prior.id);
    }
    const genetics=new Map(payloads(geneticsRecords).map(row=>[row.id,row.name]));
    const seasons=new Map(payloads(seasonRecords).map(row=>[row.id,row.name]));
    return{
      summary:{services:services.length,pregnant:pregnantIds.size,conceptionRatePct:pct(pregnantIds.size,services.length)},
      byProtocol:aggregateServices(services,pregnantIds,row=>row.metadata?.protocol),
      byGenetics:aggregateServices(services,pregnantIds,row=>row.metadata?.geneticsId,key=>genetics.get(key)??key),
      bySeason:aggregateServices(services,pregnantIds,row=>row.metadata?.breedingSeasonId,key=>seasons.get(key)??key)
    };
  }

  async function load(){
    const [genetics,doseStocks,seasons,stats]=await Promise.all([persistence.listRecords(GENETICS),persistence.listRecords(DOSES),persistence.listRecords(SEASONS),efficiency()]);
    const now=Date.now(),thirtyDays=30*86400000;
    const stockAlerts=doseStocks.filter(record=>record.payload.active&&(Number(record.payload.quantityDoses)<=Number(record.payload.minDoses)||record.payload.expiresAt&&(Date.parse(record.payload.expiresAt)-now)<=thirtyDays)).map(record=>record.payload);
    return{genetics,doseStocks,seasons,efficiency:stats,stockAlerts};
  }

  return Object.freeze({load,efficiency,saveGenetics,saveDoseStock,adjustDoseStock,saveBreedingSeason,recordProfessionalService});
}
