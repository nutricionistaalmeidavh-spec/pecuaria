import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFile(join(root,path),'utf8');
const write=(path,content)=>writeFile(join(root,path),content,'utf8');

const replaceOnce=(text,from,to,label)=>{
  if(!text.includes(from))throw new Error(`Missing P1D patch marker: ${label}`);
  return text.replace(from,to);
};

async function fixTask1Assertion(){
  const path='tests/product-actions.test.js';
  let text=await read(path);
  const old="    const finance=await host.presentation.services.financeAdmin.snapshot({asOf:'2026-09-21T00:00:00Z'});";
  if(text.includes(old))text=replaceOnce(text,old,"    const finance=(await host.presentation.load('finance')).admin;",'finance admin public surface');
  await write(path,text);
}

async function writeBackwardCompatibility(){
  const path='tests/p1-backward-compatibility.test.js';
  const content=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {mkdtemp,rm} from 'node:fs/promises';\nimport {tmpdir} from 'node:os';\nimport {join} from 'node:path';\nimport {createStandaloneHost} from '../runtime/host.mjs';\n\ntest('P1 loads P0-shaped local data without destructive backfill or false zero measurements',async()=>{\n  const root=await mkdtemp(join(tmpdir(),'pecuaria-p1-compat-'));\n  let host;\n  try{\n    host=await createStandaloneHost({dataDir:root});\n    await host.persistence.putRecord('cattle.lots','legacy-lot',{id:'legacy-lot',name:'Lote legado',farmUnitId:'legacy-farm'},{expectedVersion:0});\n    await host.persistence.putRecord('cattle.animals','legacy-animal',{id:'legacy-animal',tag:'LEG-001',farmUnitId:'legacy-farm',lotId:'legacy-lot',status:'active',weights:[],movements:[],lifecycle:[]},{expectedVersion:0});\n    await host.persistence.putRecord('cattle.finance','legacy-finance',{id:'legacy-finance',kind:'cost',amountMinor:12500,lotId:'legacy-lot',description:'Custo produtivo legado'},{expectedVersion:0});\n    await host.persistence.putRecord('cattle.pastures','legacy-pasture',{id:'legacy-pasture',name:'Pasto legado',farmUnitId:'legacy-farm',areaHa:10,status:'active',forage:'Brachiaria'},{expectedVersion:0});\n    await host.persistence.putRecord('cattle.tasks','legacy-task',{id:'legacy-task',title:'Tarefa legada',dueAt:'2026-09-22T10:00:00.000Z',kind:'management',animalId:'legacy-animal',lotId:'legacy-lot',status:'pending'},{expectedVersion:0});\n\n    const [finance,pastures,animals,tasks]=await Promise.all([\n      host.presentation.load('finance'),\n      host.presentation.load('pastures'),\n      host.presentation.load('animals',{animalId:'legacy-animal'}),\n      host.presentation.load('tasks')\n    ]);\n\n    assert.equal(finance.rows.length,1);\n    assert.equal(finance.rows[0].payload.id,'legacy-finance');\n    assert.deepEqual(finance.admin.titles,[]);\n    assert.deepEqual(finance.admin.settlements,[]);\n    assert.equal(finance.admin.projection.realized.netMinor,0);\n    assert.equal(finance.admin.projection.forecast.days7.netMinor,0);\n\n    assert.equal(pastures.rows[0].payload.status,'active','legacy row must not be rewritten on load');\n    const managed=pastures.management.pastures.find(item=>item.id==='legacy-pasture');\n    assert.equal(managed.status,'available');\n    assert.equal(managed.operationalStatus,'available');\n    assert.equal(managed.latestAssessment,null);\n    assert.equal(managed.restDays,null);\n    assert.deepEqual(pastures.management.assessments,[]);\n    assert.deepEqual(pastures.management.bodyCondition,[]);\n    assert.deepEqual(pastures.management.rotationPlans,[]);\n\n    assert.equal(animals.detail.animal.id,'legacy-animal');\n    assert.ok(Array.isArray(animals.detail.timeline));\n    assert.equal(tasks.rows[0].payload.id,'legacy-task');\n\n    const storedPasture=await host.persistence.getRecord('cattle.pastures','legacy-pasture');\n    assert.equal(storedPasture.payload.status,'active','derived compatibility must not persist a migration on read');\n    assert.equal((await host.persistence.listRecords('cattle.finance-titles')).length,0);\n    assert.equal((await host.persistence.listRecords('cattle.pasture-assessments')).length,0);\n    assert.equal((await host.persistence.listRecords('cattle.body-condition')).length,0);\n    assert.equal((await host.persistence.listRecords('cattle.pasture-rotation-plan')).length,0);\n\n    await host.recovery.createBackup({id:'legacy-compatible'});\n    await host.persistence.putRecord('cattle.pastures','legacy-pasture',{...storedPasture.payload,name:'Mudança temporária'},{expectedVersion:storedPasture.version});\n    await host.recovery.restoreBackup('legacy-compatible');\n    const restored=await host.persistence.getRecord('cattle.pastures','legacy-pasture');\n    assert.equal(restored.payload.name,'Pasto legado');\n    assert.equal(restored.payload.status,'active');\n  }finally{\n    await host?.close();\n    await rm(root,{recursive:true,force:true});\n  }\n});\n`;
  await write(path,content);
}

async function enforceFieldDestinationPermissions(){
  const path='runtime/backend.mjs';
  let text=await read(path);
  const quickOld="        const prepared=await fieldSynchronization.prepareQuick({...input,actorId:authorized.user.id});\n        try{";
  const quickNew="        const prepared=await fieldSynchronization.prepareQuick({...input,actorId:authorized.user.id});\n        await session(auth,permission(prepared.command.screenId,'write',prepared.command.action));\n        try{";
  if(text.includes(quickOld))text=replaceOnce(text,quickOld,quickNew,'field quick destination permission');

  const importOld="        const result=await fieldSynchronization.importBundle(input.bundle,{apply:command=>presentation.action(command.screenId,command.action,command.input,{actorId:authorized.user.id,fieldSync:true})});";
  const importNew="        const result=await fieldSynchronization.importBundle(input.bundle,{apply:async command=>{await session(auth,permission(command.screenId,'write',command.action));return presentation.action(command.screenId,command.action,command.input,{actorId:authorized.user.id,fieldSync:true});}});";
  if(text.includes(importOld))text=replaceOnce(text,importOld,importNew,'field import destination permission');
  await write(path,text);
}

async function fixPasturePolygonNormalization(){
  const path='web/action-config.js';
  let text=await read(path);
  const old="polygon:String(v.polygon??'').split(/\\n+/).map(s=>s.trim()).filter(Boolean).map((line,index)=>{const parts=line.split(/[;, ]+/).filter(Boolean);if(parts.length!==2||!parts.every(part=>Number.isFinite(Number(part))))throw new TypeError(`Ponto ${index+1} inválido. Use x,y.`);return{x:Number(parts[0]),y:Number(parts[1])}})";
  const replacement="polygon:(()=>{const lines=String(v.polygon??'').split(/\\n+/).map(s=>s.trim()).filter(Boolean);if(!lines.length)return null;return lines.map((line,index)=>{const parts=line.split(/[;, ]+/).filter(Boolean);if(parts.length!==2||!parts.every(part=>Number.isFinite(Number(part))))throw new TypeError(`Ponto ${index+1} inválido. Use x,y.`);return{x:Number(parts[0]),y:Number(parts[1])}})})()";
  if(text.includes(old))text=replaceOnce(text,old,replacement,'empty pasture polygon normalization');
  await write(path,text);
}

async function fixIntegratedE2ESelectors(){
  const path='tests/e2e/p1-operational-depth.spec.mjs';
  let text=await read(path);
  if(text.includes("page.getByTestId('field-sync')"))text=replaceOnce(text,"page.getByTestId('field-sync')","page.getByTestId('field-secure-sync')",'field secure sync test id');
  await write(path,text);
}

await fixTask1Assertion();
await writeBackwardCompatibility();
await enforceFieldDestinationPermissions();
await fixPasturePolygonNormalization();
await fixIntegratedE2ESelectors();
console.log('[PASS] P1D compatibility, RBAC and browser integration patches applied');
