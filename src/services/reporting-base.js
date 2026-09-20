import {calculateCattleSettlement} from '../commercial.js';
import {reproductionMetrics} from '../reproduction.js';

const payloads=records=>(records??[]).map(record=>record?.payload??record);
const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):0;
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const percent=(num,den)=>den>0?(num/den)*100:null;
const escapeCsv=value=>{const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text};
const toCsv=rows=>{const columns=rows.length?Object.keys(rows[0]):[];return [columns.join(','),...rows.map(row=>columns.map(column=>escapeCsv(row[column])).join(','))].join('\n')};
const dayMs=86400000;
const daysBetween=(start,end)=>{const a=Date.parse(start),b=Date.parse(end);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,(b-a)/dayMs):null};
const round=(value,digits=2)=>value==null||!Number.isFinite(Number(value))?null:Number(Number(value).toFixed(digits));
const positiveResult=value=>['positive','pregnant','yes','sim','positivo','prenhe'].includes(String(value??'').trim().toLowerCase());
const latestWeight=animal=>{
  const values=(animal?.weights??[]).filter(item=>finite(item?.weightKg)&&Number.isFinite(Date.parse(item?.measuredAt))).slice().sort((a,b)=>Date.parse(a.measuredAt)-Date.parse(b.measuredAt));
  return values.at(-1)??null;
};
const weightGain=animal=>{
  const values=(animal?.weights??[]).filter(item=>finite(item?.weightKg)&&Number.isFinite(Date.parse(item?.measuredAt))).slice().sort((a,b)=>Date.parse(a.measuredAt)-Date.parse(b.measuredAt));
  if(values.length<2)return null;
  const first=values[0],last=values.at(-1),days=Math.max(1,(Date.parse(last.measuredAt)-Date.parse(first.measuredAt))/dayMs),gainKg=Number(last.weightKg)-Number(first.weightKg);
  return{first,last,days,gainKg,dailyGainKg:gainKg/days};
};

function financeForLot(entries,lotId){
  const scoped=entries.filter(entry=>entry?.lotId===lotId||entry?.allocation?.id===lotId);
  let costMinor=0,incomeMinor=0;
  for(const entry of scoped){
    const amount=number(entry?.amountMinor);
    const direction=entry?.direction??entry?.kind;
    if(direction==='expense'||direction==='cost')costMinor+=amount;
    if(direction==='income'||direction==='revenue')incomeMinor+=amount;
  }
  return{costMinor,incomeMinor,resultMinor:incomeMinor-costMinor};
}

function groupCount(rows,keyOf){
  const map=new Map();
  for(const row of rows){const key=keyOf(row);if(!key)continue;map.set(key,(map.get(key)??0)+1);}
  return [...map.entries()].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count);
}

