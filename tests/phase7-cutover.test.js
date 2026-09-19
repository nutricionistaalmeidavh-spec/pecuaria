import test from 'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{mkdtemp,readFile,rm}from'node:fs/promises';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{DatabaseSync}from'node:sqlite';
import{runPhase7}from'../tooling/phase7-cutover.mjs';

const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');

test('phase7 uses repository fixture automatically when no customer database exists',async()=>{
  const result=await runPhase7({source:'',recordEvidence:false});
  assert.equal(result.status,'passed');
  assert.equal(result.sourceKind,'fixture');
  assert.equal(result.productId,'agro-pecuaria');
  assert.equal(result.checks.fixtureGenerated,true);
});

test('phase7 upgrades only a sandbox copy and preserves explicitly supplied original bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'phase7-pecuaria-')),source=join(root,'artisys-pecuaria.sqlite');
  try{
    const db=new DatabaseSync(source);
    db.exec('CREATE TABLE customer_data(id TEXT PRIMARY KEY,value TEXT);');
    db.prepare('INSERT INTO customer_data VALUES(?,?)').run('legacy-1','preserve-me');
    db.close();
    const before=await sha(source),result=await runPhase7({source,recordEvidence:false});
    assert.equal(result.status,'passed');
    assert.equal(result.sourceKind,'external');
    assert.equal(result.productId,'agro-pecuaria');
    assert.equal(await sha(source),before);
  }finally{await rm(root,{recursive:true,force:true});}
});
