import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contractDigest,projectProductContract} from './api-contract-gate.mjs';

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

async function moveBodyConditionOwnership(){
  const handler="recordBodyCondition:audited('cattle.body-condition.record','body-condition',input=>pastureManagement.recordBodyCondition(input))";
  {
    const path='src/presentation.js';
    let text=await read(path);
    const animalsStart=text.indexOf('    animals:{');
    const animalsEnd=text.indexOf('\n    weights:',animalsStart);
    if(animalsStart<0||animalsEnd<0)throw new Error('Missing animals presentation block');
    let animals=text.slice(animalsStart,animalsEnd);
    if(!animals.includes(handler)){
      const close=animals.lastIndexOf('}}');
      if(close<0)throw new Error('Missing animals action close marker');
      animals=`${animals.slice(0,close)},${handler}${animals.slice(close)}`;
      text=`${text.slice(0,animalsStart)}${animals}${text.slice(animalsEnd)}`;
    }
    const pastureStart=text.indexOf('    pastures:{');
    const pastureEnd=text.indexOf('\n    nutrition:',pastureStart);
    if(pastureStart<0||pastureEnd<0)throw new Error('Missing pasture presentation block');
    let pasture=text.slice(pastureStart,pastureEnd);
    if(pasture.includes(handler)){
      pasture=pasture.replace(`${handler},`,'');
      text=`${text.slice(0,pastureStart)}${pasture}${text.slice(pastureEnd)}`;
    }
    await write(path,text);
  }

  {
    const path='web/action-config.js';
    let text=await read(path);
    const bodyLine="    recordBodyCondition:form('Registrar escore corporal',[field('id','ID da observação'),field('animalId','Animal','text',{refCollection:'animals'}),field('occurredAt','Data/hora','datetime-local'),field('score','Escore corporal','number',{step:'0.1'}),field('scaleId','Escala'),field('scaleMin','Escala mínima','number',{step:'0.1'}),field('scaleMax','Escala máxima','number',{step:'0.1'}),field('notes','Observações','textarea')],v=>({id:clean(v.id),animalId:clean(v.animalId),occurredAt:dateTime(v.occurredAt),score:num(v.score),scaleId:clean(v.scaleId)||undefined,scaleMin:v.scaleMin===''?undefined:num(v.scaleMin),scaleMax:v.scaleMax===''?undefined:num(v.scaleMax),notes:clean(v.notes)||null})),";
    const animalsStart=text.indexOf('  animals:Object.freeze({');
    const animalsEnd=text.indexOf('\n  weights:Object.freeze',animalsStart);
    if(animalsStart<0||animalsEnd<0)throw new Error('Missing animals form block');
    let animals=text.slice(animalsStart,animalsEnd);
    if(!animals.includes('recordBodyCondition:form(')){
      const close=animals.lastIndexOf('\n  })');
      if(close<0)throw new Error('Missing animals form close marker');
      animals=`${animals.slice(0,close)},\n${bodyLine}${animals.slice(close)}`;
      text=`${text.slice(0,animalsStart)}${animals}${text.slice(animalsEnd)}`;
    }
    const pastureStart=text.indexOf('  pastures:Object.freeze({');
    const pastureEnd=text.indexOf('\n  nutrition:Object.freeze',pastureStart);
    if(pastureStart<0||pastureEnd<0)throw new Error('Missing pasture form block');
    let pasture=text.slice(pastureStart,pastureEnd);
    if(pasture.includes(bodyLine)){
      pasture=pasture.replace(`${bodyLine}\n`,'');
      text=`${text.slice(0,pastureStart)}${pasture}${text.slice(pastureEnd)}`;
    }
    await write(path,text);
  }

  {
    const path='src/field-sync.js';
    let text=await read(path);
    const old="if(kind==='animal.bodyScore')return command('pastures','recordBodyCondition',{";
    const replacement="if(kind==='animal.bodyScore')return command('animals','recordBodyCondition',{";
    if(text.includes(old))text=replaceOnce(text,old,replacement,'body score field route');
    await write(path,text);
  }
}

async function freezeFinalContracts(){
  const productPath='qa/product-contract.json';
  const apiPath='qa/api-contract.json';
  const baselinePath='qa/api-contract.baseline.json';
  const product=JSON.parse(await read(productPath));
  product.actions.animals=['save','recordMilk','move','lifecycle','batchMove','batchLifecycle','recordBodyCondition','registerBirth'];
  product.actions.pastures=['save','enterLot','leaveLot','recordAssessment','saveRotationPlan'];
  const projected=projectProductContract(product);
  await write(productPath,`${JSON.stringify(product,null,2)}\n`);
  await write(apiPath,`${JSON.stringify(projected,null,2)}\n`);
  await write(baselinePath,`${JSON.stringify({schemaVersion:1,sha256:contractDigest(projected)},null,2)}\n`);
}

