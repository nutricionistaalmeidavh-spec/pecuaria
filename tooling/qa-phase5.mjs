import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {currentCommit,writeEvidence} from './evidence.mjs';

const contract=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));
const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const summaryPath=join(artifactDir,'phase5-summary.json');
const credential=['Qa','Standalone','2026!'].join('-');
const sorted=value=>[...value].sort();
const line=(status,label,details='')=>process.stdout.write(`[${status}] ${label}${details?` - ${details}`:''}\n`);
const contractedActionCount=Object.values(contract.actions).reduce((total,actions)=>total+actions.length,0);
let root,host;
const summary={phase:5,productId:contract.productId,status:'failed',screens:[],checks:{},commit:await currentCommit()};

try{
  await mkdir(artifactDir,{recursive:true});
  root=await mkdtemp(join(tmpdir(),`${contract.productId}-phase5-`));
  host=await createStandaloneHost({dataDir:root});

  assert.equal((await host.backend.authState()).hasUsers,false);
  await host.backend.bootstrap({username:'qa-admin',password:credential});
  const logged=await host.backend.login({username:'qa-admin',password:credential});
  const auth={sessionId:logged.session.id,token:logged.token};
  await host.backend.validate(auth);
  summary.checks.authentication=true;
  line('PASS','Autenticação');

  const meta=await host.backend.describe();
  assert.equal(meta.productId,contract.productId);
  assert.deepEqual(meta.navigation.map(item=>item.id),contract.screens);
  assert.deepEqual(meta.screens.map(item=>item.id),contract.screens);
  for(let index=0;index<contract.screens.length;index+=1){
    const id=contract.screens[index];
    await host.backend.load({screenId:id,auth,context:{}});
    const description=meta.screens.find(item=>item.id===id);
    const expected=contract.actions[id]??[];
    assert.deepEqual(sorted(Object.keys(host.presentation.screen(id).actions??{})),sorted(expected));
    assert.deepEqual(sorted(Object.keys(description?.actionDefinitions??{})),sorted(expected));
    summary.screens.push({id,actions:expected.length,loaded:true});
    line('PASS',`Tela ${index+1}/${contract.screens.length}: ${id}`,`${expected.length} ações`);
  }
  summary.checks.surface=true;
  summary.screensCovered=contract.screens.length;

  const actionRun=spawnSync(process.execPath,['--test','tests/product-actions.test.js'],{
    cwd:repoRoot,
    encoding:'utf8',
    env:{...process.env}
  });
  if(actionRun.status!==0){
    const diagnostics=[actionRun.stdout,actionRun.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Functional action QA failed.${diagnostics?`\n${diagnostics}`:''}`);
  }
  assert.equal(contractedActionCount,16);
  summary.checks.functionalActions=true;
  summary.actionsCovered=contractedActionCount;
  summary.negativeCasesCovered=true;
  line('PASS','Ações funcionais',`${contractedActionCount}/${contractedActionCount}`);

  const security=await import('../src/security.js');
  assert.ok((security.SECURITY_POLICY?.admin??[]).includes('*'));
  assert.ok(Array.isArray(security.SECURITY_POLICY?.viewer));
  assert.equal(security.PRESENTATION_ACCESS?.screens?.settings?.actions?.restore,'settings:restore');
  summary.checks.rbacContract=true;
  line('PASS','Contrato RBAC');

  await host.persistence.putRecord('qa.phase5','sentinel',{value:'before'},{expectedVersion:0});
  const backup=await host.recovery.createBackup({id:'phase5-known-good'});
  await host.persistence.putRecord('qa.phase5','sentinel',{value:'after'},{expectedVersion:1});
  await host.recovery.restoreBackup(backup.id);
  assert.equal((await host.persistence.getRecord('qa.phase5','sentinel')).payload.value,'before');
  summary.checks.backupRestore=true;
  line('PASS','Backup/restore');

  await host.close();
  host=null;
  host=await createStandaloneHost({dataDir:root});
  const again=await host.backend.login({username:'qa-admin',password:credential});
  await host.backend.validate({sessionId:again.session.id,token:again.token});
  assert.equal((await host.persistence.getRecord('qa.phase5','sentinel')).payload.value,'before');
  assert.equal((await host.persistence.health()).ok,true);
  summary.checks.restartPersistence=true;

  summary.status='passed';
  summary.screenCount=contract.screens.length;
  summary.actionCount=contractedActionCount;
  summary.finishedAt=new Date().toISOString();
  await writeEvidence(summaryPath,summary);
  line('PASS','FASE 5',`${summary.screenCount}/${summary.screenCount} telas, ${summary.actionCount}/${summary.actionCount} ações funcionais`);
}catch(error){
  summary.error=error.stack??error.message;
  summary.finishedAt=new Date().toISOString();
  await writeEvidence(summaryPath,summary).catch(()=>{});
  line('FAIL','FASE 5',error.message);
  process.exitCode=1;
}finally{
  await host?.close?.().catch(()=>{});
  if(root&&process.env.ARTISYS_QA_KEEP!=='1')await rm(root,{recursive:true,force:true}).catch(()=>{});
}
