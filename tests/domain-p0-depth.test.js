import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import * as finance from '../src/finance.js';
import * as domain from '../src/index.js';
import {createCattleRepositories,createSanitaryProtocol} from '../src/catalog.js';
import {createP1Repositories} from '../src/p1.js';
import {createCattlePresentation} from '../src/presentation.js';
import {ACTION_FORMS} from '../web/action-config.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-domain-p0-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,repos:createCattleRepositories(db),p1:createP1Repositories(db),async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('commercial settlement distinguishes live arrobas from carcass arrobas',()=>{
  assert.equal(typeof finance.calculateCattleSettlement,'function');
  const result=finance.calculateCattleSettlement({liveWeightKg:450,carcassYieldPct:50,pricePerCarcassArrobaMinor:30000,deductionsMinor:10000,freightMinor:5000,commissionMinor:6000});
  assert.equal(result.liveArrobas,30);
  assert.equal(result.carcassWeightKg,225);
  assert.equal(result.carcassArrobas,15);
  assert.equal(result.grossMinor,450000);
  assert.equal(result.netMinor,429000);
});

test('sale derives total amount and persists commercial settlement when closing data is supplied',()=>{
  const trade=domain.createCattleTrade({id:'sale-1',type:'sale',partyId:'buyer-1',animalIds:['a1'],occurredAt:'2026-09-20T12:00:00Z',liveWeightKg:450,carcassYieldPct:50,pricePerCarcassArrobaMinor:30000,deductionsMinor:10000,freightMinor:5000,commissionMinor:6000});
  assert.equal(trade.totalAmountMinor,429000);
  assert.equal(trade.metadata.settlement.carcassArrobas,15);
  assert.equal(trade.metadata.settlement.arrobaBasis,'carcass');
});

test('production economics exposes explicit live-weight arroba metrics without changing legacy alias',()=>{
  const entries=[{direction:'expense',amountMinor:30000,allocation:{id:'l1'}},{direction:'income',amountMinor:50000,allocation:{id:'l1'}}];
  const animals=[{lotId:'l1',status:'active',weights:[{weightKg:300},{weightKg:330}]}];
  const result=finance.cattleProductionEconomics(entries,{lotId:'l1',animals});
  assert.equal(result.totalLiveArrobas,22);
  assert.equal(result.costPerLiveArrobaMinor,result.costPerArrobaMinor);
  assert.equal(result.arrobaBasis,'live-weight');
});

test('sanitary protocol carries withdrawal and active ingredient metadata',()=>{
  const protocol=createSanitaryProtocol({id:'vac-1',name:'Protocolo',productItemId:'med-1',dose:2,unit:'ml',intervalDays:30,withdrawalDays:10,activeIngredient:'Ivermectina'});
  assert.equal(protocol.withdrawalDays,10);
  assert.equal(protocol.activeIngredient,'Ivermectina');
});

test('sanitary application atomically consumes inventory, records cost and withdrawal',async()=>{
  const f=await fixture();
  try{
    await f.repos.lots.save(domain.createCattleLot({id:'l1',name:'Lote 1',farmUnitId:'farm-1'}),{expectedVersion:0});
    await f.repos.animals.save(domain.createAnimal({id:'a1',tag:'A-1',farmUnitId:'farm-1',lotId:'l1'}),{expectedVersion:0});
    await f.p1.inventory.save(domain.createInventoryItem({id:'med-1',name:'Medicamento',kind:'medicine',unit:'ml',quantity:10,costMinor:50}),{expectedVersion:0});
    await f.repos.sanitaryProtocols.save(createSanitaryProtocol({id:'prot-1',name:'Sanitário',productItemId:'med-1',dose:2,unit:'ml',withdrawalDays:10}),{expectedVersion:0});
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await presentation.action('sanitary','record',{id:'san-1',animalId:'a1',protocolId:'prot-1',occurredAt:'2026-09-20T12:00:00Z'});
    assert.equal((await f.p1.inventory.get('med-1')).payload.quantity,8);
    const movements=await f.p1.inventoryMovements.list();
    assert.equal(movements.length,1);
    assert.equal(movements[0].payload.referenceType,'sanitary');
    assert.equal(movements[0].payload.referenceId,'san-1');
    const event=(await f.repos.events.get('san-1')).payload;
    assert.equal(event.productItemId,'med-1');
    assert.equal(event.dose,2);
    assert.equal(event.withdrawalUntil,'2026-09-30T12:00:00.000Z');
    assert.equal(event.costMinor,100);
    const financeRows=await f.db.listRecords('cattle.finance');
    assert.equal(financeRows.length,1);
    assert.equal(financeRows[0].payload.amountMinor,100);
    assert.equal(financeRows[0].payload.metadata.sanitaryEventId,'san-1');
  }finally{await f.cleanup()}
});

