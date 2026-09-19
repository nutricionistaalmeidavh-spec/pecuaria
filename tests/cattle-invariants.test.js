import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattleRepositories} from '../src/catalog.js';
import {createAnimal,createCattleLot} from '../src/index.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-invariants-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,repos:createCattleRepositories(db),async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

const lot=(id='l1')=>createCattleLot({id,name:`Lote ${id}`,farmUnitId:'farm-1'});
const animal=(id,tag,lotId=null)=>createAnimal({id,tag,farmUnitId:'farm-1',lotId});

test('animal tags are unique case-insensitively',async()=>{
  const f=await fixture();
  try{
    await f.repos.animals.save(animal('a1','BR-001'),{expectedVersion:0});
    await assert.rejects(()=>f.repos.animals.save(animal('a2',' br-001 '),{expectedVersion:0}),/Animal tag already exists/i);
    assert.equal((await f.repos.animals.list()).length,1);
  }finally{await f.cleanup()}
});

test('updating an animal may keep its own tag',async()=>{
  const f=await fixture();
  try{
    const first=await f.repos.animals.save(animal('a1','BR-002'),{expectedVersion:0});
    const updated=await f.repos.animals.save({...first.payload,metadata:{note:'ok'}},{expectedVersion:first.version});
    assert.equal(updated.version,2);
    assert.equal(updated.payload.tag,'BR-002');
  }finally{await f.cleanup()}
});

test('animal lot reference must exist',async()=>{
  const f=await fixture();
  try{
    await assert.rejects(()=>f.repos.animals.save(animal('a1','BR-003','missing-lot'),{expectedVersion:0}),/Lot not found/i);
    assert.equal(await f.repos.animals.get('a1'),null);
  }finally{await f.cleanup()}
});

test('concurrent duplicate animal tags allow exactly one writer',async()=>{
  const f=await fixture();
  try{
    const results=await Promise.allSettled([
      f.repos.animals.save(animal('a1','RACE-001'),{expectedVersion:0}),
      f.repos.animals.save(animal('a2','race-001'),{expectedVersion:0})
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.match(results.find(r=>r.status==='rejected').reason.message,/Animal tag already exists/i);
    assert.equal((await f.repos.animals.list()).length,1);
  }finally{await f.cleanup()}
});

test('movement rejects a missing destination lot',async()=>{
  const f=await fixture();
  try{
    await f.repos.lots.save(lot('l1'),{expectedVersion:0});
    await f.repos.animals.save(animal('a1','MOVE-001','l1'),{expectedVersion:0});
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await assert.rejects(()=>presentation.action('animals','move',{id:'a1',toLotId:'missing',movedAt:'2026-09-19T12:00:00Z'}),/Lot not found/i);
    assert.equal((await f.repos.animals.get('a1')).payload.lotId,'l1');
  }finally{await f.cleanup()}
});

test('sanitary event rejects missing animal or protocol references',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await assert.rejects(()=>presentation.action('sanitary','record',{
      id:'s1',animalId:'missing-animal',protocolId:'missing-protocol',productItemId:'med-1',dose:1,unit:'ml',occurredAt:'2026-09-19T12:00:00Z'
    }),/(Animal|Protocol).*not found/i);
    assert.equal((await f.repos.events.list()).length,0);
  }finally{await f.cleanup()}
});

test('reproduction event rejects missing primary and related animals',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db,recovery:null});
    await assert.rejects(()=>presentation.action('reproduction','record',{
      id:'r1',animalId:'missing',type:'service',occurredAt:'2026-09-19T12:00:00Z'
    }),/Animal not found/i);
    await f.repos.animals.save(animal('a1','REP-001'),{expectedVersion:0});
    await assert.rejects(()=>presentation.action('reproduction','record',{
      id:'r2',animalId:'a1',relatedAnimalId:'missing-related',type:'service',occurredAt:'2026-09-19T12:00:00Z'
    }),/Animal not found/i);
    assert.equal((await f.repos.events.list()).length,0);
  }finally{await f.cleanup()}
});
