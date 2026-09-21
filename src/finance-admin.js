const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim()};
const optionalText=value=>typeof value==='string'&&value.trim()?value.trim():null;
const iso=(value,label)=>{const time=Date.parse(value);if(!Number.isFinite(time))throw new TypeError(`${label} must be a valid date.`);return new Date(time).toISOString()};
const money=(value,label,{positive=false}={})=>{if(!Number.isSafeInteger(value)||(positive?value<=0:value<0))throw new TypeError(`${label} must be ${positive?'a positive ':'a zero or positive '}safe integer in minor units.`);return value};
const bool=value=>value!==false;

export function createFinanceAccount({id,name,kind='cash',active=true}={}){
  return Object.freeze({id:text(id,'Finance account id'),name:text(name,'Finance account name'),kind:text(kind,'Finance account kind'),active:bool(active)});
}

export function createFinanceCategory({id,name,direction='both',active=true}={}){
  if(!['both','payable','receivable'].includes(direction))throw new TypeError('Finance category direction must be both, payable or receivable.');
  return Object.freeze({id:text(id,'Finance category id'),name:text(name,'Finance category name'),direction,active:bool(active)});
}

export function createFinancialTitle({
  id,direction,description,originalAmountMinor,issuedAt,dueAt,categoryId=null,accountId=null,partyId=null,lotId=null,tradeId=null,documentRef=null,notes=null,cancelledAt=null,cancelReason=null
}={}){
  if(!['payable','receivable'].includes(direction))throw new TypeError('Financial title direction must be payable or receivable.');
  const issued=iso(issuedAt,'Issued at'),due=iso(dueAt,'Due at');
  if(Date.parse(due)<Date.parse(issued))throw new RangeError('Due at must not be before issued at.');
  return Object.freeze({
    id:text(id,'Financial title id'),direction,description:text(description,'Financial title description'),
    originalAmountMinor:money(originalAmountMinor,'Original amount',{positive:true}),issuedAt:issued,dueAt:due,
    categoryId:optionalText(categoryId),accountId:optionalText(accountId),partyId:optionalText(partyId),lotId:optionalText(lotId),tradeId:optionalText(tradeId),
    documentRef:optionalText(documentRef),notes:optionalText(notes),cancelledAt:cancelledAt?iso(cancelledAt,'Cancelled at'):null,cancelReason:optionalText(cancelReason)
  });
}

export function createSettlement({id,operationId,titleId,amountMinor,occurredAt,accountId=null,method=null,notes=null,reversesSettlementId=null}={}){
  return Object.freeze({
    id:text(id,'Settlement id'),operationId:text(operationId,'Settlement operation id'),titleId:text(titleId,'Settlement title id'),
    amountMinor:money(amountMinor,'Settlement amount',{positive:true}),occurredAt:iso(occurredAt,'Settlement occurred at'),
    accountId:optionalText(accountId),method:optionalText(method),notes:optionalText(notes),reversesSettlementId:optionalText(reversesSettlementId)
  });
}

export function deriveTitleState(title,settlements=[]){
  if(!title)throw new TypeError('Financial title is required.');
  const relevant=settlements.filter(item=>item?.titleId===title.id);
  const reversedIds=new Set(relevant.filter(item=>item.reversesSettlementId).map(item=>item.reversesSettlementId));
  let settledAmountMinor=0;
  for(const item of relevant){
    if(item.reversesSettlementId)continue;
    if(reversedIds.has(item.id))continue;
    settledAmountMinor+=Number(item.amountMinor)||0;
  }
  settledAmountMinor=Math.max(0,settledAmountMinor);
  if(title.cancelledAt)return Object.freeze({status:'cancelled',openAmountMinor:0,settledAmountMinor});
  const openAmountMinor=Math.max(0,Number(title.originalAmountMinor)-settledAmountMinor);
  const status=openAmountMinor===0?'settled':settledAmountMinor>0?'partial':'open';
  return Object.freeze({status,openAmountMinor,settledAmountMinor});
}

function effectiveSettlements(titles,settlements){
  const titleById=new Map(titles.map(item=>[item.id,item]));
  const rows=[];
  for(const settlement of settlements){
    const title=titleById.get(settlement.titleId);if(!title)continue;
    if(settlement.reversesSettlementId){
      const original=settlements.find(item=>item.id===settlement.reversesSettlementId&&item.titleId===settlement.titleId);
      if(!original)continue;
      rows.push({settlement,title,sign:title.direction==='receivable'?-1:1,amountMinor:Number(settlement.amountMinor)||0,accountId:settlement.accountId??original.accountId??null});
      continue;
    }
    rows.push({settlement,title,sign:title.direction==='receivable'?1:-1,amountMinor:Number(settlement.amountMinor)||0,accountId:settlement.accountId??title.accountId??null});
  }
  return rows;
}

export function buildCashProjection({titles=[],settlements=[],accounts=[],asOf=new Date().toISOString()}={}){
  const asOfTime=Date.parse(asOf);if(!Number.isFinite(asOfTime))throw new TypeError('Projection asOf must be a valid date.');
  const effective=effectiveSettlements(titles,settlements);
  let inflowMinor=0,outflowMinor=0,unallocatedBalanceMinor=0;
  const balances=new Map(accounts.map(account=>[account.id,0]));
  for(const row of effective){
    if(row.sign>0)inflowMinor+=row.amountMinor;else outflowMinor+=row.amountMinor;
    const signed=row.sign*row.amountMinor;
    if(row.accountId&&balances.has(row.accountId))balances.set(row.accountId,balances.get(row.accountId)+signed);else unallocatedBalanceMinor+=signed;
  }
  const forecast={};
  for(const days of [7,30,90]){
    const limit=asOfTime+days*86400000;let payableMinor=0,receivableMinor=0;
    for(const title of titles){
      const state=deriveTitleState(title,settlements),due=Date.parse(title.dueAt);
      if(state.status==='cancelled'||state.openAmountMinor<=0||!Number.isFinite(due)||due>limit)continue;
      if(title.direction==='payable')payableMinor+=state.openAmountMinor;else receivableMinor+=state.openAmountMinor;
    }
    forecast[`days${days}`]=Object.freeze({payableMinor,receivableMinor,netMinor:receivableMinor-payableMinor});
  }
  return Object.freeze({
    realized:Object.freeze({inflowMinor,outflowMinor,netMinor:inflowMinor-outflowMinor}),
    accounts:Object.freeze(accounts.map(account=>Object.freeze({accountId:account.id,name:account.name,balanceMinor:balances.get(account.id)??0}))),
    unallocatedBalanceMinor,forecast:Object.freeze(forecast)
  });
}
