import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createFinanceAdminService} from '../src/services/finance-admin.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-fin-admin-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,service:createFinanceAdminService(db),async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seed(service){
  await service.saveAccount({id:'bank',name:'Banco'});
  await service.saveCategory({id:'feed',name:'Alimentação',direction:'payable'});
  await service.saveTitle({id:'t1',direction:'payable',description:'Ração',originalAmountMinor:100000,issuedAt:'2026-09-20',dueAt:'2026-09-30',categoryId:'feed'});
}

test('finance admin service creates titles and derives partial/full settlement state',async()=>{
  const f=await fixture();try{
    await seed(f.service);
    let snap=await f.service.snapshot({asOf:'2026-09-20T12:00:00Z'});
    assert.equal(snap.titles[0].status,'open');
    assert.equal(snap.titles[0].openAmountMinor,100000);
    await f.service.settleTitle({id:'s1',operationId:'op-1',titleId:'t1',amountMinor:25000,occurredAt:'2026-09-21',accountId:'bank'});
    snap=await f.service.snapshot({asOf:'2026-09-21T12:00:00Z'});
    assert.equal(snap.titles[0].status,'partial');assert.equal(snap.titles[0].openAmountMinor,75000);
    await f.service.settleTitle({id:'s2',operationId:'op-2',titleId:'t1',amountMinor:75000,occurredAt:'2026-09-22',accountId:'bank'});
    snap=await f.service.snapshot({asOf:'2026-09-22T12:00:00Z'});
    assert.equal(snap.titles[0].status,'settled');assert.equal(snap.titles[0].openAmountMinor,0);
  }finally{await f.cleanup()}
});

test('settlement is atomic, idempotent by operationId and rejects overpayment/cancelled title',async()=>{
  const f=await fixture();try{
    await seed(f.service);
    const first=await f.service.settleTitle({id:'s1',operationId:'same-op',titleId:'t1',amountMinor:30000,occurredAt:'2026-09-21',accountId:'bank'});
    const retry=await f.service.settleTitle({id:'another-id',operationId:'same-op',titleId:'t1',amountMinor:30000,occurredAt:'2026-09-21',accountId:'bank'});
    assert.equal(retry.id,first.id);
    assert.equal((await f.db.listRecords('cattle.finance-settlements')).length,1);
    await assert.rejects(()=>f.service.settleTitle({id:'too-much',operationId:'op-over',titleId:'t1',amountMinor:80000,occurredAt:'2026-09-21'}),/open|exceed|over/i);
    assert.equal((await f.db.listRecords('cattle.finance-settlements')).length,1);
    await f.service.cancelTitle({id:'t1',cancelledAt:'2026-09-22',reason:'cancelado'});
    await assert.rejects(()=>f.service.settleTitle({id:'after-cancel',operationId:'op-cancel',titleId:'t1',amountMinor:1000,occurredAt:'2026-09-23'}),/cancel/i);
    assert.equal((await f.db.listRecords('cattle.finance-settlements')).length,1);
  }finally{await f.cleanup()}
});

test('reversal is immutable, reopens title and the same settlement cannot be reversed twice',async()=>{
  const f=await fixture();try{
    await seed(f.service);
    await f.service.settleTitle({id:'s1',operationId:'op-1',titleId:'t1',amountMinor:40000,occurredAt:'2026-09-21',accountId:'bank'});
    const reversed=await f.service.reverseSettlement({id:'r1',operationId:'op-r1',settlementId:'s1',occurredAt:'2026-09-22',reason:'erro'});
    assert.equal(reversed.reversesSettlementId,'s1');
    const snap=await f.service.snapshot({asOf:'2026-09-22T12:00:00Z'});
    assert.equal(snap.titles[0].status,'open');assert.equal(snap.titles[0].openAmountMinor,100000);
    await assert.rejects(()=>f.service.reverseSettlement({id:'r2',operationId:'op-r2',settlementId:'s1',occurredAt:'2026-09-23'}),/already|revers/i);
    assert.equal((await f.db.listRecords('cattle.finance-settlements')).length,2);
  }finally{await f.cleanup()}
});