export function createCattleReportingService(persistence){
  if(!persistence?.listRecords)throw new TypeError('Persistence is required.');

  async function animalHistory({animalId}={}){
    if(!animalId)throw new TypeError('animalId is required.');
    const [animals,events]=await Promise.all([persistence.listRecords('cattle.animals'),persistence.listRecords('cattle.events')]);
    const animal=payloads(animals).find(item=>item?.id===animalId);
    if(!animal)throw new Error('Animal not found.');
    const related=payloads(events).filter(event=>event?.animalId===animalId);
    const latest=latestWeight(animal);
    return{type:'animal-history',rows:[{
      animalId:animal.id,tag:animal.tag??'',name:animal.name??'',lotId:animal.lotId??'',status:animal.status??'',
      latestWeightKg:finite(latest?.weightKg)?Number(latest.weightKg):null,latestWeightAt:latest?.measuredAt??null,
      sanitaryEvents:related.filter(event=>event.kind==='sanitary').length,
      reproductionEvents:related.filter(event=>event.kind==='reproduction').length
    }]};
  }

  async function lotKpis({lotId=null}={}){
    const [lots,animals,finance]=await Promise.all([
      persistence.listRecords('cattle.lots'),persistence.listRecords('cattle.animals'),persistence.listRecords('cattle.finance')
    ]);
    const lotRows=payloads(lots).filter(lot=>!lotId||lot?.id===lotId);
    const animalRows=payloads(animals),financeRows=payloads(finance);
    return{type:'lot-kpis',rows:lotRows.map(lot=>{
      const active=animalRows.filter(animal=>animal?.lotId===lot.id&&animal?.status==='active');
      const weights=active.map(animal=>latestWeight(animal)?.weightKg).filter(finite).map(Number);
      const dailyGains=active.map(animal=>weightGain(animal)?.dailyGainKg).filter(finite).map(Number);
      const money=financeForLot(financeRows,lot.id);
      return{lotId:lot.id,lotName:lot.name??'',activeAnimals:active.length,averageWeightKg:average(weights),averageDailyGainKg:average(dailyGains),...money};
    })};
  }

  async function sanitary(){
    const events=payloads(await persistence.listRecords('cattle.events')).filter(event=>event?.kind==='sanitary');
    return{type:'sanitary',rows:events.map(event=>({
      id:event.id,animalId:event.animalId??'',protocolId:event.protocolId??'',performedAt:event.performedAt??event.occurredAt??event.at??'',nextDueAt:event.nextDueAt??'',withdrawalUntil:event.withdrawalUntil??'',productItemId:event.productItemId??'',productBatch:event.productBatch??'',costMinor:event.costMinor??0
    }))};
  }

  async function inventory(){const items=payloads(await persistence.listRecords('cattle.inventory'));return{type:'inventory',rows:items.map(x=>({id:x.id,name:x.name,kind:x.kind,quantity:x.quantity,minQuantity:x.minQuantity,unit:x.unit,batch:x.batch??'',expiresAt:x.expiresAt??'',costMinor:x.costMinor??0}))};}
  async function traceability(){const items=payloads(await persistence.listRecords('cattle.traceability'));return{type:'traceability',rows:items.map(x=>({id:x.id,animalId:x.animalId,officialId:x.officialId??'',type:x.type,documentNumber:x.documentNumber??'',issuer:x.issuer??'',issuedAt:x.issuedAt,expiresAt:x.expiresAt??''}))};}
  async function pasture(){const [areas,occupancy]=await Promise.all([persistence.listRecords('cattle.pastures'),persistence.listRecords('cattle.pasture-occupancy')]);const occ=payloads(occupancy);return{type:'pasture',rows:payloads(areas).map(x=>({id:x.id,name:x.name,areaHa:x.areaHa,capacityAu:x.capacityAu??'',status:x.status,forage:x.forage??'',activeOccupancies:occ.filter(o=>o.pastureId===x.id&&!o.leftAt).length}))};}
  async function tasks(){const items=payloads(await persistence.listRecords('cattle.tasks'));return{type:'tasks',rows:items.map(x=>({id:x.id,title:x.title,kind:x.kind,dueAt:x.dueAt,status:x.status,animalId:x.animalId??'',lotId:x.lotId??''}))};}

  async function reproductionReport({lotId=null}={}){
    const [events,animals]=await Promise.all([persistence.listRecords('cattle.events'),persistence.listRecords('cattle.animals')]);
    const animalRows=payloads(animals),allowed=lotId?new Set(animalRows.filter(a=>a.lotId===lotId).map(a=>a.id)):null;
    return{type:'reproduction',rows:payloads(events).filter(event=>event.kind==='reproduction'&&(!allowed||allowed.has(event.animalId))).map(event=>({id:event.id,animalId:event.animalId,type:event.type,occurredAt:event.occurredAt,method:event.metadata?.method??'',bullOrSemen:event.metadata?.bullOrSemen??'',result:event.metadata?.result??'',expectedCalvingAt:event.metadata?.expectedCalvingAt??'',protocol:event.metadata?.protocol??event.metadata?.protocolId??''}))};
  }

  async function commercialReport(){
    const trades=payloads(await persistence.listRecords('cattle.trades'));
    return{type:'commercial',rows:trades.map(trade=>{const s=trade.metadata?.settlement??{};return{id:trade.id,type:trade.type,partyId:trade.partyId,occurredAt:trade.occurredAt,animals:(trade.animalIds??[]).length,liveWeightKg:s.liveWeightKg??'',carcassWeightKg:s.carcassWeightKg??'',carcassYieldPct:s.carcassYieldPct??'',carcassArrobas:s.carcassArrobas??'',grossMinor:s.grossMinor??trade.totalAmountMinor??0,netMinor:s.netMinor??trade.totalAmountMinor??0};})};
  }

  async function nutritionReport(){
    const [plans,animals,inventory]=await Promise.all([persistence.listRecords('cattle.nutrition'),persistence.listRecords('cattle.animals'),persistence.listRecords('cattle.inventory')]);
    const animalRows=payloads(animals),items=payloads(inventory);
    return{type:'nutrition',rows:payloads(plans).map(plan=>{const headCount=animalRows.filter(a=>a.status==='active'&&a.lotId===plan.lotId).length;const dailyKg=number(plan.dailyKgPerHead)*headCount;const item=items.find(i=>i.id===plan.feedItemId);const dailyCostMinor=dailyKg*number(item?.costMinor);return{id:plan.id,name:plan.name,lotId:plan.lotId,feedItemId:plan.feedItemId??'',headCount,dailyKgPerHead:plan.dailyKgPerHead,dailyKg,dailyCostMinor,startsAt:plan.startsAt,endsAt:plan.endsAt??''};})};
  }

  async function financeReport(){
    const entries=payloads(await persistence.listRecords('cattle.finance'));
    return{type:'finance',rows:entries.map(entry=>({id:entry.id,direction:entry.direction??entry.kind,lotId:entry.lotId??entry.allocation?.id??'',amountMinor:entry.amountMinor??0,description:entry.description??'',category:entry.metadata?.category??'',tradeId:entry.metadata?.tradeId??''}))};
  }

  async function performanceReport({lotId=null}={}){
    const animals=payloads(await persistence.listRecords('cattle.animals')).filter(a=>a.status==='active'&&(!lotId||a.lotId===lotId));
    return{type:'performance',rows:animals.map(animal=>{const latest=latestWeight(animal),gain=weightGain(animal);return{animalId:animal.id,tag:animal.tag??'',lotId:animal.lotId??'',latestWeightKg:latest?.weightKg??'',latestWeightAt:latest?.measuredAt??'',dailyGainKg:gain?.dailyGainKg??'',projectedWeight30d:gain&&latest?Number(latest.weightKg)+(gain.dailyGainKg*30):''};})};
  }

  async function pastureInsights({now=new Date().toISOString()}={}){
    const [areas,occupancy,animals]=await Promise.all([persistence.listRecords('cattle.pastures'),persistence.listRecords('cattle.pasture-occupancy'),persistence.listRecords('cattle.animals')]);
    const areaRows=payloads(areas),occRows=payloads(occupancy),animalRows=payloads(animals).filter(a=>a.status==='active');
    const rows=areaRows.map(area=>{
      const history=occRows.filter(o=>o.pastureId===area.id),active=history.filter(o=>!o.leftAt),lotIds=new Set(active.map(o=>o.lotId));
      const herd=animalRows.filter(a=>lotIds.has(a.lotId)),recordedAu=active.reduce((sum,o)=>sum+number(o.animalUnits),0),areaHa=number(area.areaHa),capacityAu=area.capacityAu==null?null:number(area.capacityAu);
      const totalWeightKg=herd.reduce((sum,a)=>sum+number(latestWeight(a)?.weightKg),0),utilizationPct=capacityAu&&capacityAu>0?percent(recordedAu,capacityAu):null;
      const activeEntries=active.map(o=>Date.parse(o.enteredAt)).filter(Number.isFinite),lastExits=history.map(o=>Date.parse(o.leftAt)).filter(Number.isFinite);
      const occupiedSince=activeEntries.length?new Date(Math.min(...activeEntries)).toISOString():null,lastExitAt=lastExits.length?new Date(Math.max(...lastExits)).toISOString():null;
      return{id:area.id,name:area.name,areaHa,capacityAu,headCount:herd.length,recordedAu:round(recordedAu),stockingAuHa:areaHa>0?round(recordedAu/areaHa):null,capacityAuHa:areaHa>0&&capacityAu!=null?round(capacityAu/areaHa):null,utilizationPct:round(utilizationPct),occupancyDays:occupiedSince?round(daysBetween(occupiedSince,now),1):0,restDays:!active.length&&lastExitAt?round(daysBetween(lastExitAt,now),1):0,totalWeightKg:round(totalWeightKg,1),kgPerHa:areaHa>0?round(totalWeightKg/areaHa,1):null,liveArrobasPerHa:areaHa>0?round((totalWeightKg/15)/areaHa,2):null,pressure:utilizationPct==null?'unknown':utilizationPct>100?'high':utilizationPct>=85?'attention':'balanced'};
    });
    return{rows,summary:{areas:rows.length,totalHa:round(rows.reduce((s,r)=>s+r.areaHa,0),2),occupied:rows.filter(r=>r.headCount>0).length,overCapacity:rows.filter(r=>r.utilizationPct!=null&&r.utilizationPct>100).length,averageStockingAuHa:round(average(rows.map(r=>r.stockingAuHa).filter(finite)),2)}};
  }

  async function reproductionInsights({now=new Date().toISOString()}={}){
    const [events,animals]=await Promise.all([persistence.listRecords('cattle.events'),persistence.listRecords('cattle.animals')]);
    const rows=payloads(events).filter(e=>e.kind==='reproduction').slice().sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)),animalRows=payloads(animals),eligibleFemaleIds=animalRows.filter(a=>a.status==='active'&&a.sex==='female').map(a=>a.id);
    const base=reproductionMetrics(rows,{eligibleFemaleIds}),byAnimal=new Map();
    for(const event of rows){if(!byAnimal.has(event.animalId))byAnimal.set(event.animalId,[]);byAnimal.get(event.animalId).push(event);}
    const calvingIntervals=[],daysOpen=[];
    for(const list of byAnimal.values()){
      const calvings=list.filter(e=>e.type==='calving');for(let i=1;i<calvings.length;i++){const d=daysBetween(calvings[i-1].occurredAt,calvings[i].occurredAt);if(d!=null)calvingIntervals.push(d);}
      for(const calving of calvings){const service=list.find(e=>e.type==='service'&&Date.parse(e.occurredAt)>Date.parse(calving.occurredAt));const d=service?daysBetween(calving.occurredAt,service.occurredAt):null;if(d!=null)daysOpen.push(d);}
    }
    const services=rows.filter(e=>e.type==='service'),positiveChecks=rows.filter(e=>e.type==='pregnancy-check'&&positiveResult(e.metadata?.result));
    const sireStats=new Map();
    for(const service of services){const key=service.metadata?.bullOrSemen;if(!key)continue;const stat=sireStats.get(key)??{key,services:0,servedAnimals:new Set(),pregnantAnimals:new Set()};stat.services++;stat.servedAnimals.add(service.animalId);if(positiveChecks.some(check=>check.animalId===service.animalId&&Date.parse(check.occurredAt)>=Date.parse(service.occurredAt)))stat.pregnantAnimals.add(service.animalId);sireStats.set(key,stat);}
    const bySire=[...sireStats.values()].map(x=>({name:x.key,services:x.services,servedFemales:x.servedAnimals.size,pregnantFemales:x.pregnantAnimals.size,conceptionRatePct:round(percent(x.pregnantAnimals.size,x.servedAnimals.size),1)})).sort((a,b)=>(b.conceptionRatePct??-1)-(a.conceptionRatePct??-1));
    const expectedCalvings=rows.filter(e=>e.metadata?.expectedCalvingAt&&Date.parse(e.metadata.expectedCalvingAt)>=Date.parse(now)&&daysBetween(now,e.metadata.expectedCalvingAt)<=60).length;
    return{metrics:{...base,averageCalvingIntervalDays:round(average(calvingIntervals),1),averageDaysOpen:round(average(daysOpen),1),expectedCalvings60d:expectedCalvings},bySire,byMethod:groupCount(services,e=>e.metadata?.method),byProtocol:groupCount(services,e=>e.metadata?.protocol??e.metadata?.protocolId)};
  }

  async function sanitaryInsights({now=new Date().toISOString(),coverageDays=365}={}){
    const [events,animals]=await Promise.all([persistence.listRecords('cattle.events'),persistence.listRecords('cattle.animals')]);
    const rows=payloads(events).filter(e=>e.kind==='sanitary'),activeAnimals=payloads(animals).filter(a=>a.status==='active'),cutoff=Date.parse(now)-(Number(coverageDays)||365)*dayMs;
    const recent=rows.filter(e=>Date.parse(e.occurredAt??e.performedAt??e.at)>=cutoff),covered=new Set(recent.map(e=>e.animalId));
    const overdue=rows.filter(e=>e.nextDueAt&&Date.parse(e.nextDueAt)<Date.parse(now)),withdrawal=rows.filter(e=>e.withdrawalUntil&&Date.parse(e.withdrawalUntil)>Date.parse(now));
    const totalCostMinor=rows.reduce((sum,e)=>sum+number(e.costMinor),0);
    return{summary:{events:rows.length,activeAnimals:activeAnimals.length,coveredAnimals:covered.size,coveragePct:round(percent(covered.size,activeAnimals.length),1),overdue:overdue.length,activeWithdrawal:withdrawal.length,totalCostMinor},byProtocol:groupCount(rows,e=>e.protocolId),byProduct:groupCount(rows,e=>e.productItemId),overdue:overdue.slice(0,25),activeWithdrawal:withdrawal.slice(0,25)};
  }

  async function performanceInsights({lotId=null,targetDailyGainKg=null}={}){
    const animals=payloads(await persistence.listRecords('cattle.animals')).filter(a=>a.status==='active'&&(!lotId||a.lotId===lotId));
    const rows=animals.map(animal=>{const latest=latestWeight(animal),gain=weightGain(animal);return{id:animal.id,tag:animal.tag??animal.name??animal.id,lotId:animal.lotId??null,latestWeightKg:latest?Number(latest.weightKg):null,dailyGainKg:gain?round(gain.dailyGainKg,3):null,totalGainKg:gain?round(gain.gainKg,1):null,projectedWeight30d:gain&&latest?round(Number(latest.weightKg)+(gain.dailyGainKg*30),1):null,projectedWeight60d:gain&&latest?round(Number(latest.weightKg)+(gain.dailyGainKg*60),1):null,projectedWeight90d:gain&&latest?round(Number(latest.weightKg)+(gain.dailyGainKg*90),1):null};}).filter(r=>r.latestWeightKg!=null);
    const ranked=rows.slice().sort((a,b)=>(b.dailyGainKg??-Infinity)-(a.dailyGainKg??-Infinity));
    const gains=rows.map(r=>r.dailyGainKg).filter(finite),averageDailyGainKg=average(gains),target=targetDailyGainKg==null?averageDailyGainKg:Number(targetDailyGainKg);
    return{summary:{animals:rows.length,averageWeightKg:round(average(rows.map(r=>r.latestWeightKg).filter(finite)),1),averageDailyGainKg:round(averageDailyGainKg,3),targetDailyGainKg:round(target,3),belowTarget:target==null?0:rows.filter(r=>r.dailyGainKg!=null&&r.dailyGainKg<target).length},ranking:ranked.slice(0,25),belowTarget:target==null?[]:ranked.filter(r=>r.dailyGainKg!=null&&r.dailyGainKg<target).slice(-25).reverse()};
  }

  async function financeInsights(){
    const [entries,lots,animals]=await Promise.all([persistence.listRecords('cattle.finance'),persistence.listRecords('cattle.lots'),persistence.listRecords('cattle.animals')]);
    const entryRows=payloads(entries),lotRows=payloads(lots),animalRows=payloads(animals);
    const rows=lotRows.map(lot=>{const money=financeForLot(entryRows,lot.id),headCount=animalRows.filter(a=>a.status==='active'&&a.lotId===lot.id).length;return{lotId:lot.id,lotName:lot.name??lot.id,headCount,...money,costPerHeadMinor:headCount?money.costMinor/headCount:null,marginPct:money.incomeMinor>0?percent(money.resultMinor,money.incomeMinor):null};});
    const total=rows.reduce((acc,row)=>({costMinor:acc.costMinor+row.costMinor,incomeMinor:acc.incomeMinor+row.incomeMinor,resultMinor:acc.resultMinor+row.resultMinor}),{costMinor:0,incomeMinor:0,resultMinor:0});
    return{summary:{...total,marginPct:total.incomeMinor>0?round(percent(total.resultMinor,total.incomeMinor),1):null},lots:rows.sort((a,b)=>b.resultMinor-a.resultMinor)};
  }

  async function commercialInsights(){
    const trades=payloads(await persistence.listRecords('cattle.trades')).filter(t=>t.type==='sale');
    const settled=trades.map(t=>t.metadata?.settlement).filter(Boolean),net=settled.reduce((s,x)=>s+number(x.netMinor),0),gross=settled.reduce((s,x)=>s+number(x.grossMinor),0);
    return{summary:{sales:trades.length,settledSales:settled.length,grossMinor:gross,netMinor:net,averageYieldPct:round(average(settled.map(x=>x.carcassYieldPct).filter(finite)),2),averageCarcassArrobas:round(average(settled.map(x=>x.carcassArrobas).filter(finite)),2)},recent:trades.slice().sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0,20)};
  }

  async function simulateSale({animalIds=[],lotId=null,carcassYieldPct,pricePerCarcassArrobaMinor,deductionsMinor=0,freightMinor=0,commissionMinor=0}={}){
    const animals=payloads(await persistence.listRecords('cattle.animals'));
    const ids=new Set(animalIds??[]);const selected=animals.filter(a=>(ids.size?ids.has(a.id):lotId?a.lotId===lotId:false)&&a.status==='active');
    if(!selected.length)throw new Error('Select at least one active animal or a lot with active animals.');
    const missing=selected.filter(a=>!latestWeight(a));if(missing.length)throw new Error(`Animals without a valid weight: ${missing.map(a=>a.tag??a.id).join(', ')}.`);
    const liveWeightKg=selected.reduce((sum,a)=>sum+Number(latestWeight(a).weightKg),0),settlement=calculateCattleSettlement({liveWeightKg,carcassYieldPct,pricePerCarcassArrobaMinor,deductionsMinor,freightMinor,commissionMinor});
    return{animalCount:selected.length,animalIds:selected.map(a=>a.id),averageLiveWeightKg:round(liveWeightKg/selected.length,1),...settlement};
  }

  async function insights(scope,options={}){
    if(scope==='pastures')return pastureInsights(options);
    if(scope==='reproduction')return reproductionInsights(options);
    if(scope==='sanitary')return sanitaryInsights(options);
    if(scope==='performance')return performanceInsights(options);
    if(scope==='finance')return financeInsights(options);
    if(scope==='commercial')return commercialInsights(options);
    throw new Error(`Unknown decision insight scope: ${scope}`);
  }

  async function build(type,options={}){
    if(type==='animal-history')return animalHistory(options);
    if(type==='lot-kpis')return lotKpis(options);
    if(type==='sanitary')return sanitary(options);
    if(type==='inventory')return inventory(options);
    if(type==='traceability')return traceability(options);
    if(type==='pasture')return pasture(options);
    if(type==='tasks')return tasks(options);
    if(type==='reproduction')return reproductionReport(options);
    if(type==='commercial')return commercialReport(options);
    if(type==='nutrition')return nutritionReport(options);
    if(type==='finance')return financeReport(options);
    if(type==='performance')return performanceReport(options);
    throw new Error(`Unknown report type: ${type}`);
  }

  return Object.freeze({build,insights,simulateSale,pastureInsights,reproductionInsights,sanitaryInsights,performanceInsights,financeInsights,commercialInsights,async csv(type,options={}){return toCsv((await build(type,options)).rows)}});
}
