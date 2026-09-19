import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

test('SQLite, reabertura e backup standalone',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-'));
  let h;
  try{
    h=await createStandaloneHost({dataDir:root});
    await h.persistence.putRecord('cattle.animals','a1',{id:'a1',tag:'1'},{expectedVersion:0});
    const b=await h.recovery.createBackup({id:'ok'});
    await h.persistence.putRecord('cattle.animals','a1',{id:'a1',tag:'2'},{expectedVersion:1});
    await h.recovery.restoreBackup(b.id);
    assert.equal((await h.persistence.getRecord('cattle.animals','a1')).payload.tag,'1');
    assert.equal((await h.persistence.health()).ok,true);
  }finally{
    await h?.close();
    await rm(root,{recursive:true,force:true});
  }
});

test('standalone host forwards atomic persistence transactions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-host-tx-'));
  let h;
  try{
    h=await createStandaloneHost({dataDir:root});
    assert.equal(typeof h.persistence.transaction,'function');
    await assert.rejects(()=>h.persistence.transaction(async tx=>{
      await tx.putRecord('cattle.animals','rollback',{id:'rollback',tag:'R'},{expectedVersion:0});
      throw new Error('rollback-host');
    }),/rollback-host/);
    assert.equal(await h.persistence.getRecord('cattle.animals','rollback'),null);
  }finally{
    await h?.close();
    await rm(root,{recursive:true,force:true});
  }
});
