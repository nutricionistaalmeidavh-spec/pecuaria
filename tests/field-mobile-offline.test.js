import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';

async function fixture(name){
  const dir=await mkdtemp(join(tmpdir(),`pecuaria-field-${name}-`));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const presentation=createCattlePresentation({persistence:db});
  const backend=createRpcBackend({presentation,persistence:db});
  await backend.bootstrap({username:'admin',password:'12345678'});
  const login=await backend.login({username:'admin',password:'12345678'});
  return{dir,db,presentation,backend,auth:{sessionId:login.session.id,token:login.token},async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seedBase(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Curral 1',farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
  await db.putRecord('cattle.lots','l2',{id:'l2',name:'Pasto 2',farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
  await db.putRecord('cattle.animals','a1',{id:'a1',tag:'A001',farmUnitId:'farm-1',purpose:'beef',lotId:'l1',sex:'female',status:'active',weights:[],milkRecords:[],movements:[],lifecycle:[],metadata:{}},{expectedVersion:0});
  await db.putRecord('cattle.tasks','task-1',{id:'task-1',title:'Conferir lote',dueAt:'2026-09-20T15:00:00.000Z',kind:'management',animalId:'a1',lotId:null,status:'pending',notes:null},{expectedVersion:0});
  await db.putRecord('cattle.sanitary-protocols','prot-1',{id:'prot-1',name:'Protocolo campo',productItemId:'med-1',dose:1,unit:'dose',intervalDays:30,withdrawalDays:0,activeIngredient:'teste'},{expectedVersion:0});
}

const clone=value=>JSON.parse(JSON.stringify(value));

test('field device receives encrypted local snapshot, queues touch operations and synchronizes them idempotently',async()=>{
  const base=await fixture('base'),field=await fixture('field');
  try{
    await seedBase(base.db);
    const baseSetup=await base.backend.fieldSync({auth:base.auth,operation:'configure',input:{role:'base',deviceName:'Escritorio'}});
    assert.equal(baseSetup.state.role,'base');
    assert.equal(baseSetup.pairing.format,'artisys-pecuaria-field-pairing');
    assert.ok(baseSetup.pairing.key.length>=40);

    const fieldSetup=await field.backend.fieldSync({auth:field.auth,operation:'configure',input:{role:'field',deviceName:'Curral celular',pairing:baseSetup.pairing}});
    assert.equal(fieldSetup.state.role,'field');
    assert.equal(fieldSetup.state.paired,true);

    const baseBundle=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    assert.equal(baseBundle.format,'artisys-pecuaria-field-sync');
    assert.ok(baseBundle.ciphertext.length>50);
    assert.equal(baseBundle.snapshot,undefined,'snapshot must remain encrypted');

    const imported=await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:baseBundle}});
    assert.equal(imported.snapshot.applied>0,true);
    assert.equal((await field.db.getRecord('cattle.tasks','task-1')).payload.status,'pending');
    assert.equal((await field.db.getRecord('cattle.animals','a1')).payload.tag,'A001');

    await field.backend.fieldSync({auth:field.auth,operation:'quick',input:{kind:'task.complete',input:{id:'task-1'}}});
    await field.backend.fieldSync({auth:field.auth,operation:'quick',input:{kind:'weight.record',input:{id:'a1',weightKg:418.5,measuredAt:'2026-09-20T15:10:00.000Z'}}});
    await field.backend.fieldSync({auth:field.auth,operation:'quick',input:{kind:'animal.move',input:{id:'a1',toLotId:'l2',movedAt:'2026-09-20T15:15:00.000Z'}}});
    const fieldState=await field.backend.fieldSync({auth:field.auth,operation:'state'});
    assert.equal(fieldState.pending,3);
    assert.equal((await field.db.getRecord('cattle.tasks','task-1')).payload.status,'completed');
    assert.equal((await field.db.getRecord('cattle.animals','a1')).payload.lotId,'l2');

    const fieldBundle=await field.backend.fieldSync({auth:field.auth,operation:'exportBundle'});
    const firstImport=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:fieldBundle}});
    assert.equal(firstImport.operations.applied,3);
    assert.equal((await base.db.getRecord('cattle.tasks','task-1')).payload.status,'completed');
    const animal=(await base.db.getRecord('cattle.animals','a1')).payload;
    assert.equal(animal.lotId,'l2');
    assert.equal(animal.weights.at(-1).weightKg,418.5);

    const secondImport=await base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:fieldBundle}});
    assert.equal(secondImport.operations.applied,0);
    assert.equal(secondImport.operations.skipped,3);
    assert.equal((await base.db.getRecord('cattle.animals','a1')).payload.weights.length,1,'replay must not duplicate weight');

    const acknowledgement=await base.backend.fieldSync({auth:base.auth,operation:'exportBundle'});
    await field.backend.fieldSync({auth:field.auth,operation:'importBundle',input:{bundle:acknowledgement}});
    const acknowledgedState=await field.backend.fieldSync({auth:field.auth,operation:'state'});
    assert.equal(acknowledgedState.pending,0);
    assert.equal(acknowledgedState.acknowledged>=3,true);

    const tampered=clone(fieldBundle);
    tampered.ciphertext=`${tampered.ciphertext.slice(0,-1)}${tampered.ciphertext.endsWith('A')?'B':'A'}`;
    await assert.rejects(()=>base.backend.fieldSync({auth:base.auth,operation:'importBundle',input:{bundle:tampered}}),/invalid|decrypt|authentic|package/i);
  }finally{await base.cleanup();await field.cleanup()}
});

test('field mobile UI is touch-first, keyboardless for core handling and exposes secure package sync',async()=>{
  const [panel,main,styles,index,manifest,worker,backend,electron,preload]=await Promise.all([
    readFile(new URL('../web/field-mobile.jsx',import.meta.url),'utf8').catch(()=>''),
    readFile(new URL('../web/main.jsx',import.meta.url),'utf8'),
    readFile(new URL('../web/styles.css',import.meta.url),'utf8'),
    readFile(new URL('../web/index.html',import.meta.url),'utf8'),
    readFile(new URL('../web/public/manifest.webmanifest',import.meta.url),'utf8').catch(()=>''),
    readFile(new URL('../web/public/field-sw.js',import.meta.url),'utf8').catch(()=>''),
    readFile(new URL('../runtime/backend.mjs',import.meta.url),'utf8'),
    readFile(new URL('../electron/main.mjs',import.meta.url),'utf8'),
    readFile(new URL('../electron/preload.cjs',import.meta.url),'utf8')
  ]);
  const combined=[panel,main,styles,index,manifest,worker,backend,electron,preload].join('\n');
  for(const id of ['field-mobile-workspace','field-task-queue','field-touch-keypad','field-quick-move','field-quick-sanitary','field-secure-sync'])assert.match(combined,new RegExp(id));
  for(const label of ['Fila de manejo','Teclado de peso','Mover animal','Aplicar protocolo','Pacote local criptografado','Importar pacote','Exportar pacote'])assert.match(combined,new RegExp(label));
  assert.match(combined,/fieldSync/);
  assert.match(index,/manifest\.webmanifest/);
  assert.match(index,/serviceWorker/);
  assert.match(worker,/caches\.open/);
  assert.match(manifest,/standalone/);
  assert.match(styles,/@media\s*\(max-width:\s*720px\)/);
});
