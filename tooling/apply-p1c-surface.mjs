import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contractDigest,projectProductContract} from './api-contract-gate.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFile(join(root,path),'utf8');
const write=(path,content)=>writeFile(join(root,path),content,'utf8');
const writeJson=(path,value)=>write(path,`${JSON.stringify(value,null,2)}\n`);
const replaceOnce=(text,from,to,label)=>{
  if(!text.includes(from))throw new Error(`Missing patch marker: ${label}`);
  return text.replace(from,to);
};

async function patchActionConfig(){
  const path='web/action-config.js';
  let text=await read(path);
  if(text.includes("registerBirth:form('Registrar nascimento'"))return;
  const lines=text.split('\n');
  const animals=lines.findIndex(line=>line==='  animals:Object.freeze({');
  const save=lines.findIndex((line,index)=>index>animals&&line.startsWith("    save:form('Salvar animal'"));
  if(animals<0||save<0)throw new Error('Animals action form block not found');
  lines.splice(save+1,0,"    registerBirth:form('Registrar nascimento',[field('id','ID do bezerro'),field('tag','Brinco/identificação'),field('farmUnitId','Unidade/Fazenda','text',{refCollection:'farms'}),field('birthDate','Nascimento','datetime-local'),field('sex','Sexo','select',{options:[['female','Fêmea'],['male','Macho'],['unknown','Não informado']]}),field('damId','Mãe','text',{refCollection:'animals'}),field('sireId','Pai','text',{refCollection:'animals'}),field('lotId','Lote','text',{refCollection:'lots'}),field('breedId','Raça','text',{refCollection:'breeds'}),field('categoryId','Categoria','text',{refCollection:'categories'}),field('rfid','RFID/EID'),field('notes','Observações','textarea')],v=>({id:clean(v.id),tag:clean(v.tag),farmUnitId:clean(v.farmUnitId),birthDate:dateTime(v.birthDate),sex:clean(v.sex),damId:clean(v.damId)||null,sireId:clean(v.sireId)||null,lotId:clean(v.lotId)||null,breedId:clean(v.breedId)||null,categoryId:clean(v.categoryId)||null,rfid:clean(v.rfid)||null,notes:clean(v.notes)||null})),");
  await write(path,lines.join('\n'));
}

async function patchContracts(){
  const productPath='qa/product-contract.json';
  const product=JSON.parse(await read(productPath));
  const animals=product.actions.animals;
  if(!animals.includes('registerBirth'))animals.splice(animals.indexOf('save')+1,0,'registerBirth');
  await writeJson(productPath,product);
  const api=projectProductContract(product);
  await writeJson('qa/api-contract.json',api);
  await writeJson('qa/api-contract.baseline.json',{schemaVersion:1,sha256:contractDigest(api)});
}

async function patchProductActions(){
  const path='tests/product-actions.test.js';
  let text=await read(path);
  text=replaceOnce(text,
    "  'animals.save','animals.recordMilk','animals.move','animals.lifecycle','animals.batchMove','animals.batchLifecycle',",
    "  'animals.save','animals.registerBirth','animals.recordMilk','animals.move','animals.lifecycle','animals.batchMove','animals.batchLifecycle',",
    'product action execution order');
  text=replaceOnce(text,
    "      'animals.save':()=>run('animals','save',createAnimal({id:'animal-action',tag:'ACTION-QA',farmUnitId:'farm-1',lotId:'lot-main',purpose:'dairy'})),\n      'animals.recordMilk':",
    "      'animals.save':()=>run('animals','save',createAnimal({id:'animal-action',tag:'ACTION-QA',farmUnitId:'farm-1',lotId:'lot-main',purpose:'dairy'})),\n      'animals.registerBirth':()=>run('animals','registerBirth',{id:'animal-birth',tag:'BIRTH-QA',farmUnitId:'farm-1',birthDate:'2026-09-19T14:40:00Z',sex:'female',damId:'animal-repro',lotId:'lot-main',notes:'qa birth'}),\n      'animals.recordMilk':",
    'registerBirth executable scenario');
  text=text.replace("test('scenario registry exactly matches and executes all 61 contracted actions'","test('scenario registry exactly matches and executes all 62 contracted actions'");
  text=text.replace('assert.equal(expectedActions.length,61);','assert.equal(expectedActions.length,62);');
  await write(path,text);
}

