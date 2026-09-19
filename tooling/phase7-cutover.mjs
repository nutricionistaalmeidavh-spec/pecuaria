import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {snapshotSqlite,assertLegacyTablesPreserved} from './sqlite-snapshot.mjs';
import {writeEvidence} from './evidence.mjs';
import {createLegacyFixture} from './legacy-fixture.mjs';

const PRODUCT_ID='agro-pecuaria';
const DATABASE_FILE='artisys-pecuaria.sqlite';
const REQUIRED_MIGRATIONS=['agro-pecuaria/001-initial.sql'];
const summaryPath=fileURLToPath(new URL('../qa-artifacts/phase7-summary.json',import.meta.url));

async function exists(path){
  try{return await stat(path)}
  catch(error){if(error.code==='ENOENT')return null;throw error}
}

async function hashFile(path){
  return new Promise((resolve,reject)=>{
    const hash=createHash('sha256'),stream=createReadStream(path);
    stream.on('data',chunk=>hash.update(chunk));
    stream.on('error',reject);
    stream.on('end',()=>resolve(hash.digest('hex')));
  });
}

export async function runPhase7({source=process.env.ARTISYS_LEGACY_DB,keep=process.env.ARTISYS_QA_KEEP==='1',recordEvidence=true}={}){
  const summary={phase:7,productId:PRODUCT_ID,databaseFile:DATABASE_FILE,status:'failed',checks:{}};
  let root,fixtureRoot,host;
  const persist=async()=>recordEvidence?writeEvidence(summaryPath,summary):summary;
  try{
    let sourcePath=source;
    if(!sourcePath){
      fixtureRoot=await mkdtemp(join(tmpdir(),`${PRODUCT_ID}-fixture-`));
      sourcePath=join(fixtureRoot,'legacy-fixture.sqlite');
      await createLegacyFixture(sourcePath);
      summary.sourceKind='fixture';
      summary.checks.fixtureGenerated=true;
    }else{
      summary.sourceKind='external';
      summary.checks.fixtureGenerated=false;
    }

    const sourceInfo=await stat(sourcePath);
    if(!sourceInfo.isFile())throw new Error('Phase 7 source must point to a SQLite file');
    const wal=await exists(`${sourcePath}-wal`);
    if(wal?.size>0)throw new Error('Source database has an active WAL; close the application and checkpoint SQLite before cutover');

    const originalHashBefore=await hashFile(sourcePath);
    const before=snapshotSqlite(sourcePath);
    summary.checks.sourceReadable=true;

    root=await mkdtemp(join(tmpdir(),`${PRODUCT_ID}-phase7-`));
    const sandboxDb=join(root,DATABASE_FILE);
    await copyFile(sourcePath,sandboxDb);
    summary.checks.sandboxCopy=true;

    host=await createStandaloneHost({dataDir:root});
    const schema=await host.persistence.schemaState();
    assert.equal(schema.productId,PRODUCT_ID);
    for(const id of REQUIRED_MIGRATIONS)assert.ok(schema.migrations.includes(id),`Missing migration ${id}`);
    summary.migrations=schema.migrations;
    summary.checks.migrations=true;

    const backup=await host.recovery.createBackup({id:'phase7-pre-sentinel'});
    await host.persistence.putRecord('qa.cutover','sentinel',{value:'cutover-write'},{expectedVersion:0});
    await host.close();
    host=null;

    host=await createStandaloneHost({dataDir:root});
    assert.equal((await host.persistence.getRecord('qa.cutover','sentinel')).payload.value,'cutover-write');
    summary.checks.reopenWrite=true;
    await host.recovery.restoreBackup(backup.id);
    assert.equal(await host.persistence.getRecord('qa.cutover','sentinel'),null);
    summary.checks.backupRestore=true;
    await host.close();
    host=null;

    assertLegacyTablesPreserved(before,snapshotSqlite(sandboxDb),['__artisys_meta','__artisys_migrations']);
    summary.checks.legacyTablesPreserved=true;
    const originalHashAfter=await hashFile(sourcePath);
    assert.equal(originalHashAfter,originalHashBefore,'Phase 7 source database was modified');
    summary.checks.originalHashUnchanged=true;
    summary.originalSha256=originalHashBefore;
    summary.status='passed';
    summary.finishedAt=new Date().toISOString();
    await persist();
    return summary;
  }catch(error){
    summary.error=error.stack??error.message;
    summary.finishedAt=new Date().toISOString();
    await persist().catch(()=>{});
    throw error;
  }finally{
    await host?.close?.().catch(()=>{});
    if(root&&!keep)await rm(root,{recursive:true,force:true}).catch(()=>{});
    if(fixtureRoot&&!keep)await rm(fixtureRoot,{recursive:true,force:true}).catch(()=>{});
  }
}

if(basename(process.argv[1]??'').toLowerCase()==='phase7-cutover.mjs'){
  runPhase7()
    .then(summary=>console.log(`[PASS] FASE 7 - ${summary.sourceKind} cutover não destrutivo`))
    .catch(error=>{console.error(`[FAIL] FASE 7 - ${error.message}`);process.exitCode=1;});
}
