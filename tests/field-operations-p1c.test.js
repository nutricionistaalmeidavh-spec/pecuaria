import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createCattleRepositories} from '../src/catalog.js';
import {createRpcBackend} from '../runtime/backend.mjs';

async function fixture(name){
  const dir=await mkdtemp(join(tmpdir(),`pecuaria-field-ops-${name}-`));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const presentation=createCattlePresentation({persistence:db});
  const backend=createRpcBackend({presentation,persistence:db});
  await backend.bootstrap({username:'admin',password:'12345678'});
  const login=await backend.login({username:'admin',password:'12345678'});
  return{dir,db,presentation,backend,auth:{sessionId:login.session.id,token:login.token},async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function pair(base,field){
  const configured=await base.backend.fieldSync({auth:base.auth,operation:'configure',input:{role:'base',deviceName:'Escritorio'}});
  await field.backend.fieldSync({auth:field.auth,operation:'configure',input:{role:'field',deviceName:'Campo',pairing:configured.pairing}});
  const initial=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
  await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:initial}});
}

const animal=(id,{sex='female',lotId='lot-a'}={})=>({
  id,tag:id.toUpperCase(),farmUnitId:'farm-1',purpose:'beef',lotId,sex,status:'active',
  weights:[],milkRecords:[],movements:[],lifecycle:[],metadata:{}
});

