import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFinanceAccount,createFinanceCategory,createFinancialTitle,createSettlement,
  deriveTitleState,buildCashProjection
} from '../src/finance-admin.js';

const title=(overrides={})=>createFinancialTitle({
  id:'t1',direction:'payable',description:'Ração',originalAmountMinor:100000,
  issuedAt:'2026-09-20T00:00:00Z',dueAt:'2026-09-30T00:00:00Z',...overrides
});

test('administrative finance constructors normalize safe local records',()=>{
  assert.deepEqual(createFinanceAccount({id:'cash',name:'Caixa'}),{id:'cash',name:'Caixa',kind:'cash',active:true});
  assert.deepEqual(createFinanceCategory({id:'feed',name:'Alimentação'}),{id:'feed',name:'Alimentação',direction:'both',active:true});
  const record=title({partyId:' p1 ',lotId:'',notes:'  teste  ',openAmountMinor:1,status:'settled'});
  assert.equal(record.partyId,'p1');
  assert.equal(record.lotId,null);
  assert.equal(record.notes,'teste');
  assert.equal('openAmountMinor' in record,false);
  assert.equal('status' in record,false);
  assert.throws(()=>title({originalAmountMinor:10.5}),/safe integer|minor/i);
  assert.throws(()=>title({direction:'other'}),/payable|receivable/i);
  assert.throws(()=>createSettlement({id:'s',operationId:'op',titleId:'t1',amountMinor:0,occurredAt:'2026-09-20'}),/positive/i);
});

test('title state is derived from immutable settlements and reversals',()=>{
  const base=title();
  assert.deepEqual(deriveTitleState(base,[]),{status:'open',openAmountMinor:100000,settledAmountMinor:0});
  const partial=createSettlement({id:'s1',operationId:'op1',titleId:'t1',amountMinor:25000,occurredAt:'2026-09-21T00:00:00Z'});
  assert.deepEqual(deriveTitleState(base,[partial]),{status:'partial',openAmountMinor:75000,settledAmountMinor:25000});
  const rest=createSettlement({id:'s2',operationId:'op2',titleId:'t1',amountMinor:75000,occurredAt:'2026-09-22T00:00:00Z'});
  assert.deepEqual(deriveTitleState(base,[partial,rest]),{status:'settled',openAmountMinor:0,settledAmountMinor:100000});
  const reversal=createSettlement({id:'r1',operationId:'op3',titleId:'t1',amountMinor:25000,occurredAt:'2026-09-23T00:00:00Z',reversesSettlementId:'s1'});
  assert.deepEqual(deriveTitleState(base,[partial,rest,reversal]),{status:'partial',openAmountMinor:25000,settledAmountMinor:75000});
  const cancelled={...base,cancelledAt:'2026-09-24T00:00:00.000Z'};
  assert.deepEqual(deriveTitleState(cancelled,[partial]),{status:'cancelled',openAmountMinor:0,settledAmountMinor:25000});
});

test('cash projection derives realized balances and 7/30/90 forecast without fake observations',()=>{
  const accounts=[createFinanceAccount({id:'bank',name:'Conta'})];
  const titles=[
    title({id:'pay',originalAmountMinor:10000,dueAt:'2026-09-25T00:00:00Z'}),
    title({id:'recv',direction:'receivable',description:'Venda',originalAmountMinor:30000,dueAt:'2026-10-10T00:00:00Z'})
  ];
  const settlements=[
    createSettlement({id:'sp',operationId:'op-p',titleId:'pay',amountMinor:4000,occurredAt:'2026-09-20T10:00:00Z',accountId:'bank'}),
    createSettlement({id:'sr',operationId:'op-r',titleId:'recv',amountMinor:5000,occurredAt:'2026-09-20T11:00:00Z',accountId:null})
  ];
  const projection=buildCashProjection({titles,settlements,accounts,asOf:'2026-09-20T12:00:00Z'});
  assert.equal(projection.realized.inflowMinor,5000);
  assert.equal(projection.realized.outflowMinor,4000);
  assert.equal(projection.accounts.find(x=>x.accountId==='bank').balanceMinor,-4000);
  assert.equal(projection.unallocatedBalanceMinor,5000);
  assert.equal(projection.forecast.days7.payableMinor,6000);
  assert.equal(projection.forecast.days30.receivableMinor,25000);
  assert.equal(projection.forecast.days90.receivableMinor,25000);
});

test('cash projection nets an immutable settlement reversal to zero realized movement',()=>{
  const accounts=[createFinanceAccount({id:'bank',name:'Conta'})];
  const titles=[title({id:'recv',direction:'receivable',description:'Venda',originalAmountMinor:10000,dueAt:'2026-09-25T00:00:00Z'})];
  const original=createSettlement({id:'s1',operationId:'op-1',titleId:'recv',amountMinor:10000,occurredAt:'2026-09-20T10:00:00Z',accountId:'bank'});
  const reversal=createSettlement({id:'r1',operationId:'op-2',titleId:'recv',amountMinor:10000,occurredAt:'2026-09-20T11:00:00Z',accountId:'bank',reversesSettlementId:'s1'});
  const projection=buildCashProjection({titles,settlements:[original,reversal],accounts,asOf:'2026-09-20T12:00:00Z'});
  assert.equal(projection.realized.inflowMinor,10000);
  assert.equal(projection.realized.outflowMinor,10000);
  assert.equal(projection.realized.netMinor,0);
  assert.equal(projection.accounts[0].balanceMinor,0);
  assert.equal(projection.forecast.days7.receivableMinor,10000);
});
