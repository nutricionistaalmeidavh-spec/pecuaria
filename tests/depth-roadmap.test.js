import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-depth-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seed(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Engorda Norte'},{expectedVersion:0});
  await db.putRecord('cattle.animals','a1',{id:'a1',tag:'A1',lotId:'l1',status:'active',sex:'female',weights:[{measuredAt:'2026-09-01T00:00:00.000Z',weightKg:400},{measuredAt:'2026-09-11T00:00:00.000Z',weightKg:430}]},{expectedVersion:0});
  await db.putRecord('cattle.animals','a2',{id:'a2',tag:'A2',lotId:'l1',status:'active',sex:'female',weights:[{measuredAt:'2026-09-01T00:00:00.000Z',weightKg:500},{measuredAt:'2026-09-11T00:00:00.000Z',weightKg:510}]},{expectedVersion:0});
  await db.putRecord('cattle.pastures','p1',{id:'p1',name:'Piquete 1',farmUnitId:'f1',areaHa:10,capacityAu:10,status:'active',forage:'braquiaria'},{expectedVersion:0});
  await db.putRecord('cattle.pasture-occupancy','o1',{id:'o1',pastureId:'p1',lotId:'l1',enteredAt:'2026-09-10T00:00:00.000Z',leftAt:null,animalUnits:8.5},{expectedVersion:0});
  await db.putRecord('cattle.events','san1',{id:'san1',kind:'sanitary',animalId:'a1',protocolId:'vac',productItemId:'med1',occurredAt:'2026-09-10T00:00:00.000Z',nextDueAt:'2026-09-15T00:00:00.000Z',withdrawalUntil:'2026-10-01T00:00:00.000Z',costMinor:500},{expectedVersion:0});
  const reproduction=[
    {id:'r1',kind:'reproduction',animalId:'a1',type:'calving',occurredAt:'2025-01-01T00:00:00.000Z',metadata:{}},
    {id:'r2',kind:'reproduction',animalId:'a1',type:'service',occurredAt:'2025-03-02T00:00:00.000Z',metadata:{method:'iatf',bullOrSemen:'SEM-01',protocol:'IATF-A'}},
    {id:'r3',kind:'reproduction',animalId:'a1',type:'pregnancy-check',occurredAt:'2025-04-01T00:00:00.000Z',metadata:{result:'positive'}},
    {id:'r4',kind:'reproduction',animalId:'a1',type:'calving',occurredAt:'2026-01-01T00:00:00.000Z',metadata:{}},
    {id:'r5',kind:'reproduction',animalId:'a1',type:'service',occurredAt:'2026-03-01T00:00:00.000Z',metadata:{method:'iatf',bullOrSemen:'SEM-01',protocol:'IATF-A',expectedCalvingAt:'2026-10-15T00:00:00.000Z'}},
    {id:'r6',kind:'reproduction',animalId:'a1',type:'pregnancy-check',occurredAt:'2026-04-01T00:00:00.000Z',metadata:{result:'pregnant'}}
  ];
  for(const event of reproduction)await db.putRecord('cattle.events',event.id,event,{expectedVersion:0});
  await db.putRecord('cattle.inventory','feed1',{id:'feed1',name:'Ração',kind:'feed',unit:'kg',quantity:1000,minQuantity:100,costMinor:200},{expectedVersion:0});
  await db.putRecord('cattle.nutrition','n1',{id:'n1',name:'Plano ganho',lotId:'l1',feedItemId:'feed1',dailyKgPerHead:2,startsAt:'2026-09-01T00:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.finance','f1',{id:'f1',direction:'expense',amountMinor:20000,allocation:{kind:'cattle-lot',id:'l1'},description:'Nutrição'},{expectedVersion:0});
  await db.putRecord('cattle.finance','f2',{id:'f2',direction:'income',amountMinor:80000,allocation:{kind:'cattle-lot',id:'l1'},description:'Receita'},{expectedVersion:0});
  await db.putRecord('cattle.trades','t0',{id:'t0',type:'sale',partyId:'fr1',animalIds:['old'],totalAmountMinor:10000,occurredAt:'2026-08-01T00:00:00.000Z',metadata:{}},{expectedVersion:0});
}

test('pasture insights derive stocking pressure, occupancy and production per hectare',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const result=await reporting.pastureInsights({now:'2026-09-20T00:00:00.000Z'});assert.equal(result.rows.length,1);const row=result.rows[0];assert.equal(row.stockingAuHa,0.85);assert.equal(row.capacityAuHa,1);assert.equal(row.utilizationPct,85);assert.equal(row.occupancyDays,10);assert.equal(row.headCount,2);assert.equal(row.totalWeightKg,940);assert.equal(row.kgPerHa,94);assert.equal(row.liveArrobasPerHa,6.27);assert.equal(row.pressure,'attention');}finally{await f.cleanup()}
});