test('sanitary application rejects insufficient stock without partial writes',async()=>{
  const f=await fixture();
  try{
    await f.repos.lots.save(domain.createCattleLot({id:'l1',name:'Lote 1',farmUnitId:'farm-1'}),{expectedVersion:0});
    await f.repos.animals.save(domain.createAnimal({id:'a1',tag:'A-1',farmUnitId:'farm-1',lotId:'l1'}),{expectedVersion:0});
    await f.p1.inventory.save(domain.createInventoryItem({id:'med-1',name:'Medicamento',kind:'medicine',unit:'ml',quantity:1,costMinor:50}),{expectedVersion:0});
    await f.repos.sanitaryProtocols.save(createSanitaryProtocol({id:'prot-1',name:'Sanitário',productItemId:'med-1',dose:2,unit:'ml'}),{expectedVersion:0});
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await assert.rejects(()=>presentation.action('sanitary','record',{id:'san-rollback',animalId:'a1',protocolId:'prot-1',occurredAt:'2026-09-20T12:00:00Z'}),/Insufficient sanitary inventory/i);
    assert.equal((await f.p1.inventory.get('med-1')).payload.quantity,1);
    assert.equal(await f.repos.events.get('san-rollback'),null);
    assert.equal((await f.p1.inventoryMovements.list()).length,0);
    assert.equal((await f.db.listRecords('cattle.finance')).length,0);
  }finally{await f.cleanup()}
});

test('sale is blocked while an animal has an active sanitary withdrawal period',async()=>{
  const f=await fixture();
  try{
    await f.repos.lots.save(domain.createCattleLot({id:'l1',name:'Lote 1',farmUnitId:'farm-1'}),{expectedVersion:0});
    await f.repos.animals.save(domain.createAnimal({id:'a1',tag:'A-1',farmUnitId:'farm-1',lotId:'l1'}),{expectedVersion:0});
    await f.p1.inventory.save(domain.createInventoryItem({id:'med-1',name:'Medicamento',kind:'medicine',unit:'ml',quantity:10,costMinor:50}),{expectedVersion:0});
    await f.repos.sanitaryProtocols.save(createSanitaryProtocol({id:'prot-1',name:'Sanitário',productItemId:'med-1',dose:2,unit:'ml',withdrawalDays:10}),{expectedVersion:0});
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await presentation.action('sanitary','record',{id:'san-1',animalId:'a1',protocolId:'prot-1',occurredAt:'2026-09-20T12:00:00Z'});
    await assert.rejects(()=>presentation.action('trades','create',{id:'sale-blocked',type:'sale',partyId:'buyer-1',animalIds:['a1'],totalAmountMinor:100000,occurredAt:'2026-09-25T12:00:00Z'}),/withdrawal|carência/i);
    assert.equal(await f.repos.trades.get('sale-blocked'),null);
    assert.equal((await f.repos.animals.get('a1')).payload.status,'active');
  }finally{await f.cleanup()}
});

test('reproduction supports pregnancy loss and derives breeding KPIs',()=>{
  assert.equal(typeof domain.reproductionMetrics,'function');
  const events=[domain.recordReproductionEvent({id:'s1',animalId:'a1',type:'service',occurredAt:'2026-01-01'}),domain.recordReproductionEvent({id:'s2',animalId:'a2',type:'service',occurredAt:'2026-01-01'}),domain.recordReproductionEvent({id:'p1',animalId:'a1',type:'pregnancy-check',occurredAt:'2026-02-01',metadata:{result:'positive'}}),domain.recordReproductionEvent({id:'p2',animalId:'a2',type:'pregnancy-check',occurredAt:'2026-02-01',metadata:{result:'negative'}}),domain.recordReproductionEvent({id:'l1',animalId:'a1',type:'pregnancy-loss',occurredAt:'2026-03-01'})];
  const result=domain.reproductionMetrics(events,{eligibleFemaleIds:['a1','a2']});
  assert.equal(result.servicedFemales,2);
  assert.equal(result.pregnantFemales,1);
  assert.equal(result.serviceRatePct,100);
  assert.equal(result.conceptionRatePct,50);
  assert.equal(result.pregnancyRatePct,50);
  assert.equal(result.pregnancyLossRatePct,100);
});

test('contacts are first-class catalog entities and data workflow exposes them',()=>{
  assert.equal(typeof domain.createCattleParty,'function');
  const party=domain.createCattleParty({id:'buyer-1',name:'Frigorífico Exemplo',roles:['buyer','buyer','slaughterhouse'],document:'12.345.678/0001-90',phone:'16999999999'});
  assert.deepEqual(party.roles,['buyer','slaughterhouse']);
  assert.equal(party.document,'12.345.678/0001-90');
  assert.ok(ACTION_FORMS.data?.saveParty,'data.saveParty');
});

test('contacts persist through data workflow and participate in search and transfer',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await presentation.action('data','saveParty',{id:'buyer-1',name:'Frigorífico Exemplo',roles:['buyer','slaughterhouse'],document:'12.345.678/0001-90'});
    assert.equal((await f.repos.parties.get('buyer-1')).payload.name,'Frigorífico Exemplo');
    const found=await presentation.services.search.query({term:'frigorifico'});
    assert.ok(found.some(item=>item.collection==='cattle.parties'&&item.id==='buyer-1'));
    const exported=await presentation.services.transfer.exportCollection('cattle.parties');
    assert.equal(exported.records.length,1);
    assert.equal(exported.records[0].id,'buyer-1');
  }finally{await f.cleanup()}
});

test('trade form exposes commercial carcass settlement fields',()=>{
  const fields=ACTION_FORMS.trades.create.fields.map(field=>field.name);
  for(const name of ['liveWeightKg','carcassWeightKg','carcassYieldPct','pricePerCarcassArrobaMinor','deductionsMinor','freightMinor','commissionMinor'])assert.ok(fields.includes(name),name);
});
