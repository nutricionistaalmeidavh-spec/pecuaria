import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-reporting-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seed(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Lote "Norte", A'},{expectedVersion:0});
  await db.putRecord('cattle.animals','a1',{id:'a1',tag:'BR-01',name:'Pérola',lotId:'l1',status:'active',weights:[{measuredAt:'2026-09-01T12:00:00.000Z',weightKg:420}]},{expectedVersion:0});
  await db.putRecord('cattle.animals','a2',{id:'a2',tag:'BR-02',name:'Estrela',lotId:'l1',status:'active',weights:[{measuredAt:'2026-09-02T12:00:00.000Z',weightKg:380}]},{expectedVersion:0});
  await db.putRecord('cattle.events','s1',{id:'s1',kind:'sanitary',animalId:'a1',protocolId:'p1',performedAt:'2026-09-10T12:00:00.000Z',nextDueAt:'2026-09-25T12:00:00.000Z'},{expectedVersion:0});
  await db.putRecord('cattle.trades','t1',{id:'t1',type:'purchase',animalIds:['a1']},{expectedVersion:0});
  await db.putRecord('cattle.finance','f1',{id:'f1',lotId:'l1',kind:'cost',amountMinor:15000},{expectedVersion:0});
  await db.putRecord('cattle.finance','f2',{id:'f2',lotId:'l1',kind:'income',amountMinor:50000},{expectedVersion:0});
}

test('presentation exposes reporting/dashboard while preserving IoT surface',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db});
    assert.equal(typeof presentation.services.reporting?.build,'function');
    assert.equal(typeof presentation.services.reporting?.csv,'function');
    assert.equal(typeof presentation.services.dashboard?.snapshot,'function');
    assert.equal(typeof presentation.services.iot?.load,'function');
    assert.deepEqual(presentation.screenIds(),['overview','lots','animals','weights','sanitary','reproduction','trades','finance','reports','iot','settings']);
  }finally{await f.cleanup()}
});

test('reporting derives animal history, lot KPIs and sanitary rows from current persisted data',async()=>{
  const f=await fixture();
  try{
    await seed(f.db);
    const reporting=createCattlePresentation({persistence:f.db}).services.reporting;
    const animal=await reporting.build('animal-history',{animalId:'a1'});
    assert.equal(animal.type,'animal-history');
    assert.equal(animal.rows[0].animalId,'a1');
    assert.equal(animal.rows[0].latestWeightKg,420);

    const lot=await reporting.build('lot-kpis',{lotId:'l1'});
    assert.equal(lot.rows[0].activeAnimals,2);
    assert.equal(lot.rows[0].averageWeightKg,400);
    assert.equal(lot.rows[0].costMinor,15000);
    assert.equal(lot.rows[0].incomeMinor,50000);

    const sanitary=await reporting.build('sanitary');
    assert.equal(sanitary.rows.length,1);
    assert.equal(sanitary.rows[0].animalId,'a1');
    await assert.rejects(()=>reporting.build('unknown'),/unknown|unsupported/i);
  }finally{await f.cleanup()}
});

test('reporting CSV escapes commas and quotes',async()=>{
  const f=await fixture();
  try{
    await seed(f.db);
    const csv=await createCattlePresentation({persistence:f.db}).services.reporting.csv('lot-kpis',{lotId:'l1'});
    assert.match(csv,/"Lote ""Norte"", A"/);
  }finally{await f.cleanup()}
});

test('dashboard snapshot preserves existing KPIs, adds finance and does not persist cache records',async()=>{
  const f=await fixture();
  try{
    await seed(f.db);
    const before=(await f.db.listRecords('__dashboard_cache')).length;
    const snapshot=await createCattlePresentation({persistence:f.db}).services.dashboard.snapshot();
    assert.equal(snapshot.kpis.activeAnimals,2);
    assert.equal(snapshot.kpis.lots,1);
    assert.equal(snapshot.kpis.averageWeightKg,400);
    assert.equal(snapshot.kpis.sanitaryEvents,1);
    assert.equal(snapshot.kpis.trades,1);
    assert.equal(snapshot.kpis.costMinor,15000);
    assert.equal(snapshot.kpis.incomeMinor,50000);
    assert.ok(Array.isArray(snapshot.alerts));
    assert.equal(new Set(snapshot.layout.map(item=>item.id)).size,snapshot.layout.length);
    assert.equal((await f.db.listRecords('__dashboard_cache')).length,before);
  }finally{await f.cleanup()}
});