async function updateOwnershipTestsAndE2E(){
  {
    const path='tests/product-actions.test.js';
    let text=await read(path);
    text=text.replaceAll("'pastures.recordBodyCondition'","'animals.recordBodyCondition'");
    text=text.replaceAll("run('pastures','recordBodyCondition'","run('animals','recordBodyCondition'");
    await write(path,text);
  }
  {
    const path='tests/field-quick-contract-p1c.test.js';
    let text=await read(path);
    const old="['animal.bodyScore',{animalId:'animal-1',occurredAt:at,score:3.5},'pastures','recordBodyCondition']";
    if(text.includes(old))text=replaceOnce(text,old,"['animal.bodyScore',{animalId:'animal-1',occurredAt:at,score:3.5},'animals','recordBodyCondition']",'field quick body-score ownership');
    await write(path,text);
  }
  {
    const path='tests/pasture-p1b-integration.test.js';
    let text=await read(path);
    text=text.replace("test('pasture presentation exposes six operational actions through the transactional service'","test('pasture presentation exposes five pasture actions and canonical animal body condition'" );
    text=text.replace("assert.deepEqual(actions,['save','enterLot','leaveLot','recordAssessment','recordBodyCondition','saveRotationPlan']);","assert.deepEqual(actions,['save','enterLot','leaveLot','recordAssessment','saveRotationPlan']);");
    text=text.replace("f.presentation.action('pastures','recordBodyCondition'","f.presentation.action('animals','recordBodyCondition'");
    await write(path,text);
  }
  {
    const path='tests/e2e/p1b-pasture-management.spec.mjs';
    let text=await read(path);
    text=text.replace("const actions=['save','enterLot','leaveLot','recordAssessment','recordBodyCondition','saveRotationPlan'];","const actions=['save','enterLot','leaveLot','recordAssessment','saveRotationPlan'];");
    await write(path,text);
  }
  {
    const path='tests/p1c-contract-surface.test.js';
    let text=await read(path);
    text=text.replace("assert.deepEqual(product.actions.animals,['save','registerBirth','recordMilk','move','lifecycle','batchMove','batchLifecycle']);","assert.deepEqual(product.actions.animals,['save','recordMilk','move','lifecycle','batchMove','batchLifecycle','recordBodyCondition','registerBirth']);\n  assert.deepEqual(product.actions.pastures,['save','enterLot','leaveLot','recordAssessment','saveRotationPlan']);\n  assert.equal(actionFormKeys().includes('animals.recordBodyCondition'),true);");
    await write(path,text);
  }
  {
    const path='tests/e2e/p1-operational-depth.spec.mjs';
    let text=await read(path);
    const marker="  await expect(page.getByTestId('data-table')).toContainText('BIRTH-INT');\n\n  await page.getByTestId('nav-tasks').click();";
    const replacement="  await expect(page.getByTestId('data-table')).toContainText('BIRTH-INT');\n\n  await openAction(page,'animals','recordBodyCondition');\n  for(const [name,value] of Object.entries({id:'body-int',animalId:'calf-int',occurredAt:'2026-09-21T08:00',score:'3.5'}))await fill(page,name,value);\n  await submit(page);\n\n  await page.getByTestId('nav-tasks').click();";
    if(text.includes(marker))text=replaceOnce(text,marker,replacement,'integrated animal body-score journey');
    await write(path,text);
  }
}

async function freezeFinalP2Gate(){
  const path='tests/p2-gates.test.js';
  let text=await read(path);
  if(!text.includes("from 'node:fs/promises'"))text="import {readFile} from 'node:fs/promises';\n"+text;
  text=text.replace("import {canonicalJson,contractDigest,validateContractSnapshot} from '../tooling/api-contract-gate.mjs';","import {canonicalJson,contractDigest,projectProductContract,validateContractSnapshot} from '../tooling/api-contract-gate.mjs';");
  if(!text.includes("final P1 contract projection is frozen at 17/62/17")){
    const marker="test('security gate uses cmd.exe for npm audit on Windows instead of spawning npm.cmd directly'";
    const testBlock=`test('final P1 contract projection is frozen at 17/62/17',async()=>{\n  const [product,declared,baseline]=await Promise.all([\n    readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8').then(JSON.parse),\n    readFile(new URL('../qa/api-contract.json',import.meta.url),'utf8').then(JSON.parse),\n    readFile(new URL('../qa/api-contract.baseline.json',import.meta.url),'utf8').then(JSON.parse)\n  ]);\n  const current=projectProductContract(product);\n  assert.equal(current.screens.length,17);\n  assert.equal(Object.values(current.actions).flat().length,62);\n  assert.equal(current.rpcMethods.length,17);\n  assert.deepEqual(declared,current);\n  assert.equal(contractDigest(current),baseline.sha256);\n  assert.equal(validateContractSnapshot({declared,current,baseline}),true);\n});\n\n`;
    if(!text.includes(marker))throw new Error('Missing P2 gate insertion marker');
    text=text.replace(marker,testBlock+marker);
  }
  await write(path,text);
}

await fixTask1Assertion();
await writeBackwardCompatibility();
await enforceFieldDestinationPermissions();
await fixPasturePolygonNormalization();
await fixIntegratedE2ESelectors();
await moveBodyConditionOwnership();
await freezeFinalContracts();
await updateOwnershipTestsAndE2E();
await freezeFinalP2Gate();
console.log('[PASS] P1D integration, final ownership and contract patches applied');