test('reproduction insights connect the cycle and compare reproductive drivers',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const result=await reporting.reproductionInsights({now:'2026-09-20T00:00:00.000Z'});assert.equal(result.metrics.averageCalvingIntervalDays,365);assert.equal(result.metrics.averageDaysOpen,59.5);assert.equal(result.metrics.expectedCalvings60d,1);assert.equal(result.bySire[0].name,'SEM-01');assert.equal(result.bySire[0].conceptionRatePct,100);assert.equal(result.byMethod[0].key,'iatf');assert.equal(result.byProtocol[0].key,'IATF-A');}finally{await f.cleanup()}
});

test('sanitary analytics expose coverage, overdue handling, withdrawal and accumulated cost',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const result=await reporting.sanitaryInsights({now:'2026-09-20T00:00:00.000Z'});assert.equal(result.summary.activeAnimals,2);assert.equal(result.summary.coveredAnimals,1);assert.equal(result.summary.coveragePct,50);assert.equal(result.summary.overdue,1);assert.equal(result.summary.activeWithdrawal,1);assert.equal(result.summary.totalCostMinor,500);assert.equal(result.byProtocol[0].key,'vac');}finally{await f.cleanup()}
});

test('productive intelligence ranks GMD and makes transparent weight projections',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const result=await reporting.performanceInsights();assert.equal(result.summary.averageDailyGainKg,2);assert.equal(result.summary.belowTarget,1);assert.equal(result.ranking[0].id,'a1');assert.equal(result.ranking[0].dailyGainKg,3);assert.equal(result.ranking[0].projectedWeight30d,520);assert.equal(result.ranking[1].projectedWeight90d,600);}finally{await f.cleanup()}
});

test('sale simulator is read-only and respects carcass settlement inputs',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const before=(await f.db.listRecords('cattle.trades')).length;const result=await reporting.simulateSale({lotId:'l1',carcassYieldPct:52,pricePerCarcassArrobaMinor:30000,deductionsMinor:10000,freightMinor:20000,commissionMinor:6000});assert.equal(result.animalCount,2);assert.equal(result.liveWeightKg,940);assert.equal(result.carcassWeightKg,488.8);assert.equal(result.netMinor,941600);assert.equal((await f.db.listRecords('cattle.trades')).length,before);}finally{await f.cleanup()}
});

test('advanced reports cover reproduction, commercial, nutrition, finance and performance',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;for(const type of ['reproduction','commercial','nutrition','finance','performance']){const report=await reporting.build(type,{lotId:'l1'});assert.equal(report.type,type);assert.ok(Array.isArray(report.rows));assert.ok(report.rows.length>0,`${type} should have rows`);}}finally{await f.cleanup()}
});

test('finance insights compare lots without changing persisted finance entries',async()=>{
  const f=await fixture();try{await seed(f.db);const reporting=createCattlePresentation({persistence:f.db}).services.reporting;const before=(await f.db.listRecords('cattle.finance')).length;const result=await reporting.financeInsights();assert.equal(result.summary.incomeMinor,80000);assert.equal(result.summary.costMinor,20000);assert.equal(result.summary.resultMinor,60000);assert.equal(result.lots[0].costPerHeadMinor,10000);assert.equal((await f.db.listRecords('cattle.finance')).length,before);}finally{await f.cleanup()}
});
