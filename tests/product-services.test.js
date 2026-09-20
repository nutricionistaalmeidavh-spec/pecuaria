import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createLocalSearchService} from '../src/services/search.js';
import {createCattleAlertsService} from '../src/services/alerts.js';
import {createCattleTransferService} from '../src/services/transfer.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-services-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('local search matches normalized product data and stays inside allowed collections',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.animals','a1',{id:'a1',tag:'BR-01',name:'Pérola',lotId:'l1'},{expectedVersion:0});
    await f.db.putRecord('security-users:agro-pecuaria','secret',{id:'secret',username:'perola-secret'},{expectedVersion:0});
    const search=createLocalSearchService(f.db);
    const results=await search.query({term:'perola'});
    assert.equal(results.length,1);
    assert.equal(results[0].collection,'cattle.animals');
    assert.equal(results[0].id,'a1');
    assert.match(results[0].label,/Pérola|BR-01/);
    await assert.rejects(()=>search.query({term:'secret',collections:['security-users:agro-pecuaria']}),/collection|allowed/i);
  }finally{await f.cleanup()}
});

test('alerts derive overdue and upcoming sanitary work without writing records',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.events','overdue',{id:'overdue',kind:'sanitary',animalId:'a1',nextDueAt:'2026-09-18T12:00:00.000Z'},{expectedVersion:0});
    await f.db.putRecord('cattle.events','upcoming',{id:'upcoming',kind:'sanitary',animalId:'a2',nextDueAt:'2026-09-22T12:00:00.000Z'},{expectedVersion:0});
    await f.db.putRecord('cattle.events','far',{id:'far',kind:'sanitary',animalId:'a3',nextDueAt:'2026-10-20T12:00:00.000Z'},{expectedVersion:0});
    const before=(await f.db.listRecords('cattle.events')).length;
    const alerts=createCattleAlertsService({persistence:f.db,now:()=>new Date('2026-09-19T12:00:00.000Z')});
    const rows=await alerts.list();
    assert.ok(rows.some(row=>row.kind==='sanitary-overdue'&&row.entityId==='overdue'));
    assert.ok(rows.some(row=>row.kind==='sanitary-upcoming'&&row.entityId==='upcoming'));
    assert.ok(!rows.some(row=>row.entityId==='far'));
    assert.equal((await f.db.listRecords('cattle.events')).length,before);
  }finally{await f.cleanup()}
});

test('transfer exports versioned documents and validate mode never writes',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.lots','l1',{id:'l1',name:'Lote Norte'},{expectedVersion:0});
    const transfer=createCattleTransferService(f.db);
    const document=await transfer.exportCollection('cattle.lots');
    assert.equal(document.format,'artisys-pecuaria-export');
    assert.equal(document.version,1);
    assert.equal(document.productId,'agro-pecuaria');
    assert.equal(document.collection,'cattle.lots');
    assert.deepEqual(document.records.map(record=>record.id),['l1']);

    const importDoc={...document,collection:'cattle.categories',records:[{id:'c1',payload:{id:'c1',name:'Novilhas',purpose:'beef'}}]};
    const checked=await transfer.importCollection(importDoc,{mode:'validate'});
    assert.equal(checked.valid,true);
    assert.equal(checked.imported,0);
    assert.equal(await f.db.getRecord('cattle.categories','c1'),null);
  }finally{await f.cleanup()}
});

test('append import is atomic and rejects duplicate ids instead of overwriting',async()=>{
  const f=await fixture();
  try{
    const transfer=createCattleTransferService(f.db);
    const document={format:'artisys-pecuaria-export',version:1,productId:'agro-pecuaria',collection:'cattle.categories',records:[
      {id:'c1',payload:{id:'c1',name:'Novilhas',purpose:'beef'}},
      {id:'c2',payload:{id:'c2',name:'Vacas',purpose:'dairy'}}
    ]};
    const appended=await transfer.importCollection(document,{mode:'append'});
    assert.equal(appended.imported,2);
    assert.equal((await f.db.getRecord('cattle.categories','c1')).payload.name,'Novilhas');
    await assert.rejects(()=>transfer.importCollection(document,{mode:'append'}),/duplicate|exists/i);
    assert.equal((await f.db.listRecords('cattle.categories')).length,2);

    const internalDuplicate={...document,records:[document.records[0],{...document.records[0]}]};
    await assert.rejects(()=>transfer.importCollection(internalDuplicate,{mode:'validate'}),/duplicate/i);
  }finally{await f.cleanup()}
});

test('presentation exposes product services and the expanded IoT screen contract',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db});
    assert.equal(typeof presentation.services.search.query,'function');
    assert.equal(typeof presentation.services.alerts.list,'function');
    assert.equal(typeof presentation.services.transfer.exportCollection,'function');
    assert.equal(typeof presentation.services.iot.load,'function');
    assert.deepEqual(presentation.screenIds(),['overview','lots','animals','weights','sanitary','reproduction','trades','finance','reports','data','iot','settings']);
  }finally{await f.cleanup()}
});
