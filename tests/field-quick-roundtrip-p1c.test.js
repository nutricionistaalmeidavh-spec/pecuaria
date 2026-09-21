import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';

async function fixture(name){
  const dir=await mkdtemp(join(tmpdir(),`pecuaria-field-roundtrip-${name}-`));
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
}

async function fieldOperatorAuth(f,{id='field-user',username='campo'}={}){
  const security=f.presentation.services.security;
  await security.createUser({...f.auth,user:{id,username,password:'abcdefgh',roles:['field-operator'],active:true}});
  const login=await security.authenticate({username,password:'abcdefgh'});
  return{sessionId:login.session.id,token:login.token};
}

async function seedAnimal(db,id='a1'){
  await db.putRecord('cattle.animals',id,{id,tag:id.toUpperCase(),farmUnitId:'farm-1',purpose:'beef',lotId:null,sex:'female',status:'active',weights:[],milkRecords:[],movements:[],lifecycle:[],metadata:{}},{expectedVersion:0});
}

test('field operator receives only granular RFID bind permission, never IoT administration',async()=>{
  assert.equal(SECURITY_POLICY['field-operator'].includes('iot:bind'),true);
  assert.equal(SECURITY_POLICY['field-operator'].includes('iot:read'),false);
  assert.equal(SECURITY_POLICY['field-operator'].includes('iot:write'),false);
  assert.equal(SECURITY_POLICY.manager.includes('iot:bind'),true);
  assert.equal(PRESENTATION_ACCESS.screens.iot.actions.bindRfid,'iot:bind');
  assert.equal(PRESENTATION_ACCESS.screens.iot.actions.unbindRfid,'iot:bind');

  const f=await fixture('permission');
  try{
    await seedAnimal(f.db);
    const auth=await fieldOperatorAuth(f);
    const bound=await f.backend.action({screenId:'iot',action:'bindRfid',input:{tagId:'982000411823945',animalId:'a1'},auth});
    assert.deepEqual(bound,{tagId:'982000411823945',animalId:'a1'});
    await assert.rejects(
      ()=>f.backend.action({screenId:'iot',action:'saveDevice',input:{id:'forbidden-device',name:'Nao pode',profileId:'simulator-rfid',stationId:'curral-1',enabled:false,config:{}},auth}),
      /permission denied: iot:write/
    );
  }finally{await f.cleanup()}
});

test('RFID field quick roundtrip applies once, reimport skips by receipt and acknowledgement clears pending queue',async()=>{
  const base=await fixture('rfid-base'),field=await fixture('rfid-field');
  try{
    await seedAnimal(base.db);
    await pair(base,field);
    const initial=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:initial}});
    const auth=await fieldOperatorAuth(field,{id:'field-rfid',username:'campo-rfid'});

    const quick=await field.backend.fieldSync({auth,operation:'quick',input:{kind:'rfid.bind',input:{tagId:'982000411823945',animalId:'a1'}}});
    assert.equal(quick.state.pending,1);
    assert.deepEqual((await field.db.getRecord('iot.rfid-bindings','rfid:982000411823945'))?.payload,{tagId:'982000411823945',animalId:'a1'});

    const outbound=await field.backend.fieldSync({auth,operation:'exportBundle'});
    const first=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.equal(first.operations.applied,1);
    assert.deepEqual((await base.db.getRecord('iot.rfid-bindings','rfid:982000411823945'))?.payload,{tagId:'982000411823945',animalId:'a1'});

    const duplicate=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:outbound}});
    assert.equal(duplicate.operations.applied,0);
    assert.ok(duplicate.operations.skipped>=1);
    assert.equal((await base.db.listRecords('iot.rfid-bindings')).length,1);

    const acknowledgement=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    const received=await field.backend.fieldSync({auth,operation:'importBundle',input:{bundle:acknowledgement}});
    assert.equal(received.state.pending,0);
    assert.equal(received.state.acknowledged,1);
  }finally{await base.cleanup();await field.cleanup()}
});

test('batch reproduction and sanitary event ids are deterministic from idPrefix, animal and stable index',async()=>{
  const f=await fixture('batch-ids');
  try{
    await seedAnimal(f.db,'a1');
    await seedAnimal(f.db,'a2');
    await f.db.putRecord('cattle.sanitary-protocols','proto-1',{id:'proto-1',name:'Protocolo campo',productItemId:'med-1',dose:1,unit:'ml',intervalDays:null,withdrawalDays:null,activeIngredient:null},{expectedVersion:0});

    const reproduction=await f.presentation.action('reproduction','batchRecord',{
      idPrefix:'field-repro-op-1',animalIds:['a1','a2'],type:'weaning',occurredAt:'2026-09-20T12:00:00.000Z'
    },{actorId:'admin'});
    assert.deepEqual(reproduction.map(record=>record.id),['field-repro-op-1-a1-0','field-repro-op-1-a2-1']);

    const sanitary=await f.presentation.action('sanitary','batchRecord',{
      idPrefix:'field-san-op-1',animalIds:['a1','a2'],protocolId:'proto-1',occurredAt:'2026-09-20T12:00:00.000Z'
    },{actorId:'admin'});
    assert.deepEqual(sanitary.map(record=>record.id),['field-san-op-1-a1-0','field-san-op-1-a2-1']);
  }finally{await f.cleanup()}
});
