import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createBackupManager} from '../src/backup.js';

async function fixture({retention=20}={}){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-backup-'));
  const dbPath=join(dir,'db.sqlite'),backupDir=join(dir,'backups');
  let db=await openProductPersistence({dbPath,productId:'agro-pecuaria'});
  const manager=await createBackupManager({
    dbPath,backupDir,productId:'agro-pecuaria',retention,
    closeDatabase:async()=>{await db?.close();db=null},
    reopenDatabase:async()=>{db=await openProductPersistence({dbPath,productId:'agro-pecuaria'})}
  });
  return{dir,db:()=>db,manager,async cleanup(){await db?.close();await rm(dir,{recursive:true,force:true})}};
}

test('backup records sha256 metadata and verifies SQLite/product identity',async()=>{
  const f=await fixture();
  try{
    await f.db().putRecord('qa','one',{value:1},{expectedVersion:0});
    const backup=await f.manager.createBackup({id:'known-good'});
    assert.equal(backup.id,'known-good');
    assert.equal(backup.verified,true);
    assert.match(backup.sha256,/^[a-f0-9]{64}$/);
    assert.ok(backup.size>0);
    const meta=JSON.parse(await readFile(`${backup.path}.json`,'utf8'));
    assert.equal(meta.sha256,backup.sha256);
    assert.equal(meta.productId,'agro-pecuaria');
  }finally{await f.cleanup()}
});

test('corrupt backup is rejected before live database replacement',async()=>{
  const f=await fixture();
  try{
    await f.db().putRecord('qa','sentinel',{value:'live'},{expectedVersion:0});
    const backup=await f.manager.createBackup({id:'corrupt-me'});
    await writeFile(backup.path,'not-a-sqlite-database');
    await assert.rejects(()=>f.manager.restoreBackup(backup.id),/integrity|sha256|corrupt|invalid/i);
    assert.equal((await f.db().getRecord('qa','sentinel')).payload.value,'live');
  }finally{await f.cleanup()}
});

test('restore creates a safety backup and restores the selected snapshot',async()=>{
  const f=await fixture();
  try{
    await f.db().putRecord('qa','sentinel',{value:'before'},{expectedVersion:0});
    const backup=await f.manager.createBackup({id:'before-change'});
    await f.db().putRecord('qa','sentinel',{value:'after'},{expectedVersion:1});
    const result=await f.manager.restoreBackup(backup.id);
    assert.equal(result.restored,true);
    assert.match(result.safetyBackupId,/^safety-/);
    assert.equal((await f.db().getRecord('qa','sentinel')).payload.value,'before');
    const backups=await f.manager.listBackups();
    assert.ok(backups.some(item=>item.id===result.safetyBackupId&&item.verified));
  }finally{await f.cleanup()}
});

test('retention keeps newest backup and explicitly protected backups',async()=>{
  const f=await fixture({retention:2});
  try{
    await f.manager.createBackup({id:'protected-old',protected:true});
    await new Promise(resolve=>setTimeout(resolve,5));
    await f.manager.createBackup({id:'middle'});
    await new Promise(resolve=>setTimeout(resolve,5));
    await f.manager.createBackup({id:'newest'});
    const ids=(await f.manager.listBackups()).map(item=>item.id);
    assert.ok(ids.includes('protected-old'));
    assert.ok(ids.includes('newest'));
    assert.ok(!ids.includes('middle'));
  }finally{await f.cleanup()}
});
