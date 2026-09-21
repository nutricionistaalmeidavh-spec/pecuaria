import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-field-360-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const presentation=createCattlePresentation({persistence:db});
  const backend=createRpcBackend({presentation,persistence:db});
  await backend.bootstrap({username:'admin',password:'12345678'});
  const login=await backend.login({username:'admin',password:'12345678'});
  return{dir,db,backend,auth:{sessionId:login.session.id,token:login.token},async close(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('backend references exposes the approved local field snapshot data without adding a new RPC',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.lots','lot-1',{id:'lot-1',name:'Lote Campo',farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
    await f.db.putRecord('cattle.animals','a1',{id:'a1',tag:'A001',farmUnitId:'farm-1',purpose:'beef',lotId:'lot-1',sex:'female',status:'active',weights:[{weightKg:410,measuredAt:'2026-09-19T08:00:00.000Z'}],milkRecords:[],movements:[],lifecycle:[],metadata:{}},{expectedVersion:0});
    await f.db.putRecord('cattle.events','san-1',{id:'san-1',kind:'sanitary',animalId:'a1',protocolId:'proto-1',occurredAt:'2026-09-18T08:00:00.000Z'},{expectedVersion:0});
    await f.db.putRecord('cattle.events','repro-1',{id:'repro-1',kind:'reproduction',type:'pregnancy-check',animalId:'a1',occurredAt:'2026-09-17T08:00:00.000Z'},{expectedVersion:0});
    await f.db.putRecord('cattle.events','birth-a1',{id:'birth-a1',kind:'birth',type:'birth',animalId:'a1',occurredAt:'2024-09-17T08:00:00.000Z'},{expectedVersion:0});
    await f.db.putRecord('cattle.traceability','trace-1',{id:'trace-1',animalId:'a1',type:'identity',documentNumber:'DOC-A1',issuedAt:'2026-01-01T00:00:00.000Z',expiresAt:null,notes:null},{expectedVersion:0});
    await f.db.putRecord('cattle.body-condition','body-1',{id:'body-1',animalId:'a1',occurredAt:'2026-09-20T08:00:00.000Z',score:3.5,scaleId:'bovine-1-5',scaleMin:1,scaleMax:5,notes:null},{expectedVersion:0});
    await f.db.putRecord('cattle.tasks','task-1',{id:'task-1',title:'Revisar animal',dueAt:'2026-09-21T08:00:00.000Z',kind:'management',animalId:'a1',lotId:null,status:'pending',notes:null},{expectedVersion:0});
    await f.db.putRecord('cattle.pastures','p1',{id:'p1',name:'Piquete 1',farmUnitId:'farm-1',areaHa:10,capacityAu:20,status:'available'},{expectedVersion:0});
    await f.db.putRecord('cattle.pasture-occupancy','occ-1',{id:'occ-1',pastureId:'p1',lotId:'lot-1',enteredAt:'2026-09-20T08:00:00.000Z',leftAt:null,animalUnits:5,notes:null},{expectedVersion:0});
    await f.db.putRecord('cattle.pasture-assessments','pa-1',{id:'pa-1',pastureId:'p1',occurredAt:'2026-09-20T08:00:00.000Z',score:4,scaleMin:1,scaleMax:5,heightCm:30,forageMassKgHa:null,groundCoverPct:null,notes:null,photoPaths:[]},{expectedVersion:0});
    await f.db.putRecord('cattle.pasture-rotation-plan','rp-1',{id:'rp-1',pastureId:'p1',lotId:'lot-1',plannedEnterAt:'2026-09-21T08:00:00.000Z',plannedLeaveAt:'2026-09-24T08:00:00.000Z',status:'planned',notes:null},{expectedVersion:0});
    await f.db.putRecord('cattle.breeding-seasons','bs-1',{id:'bs-1',name:'Estacao 1',status:'active'},{expectedVersion:0});
    await f.db.putRecord('cattle.reproduction-genetics','gen-1',{id:'gen-1',name:'Touro 1',active:true},{expectedVersion:0});
    await f.db.putRecord('cattle.reproduction-dose-stock','dose-1',{id:'dose-1',geneticsId:'gen-1',quantity:10,active:true},{expectedVersion:0});

    const refs=await f.backend.references({auth:f.auth});
    assert.equal(refs.events.length,3);
    assert.equal(refs.traceability[0].documentNumber,'DOC-A1');
    assert.equal(refs.bodyCondition[0].score,3.5);
    assert.equal(refs.tasks[0].status,'pending');
    assert.equal(refs.pastureOccupancy[0].id,'occ-1');
    assert.equal(refs.pastureAssessments[0].score,4);
    assert.equal(refs.rotationPlans[0].id,'rp-1');
    assert.equal(refs.breedingSeasons[0].id,'bs-1');
    assert.equal(refs.reproductionGenetics[0].id,'gen-1');
    assert.equal(refs.reproductionDoseStock[0].id,'dose-1');
    assert.equal(refs.animals[0].latestWeightKg,410);
  }finally{await f.close()}
});

test('field workspace declares one touch-first switcher and every approved P1C focused section',async()=>{
  const [field,main,css]=await Promise.all([source('../web/field-mobile.jsx'),source('../web/main.jsx'),source('../web/field-mobile.css')]);
  const ids=[
    'field-operation-switcher','field-quick-reproduction','field-quick-birth','field-quick-lifecycle','field-quick-rfid',
    'field-quick-traceability','field-quick-batch','field-quick-pasture','field-quick-scores','field-animal360'
  ];
  for(const id of ids)assert.match(field,new RegExp(`data-testid=["']${id}["']`),id);
  for(const existing of ['field-task-queue','field-touch-keypad','field-quick-move','field-quick-sanitary','field-secure-sync'])assert.match(field,new RegExp(`data-testid=["']${existing}["']`),existing);
  assert.match(field,/activeOperation/);
  assert.match(main,/FieldMobileWorkspace[^\n]*fieldData=\{references\}/);
  assert.doesNotMatch(field,/\bfetch\s*\(/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*(auto|scroll)/);
  assert.match(css,/@media \(max-width: 720px\)/);
});

test('offline Animal 360 source renders identity, lot, weight, body score, histories, traceability and pending tasks from local props',async()=>{
  const field=await source('../web/field-mobile.jsx');
  for(const text of ['Animal 360º offline','Identificação','Lote atual','Último peso','Escore corporal','Sanidade','Reprodução','Nascimento','Rastreabilidade','Tarefas pendentes']){
    assert.match(field,new RegExp(text),text);
  }
  for(const collection of ['fieldData.events','fieldData.traceability','fieldData.bodyCondition','fieldData.tasks'])assert.match(field,new RegExp(collection.replace('.','\\.')),collection);
  assert.match(field,/weights\?\.at\(-1\)/);
  assert.match(field,/status\s*!==\s*['"]completed['"]/);
});
