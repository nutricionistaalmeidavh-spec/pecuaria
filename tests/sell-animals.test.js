import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleRepositories} from '../src/catalog.js';
import {createAnimal,createCattleLot} from '../src/index.js';
import {createAuditService} from '../src/audit.js';
import {createSellAnimalsUseCase} from '../src/use-cases/sell-animals.js';

async function seed(persistence){
  const repos=createCattleRepositories(persistence);
  await repos.lots.save(createCattleLot({id:'lot-1',name:'Lote 1',farmUnitId:'farm-1'}),{expectedVersion:0});
  await repos.animals.save(createAnimal({id:'a1',tag:'SALE-001',farmUnitId:'farm-1',lotId:'lot-1'}),{expectedVersion:0});
  await repos.animals.save(createAnimal({id:'a2',tag:'SALE-002',farmUnitId:'farm-1',lotId:'lot-1'}),{expectedVersion:0});
  return repos;
}

const saleInput=()=>({
  id:'sale-1',
  type:'sale',
  partyId:'buyer-1',
  animalIds:['a1','a2'],
  totalAmountMinor:250000,
  occurredAt:'2026-09-19T15:00:00Z',
  actorId:'admin-1'
});

test('sale atomically creates trade, closes animals, posts finance and audits',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-sale-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  try{
    const repos=await seed(db);
    const audit=createAuditService(db,{productId:'agro-pecuaria'});
    const sell=createSellAnimalsUseCase({persistence:db,audit});
    const result=await sell(saleInput());

    assert.equal(result.trade.payload.type,'sale');
    assert.equal((await repos.animals.get('a1')).payload.status,'sold');
    assert.equal((await repos.animals.get('a2')).payload.status,'sold');
    const finance=createEntityRepository(db,{collection:'cattle.finance'});
    const entries=await finance.list();
    assert.equal(entries.length,1);
    assert.equal(entries[0].payload.direction,'income');
    assert.equal(entries[0].payload.amountMinor,250000);
    const events=await audit.list({action:'cattle.trade.sale'});
    assert.equal(events.length,1);
    assert.equal(events[0].actorId,'admin-1');
    assert.deepEqual(events[0].metadata.animalIds,['a1','a2']);
  }finally{
    await db.close();
    await rm(dir,{recursive:true,force:true});
  }
});

test('sale rolls back every write when a late audit failure occurs and remains clean after reopen',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-sale-rollback-'));
  const dbPath=join(dir,'db.sqlite');
  let db=await openProductPersistence({dbPath,productId:'agro-pecuaria'});
  try{
    let repos=await seed(db);
    const failingAudit={append:async()=>{throw new Error('forced-audit-failure')}};
    const sell=createSellAnimalsUseCase({persistence:db,audit:failingAudit});
    await assert.rejects(()=>sell(saleInput()),/forced-audit-failure/);

    assert.equal(await repos.trades.get('sale-1'),null);
    assert.equal((await repos.animals.get('a1')).payload.status,'active');
    assert.equal((await repos.animals.get('a2')).payload.status,'active');
    let finance=createEntityRepository(db,{collection:'cattle.finance'});
    assert.equal((await finance.list()).length,0);

    await db.close();
    db=await openProductPersistence({dbPath,productId:'agro-pecuaria'});
    repos=createCattleRepositories(db);
    finance=createEntityRepository(db,{collection:'cattle.finance'});
    assert.equal(await repos.trades.get('sale-1'),null);
    assert.equal((await repos.animals.get('a1')).payload.status,'active');
    assert.equal((await repos.animals.get('a2')).payload.status,'active');
    assert.equal((await finance.list()).length,0);
  }finally{
    try{await db.close()}catch{}
    await rm(dir,{recursive:true,force:true});
  }
});

test('sale rejects missing or already closed animals without partial records',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-sale-invalid-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  try{
    const repos=await seed(db);
    const audit=createAuditService(db,{productId:'agro-pecuaria'});
    const sell=createSellAnimalsUseCase({persistence:db,audit});
    await assert.rejects(()=>sell({...saleInput(),id:'missing-sale',animalIds:['a1','missing']}),/Animal not found/i);
    assert.equal(await repos.trades.get('missing-sale'),null);

    const current=await repos.animals.get('a1');
    await repos.animals.save({...current.payload,status:'sold'},{expectedVersion:current.version});
    await assert.rejects(()=>sell({...saleInput(),id:'closed-sale',animalIds:['a1']}),/not active/i);
    assert.equal(await repos.trades.get('closed-sale'),null);
  }finally{
    await db.close();
    await rm(dir,{recursive:true,force:true});
  }
});
