import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';

const EXPECTED_SNAPSHOT_COLLECTIONS=Object.freeze([
  'cattle.tasks',
  'cattle.animals',
  'cattle.lots',
  'cattle.sanitary-protocols',
  'cattle.inventory',
  'cattle.events',
  'cattle.traceability',
  'cattle.pastures',
  'cattle.pasture-occupancy',
  'cattle.breeding-seasons',
  'cattle.reproduction-genetics',
  'cattle.reproduction-dose-stock',
  'cattle.body-condition',
  'cattle.pasture-assessments',
  'cattle.pasture-rotation-plan'
]);
const LEGACY_SNAPSHOT_COLLECTIONS=EXPECTED_SNAPSHOT_COLLECTIONS.slice(0,5);

async function fixture(name){
  const dir=await mkdtemp(join(tmpdir(),`pecuaria-field-p1c-${name}-`));
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
  return configured.pairing;
}

const encode64=bytes=>{
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const decode64=value=>{
  const normalized=String(value).replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
};

async function encryptedBundle({
  key,
  sourceDeviceId='legacy-base-v1',
  createdAt='2026-09-20T12:00:00.000Z',
  expiresAt='2099-09-20T12:00:00.000Z',
  nonce='legacy-v1-nonce',
  snapshot=[],
  operations=[],
  receipts=[]
}){
  const metadata={
    format:'artisys-pecuaria-field-sync',
    version:1,
    productId:'agro-pecuaria',
    sourceDeviceId,
    createdAt,
    expiresAt,
    nonce
  };
  const iv=new Uint8Array(12);
  crypto.getRandomValues(iv);
  const aes=await crypto.subtle.importKey('raw',decode64(key),{name:'AES-GCM'},false,['encrypt']);
  const encoder=new TextEncoder();
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(metadata))},
    aes,
    encoder.encode(JSON.stringify({snapshot,operations,receipts}))
  ));
  return Object.freeze({...metadata,iv:encode64(iv),ciphertext:encode64(ciphertext)});
}

async function collectionCounts(db){
  const entries=await Promise.all(EXPECTED_SNAPSHOT_COLLECTIONS.map(async collection=>[collection,(await db.listRecords(collection)).length]));
  return Object.fromEntries(entries);
}

test('base snapshot synchronizes all 15 approved collections while public bundle exposes ciphertext only',async()=>{
  const base=await fixture('all-base'),field=await fixture('all-field');
  try{
    for(const [index,collection] of EXPECTED_SNAPSHOT_COLLECTIONS.entries()){
      const id=`snapshot-${index+1}`;
      await base.db.putRecord(collection,id,{id,marker:collection},{expectedVersion:0});
    }
    await pair(base,field);
    const bundle=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    assert.equal(bundle.version,1);
    assert.equal(bundle.snapshot,undefined);
    assert.equal(bundle.operations,undefined);
    assert.equal(bundle.receipts,undefined);
    assert.equal(typeof bundle.ciphertext,'string');
    assert.ok(bundle.ciphertext.length>50);

    const imported=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle}});
    assert.equal(imported.snapshot.applied,EXPECTED_SNAPSHOT_COLLECTIONS.length);
    for(const [index,collection] of EXPECTED_SNAPSHOT_COLLECTIONS.entries()){
      const record=await field.db.getRecord(collection,`snapshot-${index+1}`);
      assert.equal(record?.payload?.marker,collection,collection);
    }
  }finally{await base.cleanup();await field.cleanup()}
});

test('current importer accepts a valid version-1 bundle containing only the original five snapshot collections',async()=>{
  const base=await fixture('legacy-base'),field=await fixture('legacy-field');
  try{
    const pairing=await pair(base,field);
    const snapshot=LEGACY_SNAPSHOT_COLLECTIONS.map((collection,index)=>({
      collection,
      records:[{id:`legacy-${index+1}`,payload:{id:`legacy-${index+1}`,marker:collection},updatedAt:null}]
    }));
    const bundle=await encryptedBundle({key:pairing.key,snapshot});
    const imported=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle}});
    assert.equal(imported.snapshot.applied,5);
    for(const [index,collection] of LEGACY_SNAPSHOT_COLLECTIONS.entries()){
      assert.equal((await field.db.getRecord(collection,`legacy-${index+1}`))?.payload?.marker,collection);
    }
  }finally{await base.cleanup();await field.cleanup()}
});