async function seedCompleteBase(db){
  for(const [id,name] of [['lot-a','Lote A'],['lot-b','Lote B'],['lot-enter','Lote Entrada'],['lot-leave','Lote Saida']]){
    await db.putRecord('cattle.lots',id,{id,name,farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
  }
  const animals=[
    ['dam-1',{sex:'female'}],['sire-1',{sex:'male'}],['repro-1',{}],['wean-1',{}],['death-1',{}],['rfid-1',{}],['trace-1',{}],
    ['move-1',{}],['move-2',{}],['life-1',{}],['life-2',{}],['san-1',{}],['san-2',{}],['repro-b1',{}],['repro-b2',{}],['body-1',{}]
  ];
  for(const [id,options] of animals)await db.putRecord('cattle.animals',id,animal(id,options),{expectedVersion:0});

  await db.putRecord('cattle.sanitary-protocols','proto-1',{
    id:'proto-1',name:'Protocolo Campo',productItemId:'med-1',dose:1,unit:'ml',intervalDays:null,withdrawalDays:null,activeIngredient:'teste'
  },{expectedVersion:0});
  await db.putRecord('cattle.inventory','med-1',{
    id:'med-1',name:'Medicamento',kind:'medicine',unit:'ml',quantity:50,minQuantity:0,batch:'L1',expiresAt:null,costMinor:10
  },{expectedVersion:0});
  await db.putRecord('cattle.pastures','pasture-enter',{
    id:'pasture-enter',name:'Piquete Entrada',farmUnitId:'farm-1',areaHa:10,capacityAu:20,status:'available',forage:null,color:null,polygon:null,restTargetDays:10,occupancyTargetDays:3,targetHeightCm:null,notes:null
  },{expectedVersion:0});
  await db.putRecord('cattle.pastures','pasture-leave',{
    id:'pasture-leave',name:'Piquete Saida',farmUnitId:'farm-1',areaHa:8,capacityAu:15,status:'available',forage:null,color:null,polygon:null,restTargetDays:10,occupancyTargetDays:3,targetHeightCm:null,notes:null
  },{expectedVersion:0});
  await db.putRecord('cattle.pasture-occupancy','occ-leave',{
    id:'occ-leave',pastureId:'pasture-leave',lotId:'lot-leave',enteredAt:'2026-09-18T08:00:00.000Z',leftAt:null,animalUnits:5,notes:null
  },{expectedVersion:0});
}

async function counts(db){
  const collections=['cattle.animals','cattle.events','cattle.traceability','cattle.pasture-occupancy','cattle.body-condition','cattle.pasture-assessments','iot.rfid-bindings'];
  return Object.fromEntries(await Promise.all(collections.map(async collection=>[collection,(await db.listRecords(collection)).length])));
}

async function quick(field,kind,input){
  return field.backend.fieldSync({auth:field.auth,operation:'quick',input:{kind,input}});
}

test('all 14 new P1C quick kinds roundtrip once and replay without duplicating canonical records',async()=>{
  const base=await fixture('all-base'),field=await fixture('all-field');
  try{
    await seedCompleteBase(base.db);
    await pair(base,field);

    const results=[];
    results.push(await quick(field,'reproduction.record',{animalId:'repro-1',type:'pregnancy-check',occurredAt:'2026-09-20T08:00:00Z'}));
    results.push(await quick(field,'animal.birth',{id:'calf-1',tag:'CALF-001',farmUnitId:'farm-1',birthDate:'2026-09-20T08:10:00Z',sex:'female',damId:'dam-1',sireId:'sire-1',lotId:'lot-a'}));
    results.push(await quick(field,'animal.weaning',{animalId:'wean-1',occurredAt:'2026-09-20T08:20:00Z'}));
    results.push(await quick(field,'animal.death',{animalId:'death-1',occurredAt:'2026-09-20T08:30:00Z',reason:'registro de campo'}));
    results.push(await quick(field,'rfid.bind',{tagId:'982000411823945',animalId:'rfid-1'}));
    results.push(await quick(field,'traceability.save',{id:'trace-field-1',animalId:'trace-1',type:'identity',documentNumber:'DOC-1',issuedAt:'2026-09-20T08:40:00Z'}));
    results.push(await quick(field,'animal.batchMove',{animalIds:['move-1','move-2'],toLotId:'lot-b',movedAt:'2026-09-20T08:50:00Z'}));
    results.push(await quick(field,'animal.batchLifecycle',{animalIds:['life-1','life-2'],type:'disposal',occurredAt:'2026-09-20T09:00:00Z',reason:'manejo'}));
    results.push(await quick(field,'sanitary.batchRecord',{animalIds:['san-1','san-2'],protocolId:'proto-1',occurredAt:'2026-09-20T09:10:00Z'}));
    results.push(await quick(field,'reproduction.batchRecord',{animalIds:['repro-b1','repro-b2'],type:'weaning',occurredAt:'2026-09-20T09:20:00Z'}));
    results.push(await quick(field,'pasture.enterLot',{id:'occ-enter',pastureId:'pasture-enter',lotId:'lot-enter',enteredAt:'2026-09-20T09:30:00Z',animalUnits:4}));
    results.push(await quick(field,'pasture.leaveLot',{id:'occ-leave',leftAt:'2026-09-20T09:40:00Z'}));
    results.push(await quick(field,'animal.bodyScore',{id:'body-field-1',animalId:'body-1',occurredAt:'2026-09-20T09:50:00Z',score:3.5}));
    results.push(await quick(field,'pasture.score',{id:'pasture-score-1',pastureId:'pasture-enter',occurredAt:'2026-09-20T10:00:00Z',score:4,heightCm:28}));

    assert.equal(results.length,14);
    assert.equal(results.at(-1).state.pending,14);
    assert.equal((await field.db.getRecord('cattle.inventory','med-1')).payload.quantity,48);

    const outbound=await field.backend.fieldSync({auth:field.auth,operation:'exportBundle'});
    const first=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.deepEqual(first.operations,{applied:14,skipped:0,conflicts:0});

    assert.equal((await base.db.getRecord('cattle.animals','calf-1'))?.payload?.damId,'dam-1');
    assert.equal((await base.db.getRecord('cattle.events','calf-1:birth'))?.payload?.kind,'birth');
    assert.equal((await base.db.getRecord('cattle.animals','death-1'))?.payload?.status,'dead');
    assert.equal((await base.db.getRecord('cattle.animals','move-1'))?.payload?.lotId,'lot-b');
    assert.equal((await base.db.getRecord('cattle.animals','life-1'))?.payload?.status,'disposed');
    assert.equal((await base.db.getRecord('cattle.traceability','trace-field-1'))?.payload?.animalId,'trace-1');
    assert.deepEqual((await base.db.getRecord('iot.rfid-bindings','rfid:982000411823945'))?.payload,{tagId:'982000411823945',animalId:'rfid-1'});
    assert.equal((await base.db.getRecord('cattle.pasture-occupancy','occ-enter'))?.payload?.lotId,'lot-enter');
    assert.equal((await base.db.getRecord('cattle.pasture-occupancy','occ-leave'))?.payload?.leftAt,'2026-09-20T09:40:00.000Z');
    assert.equal((await base.db.getRecord('cattle.body-condition','body-field-1'))?.payload?.score,3.5);
    assert.equal((await base.db.getRecord('cattle.pasture-assessments','pasture-score-1'))?.payload?.score,4);
    assert.equal((await base.db.getRecord('cattle.inventory','med-1')).payload.quantity,48);

    const sanitaryOperation=results[8].operationId;
    const reproductionBatchOperation=results[9].operationId;
    assert.ok(await base.db.getRecord('cattle.events',`field-san-batch-${sanitaryOperation}-san-1-0`));
    assert.ok(await base.db.getRecord('cattle.events',`field-san-batch-${sanitaryOperation}-san-2-1`));
    assert.ok(await base.db.getRecord('cattle.events',`field-repro-batch-${reproductionBatchOperation}-repro-b1-0`));
    assert.ok(await base.db.getRecord('cattle.events',`field-repro-batch-${reproductionBatchOperation}-repro-b2-1`));

    const beforeReplay=await counts(base.db);
    const duplicate=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.equal(duplicate.operations.applied,0);
    assert.equal(duplicate.operations.conflicts,0);
    assert.ok(duplicate.operations.skipped>=14);
    assert.deepEqual(await counts(base.db),beforeReplay);
    assert.equal((await base.db.getRecord('cattle.inventory','med-1')).payload.quantity,48);

    const receiptBundle=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    const acknowledged=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:receiptBundle}});
    assert.equal(acknowledged.state.pending,0);
    assert.equal(acknowledged.state.acknowledged,14);
    assert.equal(acknowledged.state.conflicts,0);
  }finally{await base.cleanup();await field.cleanup()}
});