async function patchLegacyCounts(){
  for(const path of ['tests/p0-ui-contract-coverage.test.js','tests/web-action-config.test.js']){
    let text=await read(path);
    text=text.replaceAll('61-action','62-action').replaceAll('61 contracted actions','62 contracted actions');
    text=text.replaceAll('length,61','length,62').replaceAll('flat().length,61','flat().length,62');
    await write(path,text);
  }
}

async function writeP1cE2E(){
  const path='tests/e2e/p1c-field-offline.spec.mjs';
  const content=`import {test,expect} from '@playwright/test';\n\nconst password='P1-E2E-2026!';\nasync function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}\n\ntest('P1C field workspace exposes focused offline operations and Animal 360 without raw JSON',async({page})=>{\n  await login(page);\n  await page.getByTestId('nav-tasks').click();\n  await expect(page.getByTestId('field-mobile-workspace')).toBeVisible();\n  await expect(page.getByTestId('field-operation-switcher')).toBeVisible();\n  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);\n\n  const sections=[\n    ['Reprodução','field-quick-reproduction'],\n    ['Nascimento','field-quick-birth'],\n    ['RFID','field-quick-rfid'],\n    ['Pastos','field-quick-pasture'],\n    ['Escores','field-quick-scores'],\n    ['Animal 360º','field-animal360']\n  ];\n  for(const [label,testId] of sections){\n    await page.getByRole('button',{name:label,exact:true}).click();\n    await expect(page.getByTestId(testId)).toBeVisible();\n  }\n});\n\ntest('P1C representative field forms are typed and birth is exposed as a normal contracted action',async({page})=>{\n  await login(page);\n  await page.getByTestId('nav-tasks').click();\n\n  await page.getByRole('button',{name:'Nascimento',exact:true}).click();\n  const birth=page.getByTestId('field-quick-birth');\n  await expect(birth.getByLabel('ID *')).toBeVisible();\n  await expect(birth.getByLabel('Brinco *')).toBeVisible();\n  await expect(birth.getByRole('button',{name:'Registrar nascimento'})).toBeVisible();\n\n  await page.getByRole('button',{name:'Reprodução',exact:true}).click();\n  await expect(page.getByTestId('field-quick-reproduction').getByRole('button',{name:'Registrar evento'})).toBeVisible();\n\n  await page.getByRole('button',{name:'Pastos',exact:true}).click();\n  await expect(page.getByTestId('field-quick-pasture').getByRole('button',{name:/Registrar (entrada|saída)/})).toBeVisible();\n\n  await page.getByRole('button',{name:'Escores',exact:true}).click();\n  await expect(page.getByTestId('field-quick-scores').getByRole('button',{name:'Registrar escore'})).toBeVisible();\n\n  await page.getByRole('button',{name:'RFID',exact:true}).click();\n  await expect(page.getByTestId('field-quick-rfid').getByRole('button',{name:'Vincular identificação'})).toBeVisible();\n\n  await page.getByTestId('nav-animals').click();\n  await expect(page.getByTestId('action-animals-registerBirth')).toBeVisible();\n  await page.getByTestId('action-animals-registerBirth').click();\n  await expect(page.getByRole('dialog',{name:'Registrar nascimento'})).toBeVisible();\n  await expect(page.getByTestId('field-farmUnitId')).toBeVisible();\n  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);\n});\n`;
  await write(path,content);
}

await patchActionConfig();
await patchContracts();
await patchProductActions();
await patchLegacyCounts();
await writeP1cE2E();
console.log('[PASS] P1C final surface patch applied');