test('pending local body condition prevents an older base snapshot from overwriting the touched observation',async()=>{
  const base=await fixture('conflict-base'),field=await fixture('conflict-field');
  try{
    await base.db.putRecord('cattle.animals','a1',{id:'a1',tag:'A001',farmUnitId:'farm-1',purpose:'beef',lotId:null,sex:'female',status:'active',weights:[],milkRecords:[],movements:[],lifecycle:[],metadata:{}},{expectedVersion:0});
    await pair(base,field);
    const initial=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:initial}});

    const quick=await field.backend.fieldSync({auth:field.auth,operation:'quick',input:{kind:'animal.bodyScore',input:{id:'score-a1',animalId:'a1',occurredAt:'2026-09-20T12:00:00.000Z',score:4}}});
    assert.equal(quick.state.pending,1);
    assert.equal((await field.db.getRecord('cattle.body-condition','score-a1'))?.payload?.score,4);

    await base.db.putRecord('cattle.body-condition','score-a1',{id:'score-a1',animalId:'a1',occurredAt:'2026-09-19T12:00:00.000Z',score:2,scaleId:'bcs',scaleMin:1,scaleMax:5,notes:null},{expectedVersion:0});
    const staleBundle=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    const imported=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:staleBundle}});

    assert.ok(imported.snapshot.skipped>=1);
    const preserved=await field.db.getRecord('cattle.body-condition','score-a1');
    assert.equal(preserved.payload.score,4);
    assert.equal(preserved.payload.occurredAt,'2026-09-20T12:00:00.000Z');
  }finally{await base.cleanup();await field.cleanup()}
});

test('expired authenticated bundle is rejected before snapshot or operation writes',async()=>{
  const base=await fixture('expired-base'),field=await fixture('expired-field');
  try{
    const pairing=await pair(base,field);
    const before=await collectionCounts(field.db);
    const bundle=await encryptedBundle({
      key:pairing.key,
      expiresAt:'2020-01-01T00:00:00.000Z',
      nonce:'expired-valid-bundle',
      snapshot:[{collection:'cattle.events',records:[{id:'must-not-write',payload:{id:'must-not-write'},updatedAt:null}]}],
      operations:[{id:'must-not-run',sourceDeviceId:'legacy-base-v1',kind:'task.complete',input:{id:'missing-task'},createdAt:'2020-01-01T00:00:00.000Z'}]
    });
    await assert.rejects(()=>field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle}}),/expired/i);
    assert.deepEqual(await collectionCounts(field.db),before);
    assert.equal(await field.db.getRecord('cattle.events','must-not-write'),null);
  }finally{await base.cleanup();await field.cleanup()}
});

test('tampered, wrong-key and arbitrary-collection bundles cannot mutate field data',async()=>{
  const base=await fixture('auth-base'),field=await fixture('auth-field');
  try{
    const pairing=await pair(base,field);
    await base.db.putRecord('cattle.events','safe-event',{id:'safe-event',kind:'reproduction',animalId:'a1',occurredAt:'2026-09-20T12:00:00.000Z'},{expectedVersion:0});
    const valid=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    const before=await collectionCounts(field.db);

    const tampered={...valid,ciphertext:`${valid.ciphertext.slice(0,-1)}${valid.ciphertext.endsWith('A')?'B':'A'}`};
    await assert.rejects(()=>field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:tampered}}),/invalid|unauthenticated|package/i);
    assert.deepEqual(await collectionCounts(field.db),before);

    const foreignKey=new Uint8Array(32);
    crypto.getRandomValues(foreignKey);
    const wrongKey=await encryptedBundle({key:encode64(foreignKey),nonce:'wrong-key',snapshot:[{collection:'cattle.events',records:[{id:'wrong-key-write',payload:{id:'wrong-key-write'},updatedAt:null}]}]});
    await assert.rejects(()=>field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:wrongKey}}),/invalid|unauthenticated|package/i);
    assert.deepEqual(await collectionCounts(field.db),before);

    const injected=await encryptedBundle({key:pairing.key,nonce:'arbitrary-collection',snapshot:[{collection:'evil.collection',records:[{id:'evil',payload:{id:'evil',value:'no'},updatedAt:null}]}]});
    const result=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:injected}});
    assert.equal(result.snapshot.applied,0);
    assert.equal(await field.db.getRecord('evil.collection','evil'),null);
  }finally{await base.cleanup();await field.cleanup()}
});
