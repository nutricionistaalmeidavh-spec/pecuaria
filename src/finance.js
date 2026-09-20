import {createFinancialEntry,summarizeFinancialEntries} from '../shared/packages/domain-finance/src/index.js';export function createCattleTradeEntry(trade,{id=`${trade.id}:finance`,lotId=null}={}){return createFinancialEntry({id,direction:trade.type==='sale'?'income':'expense',amountMinor:trade.totalAmountMinor,description:`Cattle ${trade.type} ${trade.id}`,partyId:trade.partyId,allocation:{kind:lotId?'cattle-lot':'cattle-trade',id:lotId??trade.id},metadata:{tradeId:trade.id,animalIds:trade.animalIds}})}export function createCattleCost({id,lotId,amountMinor,description,category}={}){return createFinancialEntry({id,direction:'expense',amountMinor,description,allocation:{kind:'cattle-lot',id:lotId},metadata:{category}})}export function cattleFinancialMetrics(entries,{lotId,headCount=0}={}){const scoped=entries.filter(e=>e.allocation?.id===lotId),summary=summarizeFinancialEntries(scoped);const costPerHeadMinor=headCount>0?summary.expenseMinor/headCount:null;return Object.freeze({...summary,costPerHeadMinor,resultMinor:summary.incomeMinor-summary.expenseMinor})}

export function cattleProductionEconomics(entries,{lotId,animals=[]}={}){
  const active=animals.filter(a=>a.lotId===lotId&&a.status==='active');
  const base=cattleFinancialMetrics(entries,{lotId,headCount:active.length});
  let totalGainKg=0;
  for(const animal of active){const w=animal.weights??[];if(w.length>=2)totalGainKg+=Number(w.at(-1).weightKg)-Number(w[0].weightKg);}
  const totalArrobas=active.reduce((sum,a)=>sum+(Number(a.weights?.at(-1)?.weightKg)||0)/15,0);
  return Object.freeze({...base,totalGainKg,costPerKgGainMinor:totalGainKg>0?base.expenseMinor/totalGainKg:null,costPerArrobaMinor:totalArrobas>0?base.expenseMinor/totalArrobas:null,marginMinor:base.incomeMinor-base.expenseMinor});
}
