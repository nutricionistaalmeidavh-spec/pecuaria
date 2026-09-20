const payloads=records=>(records??[]).map(record=>record?.payload??record);
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=(num,den)=>den>0?(num/den)*100:null;
const round=(value,digits=2)=>value==null||!Number.isFinite(Number(value))?null:Number(Number(value).toFixed(digits));

function financeForLot(entries,lotId){
  const scoped=entries.filter(entry=>entry?.lotId===lotId||entry?.allocation?.id===lotId);let costMinor=0,incomeMinor=0;
  for(const entry of scoped){const amount=number(entry?.amountMinor),direction=entry?.direction??entry?.kind;if(direction==='expense'||direction==='cost')costMinor+=amount;if(direction==='income'||direction==='revenue')incomeMinor+=amount;}
  return{costMinor,incomeMinor,resultMinor:incomeMinor-costMinor};
}
function splitMinor(amountMinor,ids){const ordered=[...new Set(ids.filter(Boolean))].sort();if(!ordered.length)return[];const base=Math.floor(amountMinor/ordered.length),remainder=amountMinor-(base*ordered.length);return ordered.map((animalId,index)=>({animalId,amountMinor:base+(index<remainder?1:0)}));}
function phaseOf(animal){return animal?.metadata?.phase??animal?.categoryId??animal?.purpose??'não informada';}
function tradeForEntry(entry,trades){const tradeId=entry?.metadata?.tradeId??(entry?.allocation?.kind==='cattle-trade'?entry.allocation.id:null);return tradeId?trades.find(trade=>trade.id===tradeId):null;}
function expenseTargets(entry,animals,trades){
  const exact=[entry?.metadata?.animalId,...(entry?.metadata?.animalIds??[]),...(entry?.allocation?.kind==='cattle-animal'?[entry.allocation.id]:[])].filter(Boolean);if(exact.length)return[...new Set(exact)];
  const trade=tradeForEntry(entry,trades);if(trade?.animalIds?.length)return[...new Set(trade.animalIds)];
  const lotId=entry?.lotId??(entry?.allocation?.kind==='cattle-lot'?entry.allocation.id:null);if(!lotId)return[];
  const active=animals.filter(animal=>animal.lotId===lotId&&animal.status==='active');return(active.length?active:animals.filter(animal=>animal.lotId===lotId)).map(animal=>animal.id);
}
function dreFor(entries,trades){
  const expenses=entries.filter(entry=>['expense','cost'].includes(entry?.direction??entry?.kind)),incomes=entries.filter(entry=>['income','revenue'].includes(entry?.direction??entry?.kind));
  const grossRevenueMinor=incomes.reduce((sum,entry)=>sum+number(entry.amountMinor),0);let nutritionCostMinor=0,sanitaryCostMinor=0,acquisitionCostMinor=0,otherCostMinor=0;
  for(const entry of expenses){const amount=number(entry.amountMinor),category=String(entry?.metadata?.category??'').toLowerCase(),trade=tradeForEntry(entry,trades);if(trade?.type==='purchase')acquisitionCostMinor+=amount;else if(['nutrition','feed','alimentacao','alimentação'].includes(category))nutritionCostMinor+=amount;else if(['sanitary','health','sanidade'].includes(category))sanitaryCostMinor+=amount;else otherCostMinor+=amount;}
  const totalCostMinor=nutritionCostMinor+sanitaryCostMinor+acquisitionCostMinor+otherCostMinor,operatingResultMinor=grossRevenueMinor-totalCostMinor,marginPct=grossRevenueMinor>0?round(percent(operatingResultMinor,grossRevenueMinor),1):null;
  return{grossRevenueMinor,nutritionCostMinor,sanitaryCostMinor,acquisitionCostMinor,otherCostMinor,totalCostMinor,operatingResultMinor,marginPct,lines:[{line:'Receita bruta',amountMinor:grossRevenueMinor},{line:'Nutrição',amountMinor:-nutritionCostMinor},{line:'Sanidade',amountMinor:-sanitaryCostMinor},{line:'Aquisição de animais',amountMinor:-acquisitionCostMinor},{line:'Outros custos',amountMinor:-otherCostMinor},{line:'Resultado operacional',amountMinor:operatingResultMinor}]};
}

export function createDeepFinanceInsights(persistence){
  return async function financeInsights(){
    const [entries,lots,animals,trades]=await Promise.all([persistence.listRecords('cattle.finance'),persistence.listRecords('cattle.lots'),persistence.listRecords('cattle.animals'),persistence.listRecords('cattle.trades')]);
    const entryRows=payloads(entries),lotRows=payloads(lots),animalRows=payloads(animals),tradeRows=payloads(trades),expenses=entryRows.filter(entry=>['expense','cost'].includes(entry?.direction??entry?.kind)),incomes=entryRows.filter(entry=>['income','revenue'].includes(entry?.direction??entry?.kind));
    const animalsById=new Map(animalRows.map(animal=>[animal.id,{animalId:animal.id,tag:animal.tag??animal.name??animal.id,lotId:animal.lotId??null,phase:phaseOf(animal),costMinor:0}])),allocations=[];let allocatedCostMinor=0;
    for(const entry of expenses){const targets=expenseTargets(entry,animalRows,tradeRows);for(const share of splitMinor(number(entry.amountMinor),targets)){const row=animalsById.get(share.animalId);if(!row)continue;row.costMinor+=share.amountMinor;allocatedCostMinor+=share.amountMinor;allocations.push({entryId:entry.id,animalId:share.animalId,amountMinor:share.amountMinor,method:entry?.metadata?.animalId||entry?.metadata?.animalIds?.length||entry?.allocation?.kind==='cattle-animal'?'animal':tradeForEntry(entry,tradeRows)?'trade':'lot'});}}
    const animalCosts=[...animalsById.values()].filter(row=>row.costMinor>0).sort((a,b)=>b.costMinor-a.costMinor),phaseMap=new Map();
    for(const row of animalCosts){const current=phaseMap.get(row.phase)??{phase:row.phase,animals:0,costMinor:0};current.animals++;current.costMinor+=row.costMinor;phaseMap.set(row.phase,current);}
    const phases=[...phaseMap.values()].sort((a,b)=>b.costMinor-a.costMinor),totalCostMinor=expenses.reduce((sum,entry)=>sum+number(entry.amountMinor),0),incomeMinor=incomes.reduce((sum,entry)=>sum+number(entry.amountMinor),0),resultMinor=incomeMinor-totalCostMinor,unallocatedCostMinor=totalCostMinor-allocatedCostMinor;
    const lotComparison=lotRows.map(lot=>{const money=financeForLot(entryRows,lot.id),headCount=animalRows.filter(a=>a.status==='active'&&a.lotId===lot.id).length;return{lotId:lot.id,lotName:lot.name??lot.id,headCount,...money,costPerHeadMinor:headCount?money.costMinor/headCount:null,marginPct:money.incomeMinor>0?percent(money.resultMinor,money.incomeMinor):null};}).sort((a,b)=>b.resultMinor-a.resultMinor);
    return{summary:{costMinor:totalCostMinor,incomeMinor,resultMinor,marginPct:incomeMinor>0?round(percent(resultMinor,incomeMinor),1):null},lots:lotComparison,allocation:{allocatedCostMinor,unallocatedCostMinor,coveragePct:totalCostMinor>0?round(percent(allocatedCostMinor,totalCostMinor),1):100},animals:animalCosts,phases,dre:dreFor(entryRows,tradeRows),allocations};
  };
}
