const payloads=records=>(records??[]).map(record=>record?.payload??record);
const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):0;
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const escapeCsv=value=>{const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text};
const toCsv=rows=>{const columns=rows.length?Object.keys(rows[0]):[];return [columns.join(','),...rows.map(row=>columns.map(column=>escapeCsv(row[column])).join(','))].join('\n')};

function financeForLot(entries,lotId){
  const scoped=entries.filter(entry=>entry?.lotId===lotId||entry?.allocation?.id===lotId);
  let costMinor=0,incomeMinor=0;
  for(const entry of scoped){
    const amount=number(entry?.amountMinor);
    const direction=entry?.direction??entry?.kind;
    if(direction==='expense'||direction==='cost')costMinor+=amount;
    if(direction==='income'||direction==='revenue')incomeMinor+=amount;
  }
  return{costMinor,incomeMinor};
}

export function createCattleReportingService(persistence){
  if(!persistence?.listRecords)throw new TypeError('Persistence is required.');

  async function animalHistory({animalId}={}){
    if(!animalId)throw new TypeError('animalId is required.');
    const [animals,events]=await Promise.all([persistence.listRecords('cattle.animals'),persistence.listRecords('cattle.events')]);
    const animal=payloads(animals).find(item=>item?.id===animalId);
    if(!animal)throw new Error('Animal not found.');
    const related=payloads(events).filter(event=>event?.animalId===animalId);
    const latest=Array.isArray(animal.weights)&&animal.weights.length?animal.weights.at(-1):null;
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
      const weights=active.map(animal=>animal?.weights?.at(-1)?.weightKg).filter(finite).map(Number);
      const dailyGains=active.map(animal=>{const h=(animal?.weights??[]).filter(w=>finite(w?.weightKg)&&Date.parse(w?.measuredAt));if(h.length<2)return null;const first=h[0],last=h.at(-1),days=Math.max(1,(Date.parse(last.measuredAt)-Date.parse(first.measuredAt))/86400000);return(Number(last.weightKg)-Number(first.weightKg))/days}).filter(finite).map(Number);
      const money=financeForLot(financeRows,lot.id);
      return{lotId:lot.id,lotName:lot.name??'',activeAnimals:active.length,averageWeightKg:average(weights),averageDailyGainKg:average(dailyGains),...money};
    })};
  }

  async function sanitary(){
    const events=payloads(await persistence.listRecords('cattle.events')).filter(event=>event?.kind==='sanitary');
    return{type:'sanitary',rows:events.map(event=>({
      id:event.id,animalId:event.animalId??'',protocolId:event.protocolId??'',performedAt:event.performedAt??event.at??'',nextDueAt:event.nextDueAt??''
    }))};
  }


  async function inventory(){const items=payloads(await persistence.listRecords('cattle.inventory'));return{type:'inventory',rows:items.map(x=>({id:x.id,name:x.name,kind:x.kind,quantity:x.quantity,minQuantity:x.minQuantity,unit:x.unit,batch:x.batch??'',expiresAt:x.expiresAt??'',costMinor:x.costMinor??0}))};}
  async function traceability(){const items=payloads(await persistence.listRecords('cattle.traceability'));return{type:'traceability',rows:items.map(x=>({id:x.id,animalId:x.animalId,officialId:x.officialId??'',type:x.type,documentNumber:x.documentNumber??'',issuer:x.issuer??'',issuedAt:x.issuedAt,expiresAt:x.expiresAt??''}))};}
  async function pasture(){const [areas,occupancy]=await Promise.all([persistence.listRecords('cattle.pastures'),persistence.listRecords('cattle.pasture-occupancy')]);const occ=payloads(occupancy);return{type:'pasture',rows:payloads(areas).map(x=>({id:x.id,name:x.name,areaHa:x.areaHa,capacityAu:x.capacityAu??'',status:x.status,forage:x.forage??'',activeOccupancies:occ.filter(o=>o.pastureId===x.id&&!o.leftAt).length}))};}
  async function tasks(){const items=payloads(await persistence.listRecords('cattle.tasks'));return{type:'tasks',rows:items.map(x=>({id:x.id,title:x.title,kind:x.kind,dueAt:x.dueAt,status:x.status,animalId:x.animalId??'',lotId:x.lotId??''}))};}

  async function build(type,options={}){
    if(type==='animal-history')return animalHistory(options);
    if(type==='lot-kpis')return lotKpis(options);
    if(type==='sanitary')return sanitary(options);
    if(type==='inventory')return inventory(options);
    if(type==='traceability')return traceability(options);
    if(type==='pasture')return pasture(options);
    if(type==='tasks')return tasks(options);
    throw new Error(`Unknown report type: ${type}`);
  }

  return Object.freeze({
    build,
    async csv(type,options={}){return toCsv((await build(type,options)).rows)}
  });
}
