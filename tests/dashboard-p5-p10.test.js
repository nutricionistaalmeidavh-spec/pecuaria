import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-dashboard-p5-p10-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seed(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Matrizes',purpose:'breeding'},{expectedVersion:0});
  await db.putRecord('cattle.lots','l2',{id:'l2',name:'Recria',purpose:'beef'},{expectedVersion:0});
  await db.putRecord('cattle.animals','a1',{id:'a1',tag:'MAT-001',name:'Aurora',sex:'female',lotId:'l1',status:'active',weights:[
    {measuredAt:'2026-09-01T10:00:00.000Z',weightKg:380},
    {measuredAt:'2026-09-18T10:00:00.000Z',weightKg:420}
  ]},{expectedVersion:0});
  await db.putRecord('cattle.animals','a2',{id:'a2',tag:'REC-002',name:'Forte',sex:'male',lotId:'l2',status:'active',weights:[
    {measuredAt:'2026-09-02T10:00:00.000Z',weightKg:400},
    {measuredAt:'2026-09-19T10:00:00.000Z',weightKg:430}
  ]},{expectedVersion:0});
  await db.putRecord('cattle.events','s1',{id:'s1',kind:'sanitary',animalId:'a1',type:'vaccine',occurredAt:'2026-09-15T09:00:00.000Z',nextDueAt:'2026-09-25T09:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.events','r1',{id:'r1',kind:'reproduction',animalId:'a1',type:'service',occurredAt:'2026-09-10T09:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.events','r2',{id:'r2',kind:'reproduction',animalId:'a1',type:'pregnancy-check',occurredAt:'2026-09-16T09:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.events','r3',{id:'r3',kind:'reproduction',animalId:'a1',relatedAnimalId:'a2',type:'calving',occurredAt:'2026-09-19T14:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.trades','t1',{id:'t1',type:'purchase',animalIds:[],totalAmountMinor:120000,occurredAt:'2026-09-17T12:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.finance','f1',{id:'f1',kind:'cost',amountMinor:15000,lotId:'l1'},{expectedVersion:0});
  await db.putRecord('cattle.finance','f2',{id:'f2',kind:'income',amountMinor:50000,lotId:'l1'},{expectedVersion:0});
}

test('P5-P7 overview derives operational performance, reproduction, lot distribution, finance and recent activity',async()=>{
  const f=await fixture();
  try{
    await seed(f.db);
    const data=await createCattlePresentation({persistence:f.db}).load('overview');

    assert.equal(data.performance.averageGainKg,35);
    assert.equal(data.performance.latestWeights.length,4);
    assert.deepEqual(data.performance.latestWeights.slice(0,2).map(item=>item.weightKg),[430,420]);
    assert.equal(data.performance.series.length,4);

    assert.deepEqual(data.reproduction,{total:3,services:1,pregnancyChecks:1,calvings:1,weanings:0});
    assert.equal(data.sanitary.totalEvents,1);
    assert.equal(data.sanitary.alerts,data.alerts.length);

    assert.deepEqual(data.lotDistribution.map(item=>[item.id,item.activeAnimals]),[['l1',1],['l2',1]]);
    assert.deepEqual(data.finance,{incomeMinor:50000,costMinor:15000,resultMinor:35000});

    assert.ok(data.recentActivity.length>=6);
    assert.equal(data.recentActivity[0].kind,'reproduction');
    assert.equal(data.recentActivity[0].occurredAt,'2026-09-19T14:00:00.000Z');
    assert.equal(data.recentActivity.some(item=>item.kind==='weight'),true);
    assert.equal(data.recentActivity.some(item=>item.kind==='trade'),true);
  }finally{await f.cleanup()}
});