test('remote birth reference failure creates conflict receipt and never leaves partial calf/event on base',async()=>{
  const base=await fixture('birth-base'),field=await fixture('birth-field');
  try{
    await base.db.putRecord('cattle.lots','lot-a',{id:'lot-a',name:'Maternidade',farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
    await base.db.putRecord('cattle.animals','dam-conflict',animal('dam-conflict'),{expectedVersion:0});
    await pair(base,field);

    const local=await quick(field,'animal.birth',{
      id:'calf-conflict',tag:'CALF-CONFLICT',farmUnitId:'farm-1',birthDate:'2026-09-20T11:00:00Z',sex:'male',damId:'dam-conflict',lotId:'lot-a'
    });
    assert.equal(local.state.pending,1);
    assert.ok(await field.db.getRecord('cattle.animals','calf-conflict'));
    assert.ok(await field.db.getRecord('cattle.events','calf-conflict:birth'));

    const repos=createCattleRepositories(base.db);
    const dam=await repos.animals.get('dam-conflict');
    await repos.animals.remove('dam-conflict',{expectedVersion:dam.version});

    const outbound=await field.backend.fieldSync({auth:field.auth,operation:'exportBundle'});
    const imported=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.deepEqual(imported.operations,{applied:0,skipped:0,conflicts:1});
    assert.equal(await base.db.getRecord('cattle.animals','calf-conflict'),null);
    assert.equal(await base.db.getRecord('cattle.events','calf-conflict:birth'),null);

    const receiptBundle=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    const receipt=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:receiptBundle}});
    assert.equal(receipt.state.pending,0);
    assert.equal(receipt.state.acknowledged,0);
    assert.equal(receipt.state.conflicts,1);

    const replay=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.equal(replay.operations.applied,0);
    assert.ok(replay.operations.skipped>=1);
    assert.equal(await base.db.getRecord('cattle.animals','calf-conflict'),null);
    assert.equal(await base.db.getRecord('cattle.events','calf-conflict:birth'),null);
  }finally{await base.cleanup();await field.cleanup()}
});
