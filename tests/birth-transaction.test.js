import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattleRepositories} from '../src/catalog.js';
import {createAnimal,createCattleLot} from '../src/index.js';
import {createBirthRecords} from '../src/birth.js';
import {createCattlePresentation} from '../src/presentation.js';

const validBirth=(overrides={})=>({
  id:'calf-1',tag:'CALF-001',farmUnitId:'farm-1',birthDate:'2026-09-20T08:00:00Z',sex:'female',
  damId:'dam-1',sireId:'sire-1',lotId:'lot-1',breedId:'nelore',categoryId:'bezerro',rfid:'EID-CALF-001',notes:'parto sem intercorrência',
  ...overrides
});

test('createBirthRecords validates required fields and builds one deterministic birth representation',()=>{
  const result=createBirthRecords(validBirth());
  assert.equal(result.animal.id,'calf-1');
  assert.equal(result.animal.tag,'CALF-001');
  assert.equal(result.animal.birthDate,'2026-09-20T08:00:00Z');
  assert.equal(result.animal.damId,'dam-1');
  assert.equal(result.animal.sireId,'sire-1');
  assert.equal(result.animal.rfid,'EID-CALF-001');
  assert.deepEqual(result.birthEvent,{
    id:'calf-1:birth',kind:'birth',type:'birth',animalId:'calf-1',relatedAnimalId:'dam-1',occurredAt:'2026-09-20T08:00:00Z',metadata:{sireId:'sire-1',notes:'parto sem intercorrência'}
  });
  for(const field of ['id','tag','farmUnitId','birthDate','sex'])assert.throws(()=>createBirthRecords(validBirth({[field]:''})),/required/i);
});

test('createBirthRecords accepts optional parents lot RFID and notes without inventing values',()=>{
  const result=createBirthRecords(validBirth({id:'calf-2',tag:'CALF-002',damId:null,sireId:null,lotId:null,breedId:null,categoryId:null,rfid:null,notes:null}));
  assert.equal(result.animal.damId,null);
  assert.equal(result.animal.sireId,null);
  assert.equal(result.animal.lotId,null);
  assert.equal(result.birthEvent.relatedAnimalId,null);
  assert.deepEqual(result.birthEvent.metadata,{sireId:null,notes:null});
});

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-birth-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const repos=createCattleRepositories(db);
  await repos.lots.save(createCattleLot({id:'lot-1',name:'Maternidade',farmUnitId:'farm-1'}),{expectedVersion:0});
  await repos.animals.save(createAnimal({id:'dam-1',tag:'DAM-001',farmUnitId:'farm-1',lotId:'lot-1',sex:'female'}),{expectedVersion:0});
  await repos.animals.save(createAnimal({id:'sire-1',tag:'SIRE-001',farmUnitId:'farm-1',lotId:'lot-1',sex:'male'}),{expectedVersion:0});
  const presentation=createCattlePresentation({persistence:db});
  return{dir,db,repos,presentation,async close(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('animals.registerBirth saves calf and dedicated birth event atomically',async()=>{
  const f=await fixture();
  try{
    const saved=await f.presentation.action('animals','registerBirth',validBirth());
    assert.equal(saved.animal.payload.id,'calf-1');
    assert.equal(saved.birthEvent.payload.id,'calf-1:birth');
    const calf=await f.db.getRecord('cattle.animals','calf-1');
    const event=await f.db.getRecord('cattle.events','calf-1:birth');
    assert.equal(calf.payload.damId,'dam-1');
    assert.equal(event.payload.kind,'birth');
    const detail=await f.presentation.load('animals',{animalId:'calf-1'});
    assert.ok(detail.detail.timeline.some(item=>item.kind==='birth'&&item.title==='Nascimento'));
  }finally{await f.close()}
});

test('birth rejects invalid references and duplicate ids without partial animal/event writes',async()=>{
  const cases=[
    ['missing dam',{id:'calf-bad-dam',tag:'BAD-DAM',damId:'missing-dam'},/Animal not found/i],
    ['missing sire',{id:'calf-bad-sire',tag:'BAD-SIRE',sireId:'missing-sire'},/Animal not found/i],
    ['missing lot',{id:'calf-bad-lot',tag:'BAD-LOT',lotId:'missing-lot'},/Lot not found/i]
  ];
  for(const [,overrides,pattern] of cases){
    const f=await fixture();
    try{
      const input=validBirth(overrides);
      await assert.rejects(()=>f.presentation.action('animals','registerBirth',input),pattern);
      assert.equal(await f.db.getRecord('cattle.animals',input.id),null);
      assert.equal(await f.db.getRecord('cattle.events',`${input.id}:birth`),null);
    }finally{await f.close()}
  }

  const f=await fixture();
  try{
    await f.repos.animals.save(createAnimal({id:'duplicate-id',tag:'EXISTING',farmUnitId:'farm-1',lotId:'lot-1'}),{expectedVersion:0});
    const beforeEvents=(await f.db.listRecords('cattle.events')).length;
    await assert.rejects(()=>f.presentation.action('animals','registerBirth',validBirth({id:'duplicate-id',tag:'NEW-TAG'})),/version|exist|conflict/i);
    assert.equal((await f.db.listRecords('cattle.events')).length,beforeEvents);
    assert.equal(await f.db.getRecord('cattle.events','duplicate-id:birth'),null);
  }finally{await f.close()}
});
