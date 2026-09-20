import {createEntityRepository} from '../../shared/packages/vertical-persistence/src/repository.js';
import {createFinanceAccount,createFinanceCategory,createFinancialTitle,createSettlement,deriveTitleState,buildCashProjection} from '../finance-admin.js';

export const FINANCE_ADMIN_COLLECTIONS=Object.freeze({
  accounts:'cattle.finance-accounts',
  titles:'cattle.finance-titles',
  settlements:'cattle.finance-settlements',
  categories:'cattle.finance-categories',
  reconciliations:'cattle.finance-reconciliations',
  imports:'cattle.finance-imports'
});

const rows=records=>(records??[]).map(record=>record?.payload??record);
const entityOf=value=>value?.payload??value;
const required=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record};
const repositories=store=>Object.fromEntries(Object.entries(FINANCE_ADMIN_COLLECTIONS).map(([key,collection])=>[key,createEntityRepository(store,{collection})]));
const runTransaction=(persistence,fn)=>typeof persistence.transaction==='function'?persistence.transaction(fn):fn(persistence);

async function appendAudit(audit,{actorId='system',action,entityType,entityId,metadata={}}){
  if(typeof audit?.append!=='function')return;
  await audit.append({actorId,action,entityType,entityId,metadata});
}

export function createFinanceAdminService(persistence,{audit=null}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=repositories(persistence);

  async function saveAccount(input,context={}){
    const entity=createFinanceAccount(input),current=await repos.accounts.get(entity.id);
    const saved=entityOf(await repos.accounts.save(entity,{expectedVersion:current?.version??0}));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.account.save',entityType:'finance-account',entityId:entity.id});
    return saved;
  }

  async function saveCategory(input,context={}){
    const entity=createFinanceCategory(input),current=await repos.categories.get(entity.id);
    const saved=entityOf(await repos.categories.save(entity,{expectedVersion:current?.version??0}));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.category.save',entityType:'finance-category',entityId:entity.id});
    return saved;
  }

  async function saveTitle(input,context={}){
    const entity=createFinancialTitle(input),current=await repos.titles.get(entity.id);
    if(current){
      const settlements=rows(await repos.settlements.list()).filter(item=>item.titleId===entity.id);
      if(settlements.length)throw new Error('Financial title with settlements cannot be edited.');
      if(current.payload.cancelledAt)throw new Error('Cancelled financial title cannot be edited.');
    }
    const saved=entityOf(await repos.titles.save(entity,{expectedVersion:current?.version??0}));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.title.save',entityType:'finance-title',entityId:entity.id});
    return saved;
  }

  async function cancelTitle({id,cancelledAt=new Date().toISOString(),reason=null}={},context={}){
    const result=entityOf(await runTransaction(persistence,async store=>{
      const scoped=repositories(store),current=required(await scoped.titles.get(id),'Financial title');
      if(current.payload.cancelledAt)return current;
      const next=createFinancialTitle({...current.payload,cancelledAt,cancelReason:reason});
      return scoped.titles.save(next,{expectedVersion:current.version});
    }));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.title.cancel',entityType:'finance-title',entityId:id});
    return result;
  }

  async function settleTitle(input,context={}){
    const result=entityOf(await runTransaction(persistence,async store=>{
      const scoped=repositories(store),existing=rows(await scoped.settlements.list()).find(item=>item.operationId===input?.operationId);
      if(existing)return existing;
      const titleRecord=required(await scoped.titles.get(input?.titleId),'Financial title'),title=titleRecord.payload;
      if(title.cancelledAt)throw new Error('Cancelled financial title cannot receive a settlement.');
      const settlement=createSettlement(input),settlements=rows(await scoped.settlements.list()).filter(item=>item.titleId===title.id);
      const state=deriveTitleState(title,settlements);
      if(settlement.amountMinor>state.openAmountMinor)throw new Error('Settlement amount exceeds title open amount.');
      return scoped.settlements.save(settlement,{expectedVersion:0});
    }));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.title.settle',entityType:'finance-settlement',entityId:result?.id??input?.id,metadata:{titleId:input?.titleId}});
    return result;
  }

  async function reverseSettlement({id,operationId,settlementId,occurredAt,reason=null}={},context={}){
    const result=entityOf(await runTransaction(persistence,async store=>{
      const scoped=repositories(store),all=rows(await scoped.settlements.list()),existing=all.find(item=>item.operationId===operationId);
      if(existing)return existing;
      const original=all.find(item=>item.id===settlementId);
      if(!original||original.reversesSettlementId)throw new Error('Settlement to reverse not found.');
      if(all.some(item=>item.reversesSettlementId===settlementId))throw new Error('Settlement is already reversed.');
      const reversal=createSettlement({id,operationId,titleId:original.titleId,amountMinor:original.amountMinor,occurredAt,accountId:original.accountId,method:original.method,notes:reason,reversesSettlementId:settlementId});
      return scoped.settlements.save(reversal,{expectedVersion:0});
    }));
    await appendAudit(audit,{actorId:context.actorId,action:'cattle.finance.settlement.reverse',entityType:'finance-settlement',entityId:result?.id??id,metadata:{reversesSettlementId:settlementId}});
    return result;
  }

  async function snapshot({asOf=new Date().toISOString()}={}){
    const [accountRecords,titleRecords,settlementRecords,categoryRecords,reconciliationRecords,importRecords]=await Promise.all([
      repos.accounts.list(),repos.titles.list(),repos.settlements.list(),repos.categories.list(),repos.reconciliations.list(),repos.imports.list()
    ]);
    const accounts=rows(accountRecords),titles=rows(titleRecords),settlements=rows(settlementRecords),categories=rows(categoryRecords);
    const enrichedTitles=titles.map(title=>Object.freeze({...title,...deriveTitleState(title,settlements)}));
    const now=Date.parse(asOf);if(!Number.isFinite(now))throw new TypeError('Finance snapshot asOf must be a valid date.');
    const open=enrichedTitles.filter(title=>!['settled','cancelled'].includes(title.status));
    const overdue=open.filter(title=>Date.parse(title.dueAt)<now).sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt)));
    const upcoming=open.filter(title=>Date.parse(title.dueAt)>=now).sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt)));
    return Object.freeze({
      accounts,categories,titles:enrichedTitles,settlements,
      reconciliations:rows(reconciliationRecords),imports:rows(importRecords),overdue,upcoming,
      projection:buildCashProjection({titles,settlements,accounts,asOf})
    });
  }

  const unavailable=name=>async()=>{throw new Error(`${name} is not implemented yet.`)};
  return Object.freeze({
    snapshot,saveAccount,saveCategory,saveTitle,cancelTitle,settleTitle,reverseSettlement,
    importStatement:unavailable('Statement import'),reconcileStatement:unavailable('Statement reconciliation'),importInvoiceXml:unavailable('Invoice XML import')
  });
}
