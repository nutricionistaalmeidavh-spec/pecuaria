import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const quote=id=>`"${String(id).replaceAll('"','""')}"`;
const normalize=value=>{
  if(value instanceof Uint8Array||Buffer.isBuffer(value)) return {__blob:Buffer.from(value).toString('hex')};
  if(value&&typeof value==='object'&&!Array.isArray(value)) return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
  if(Array.isArray(value)) return value.map(normalize);
  return value;
};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function snapshotSqlite(path){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
    const tables={};
    for(const name of names){
      const columns=db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c=>c.name);
      const rows=db.prepare(`SELECT * FROM ${quote(name)}`).all().map(row=>normalize(row));
      const serialized=rows.map(r=>JSON.stringify(r)).sort();
      tables[name]={rows:rows.length,columns,sha256:digest(serialized)};
    }
    return {tables};
  }finally{db.close();}
}

export function assertLegacyTablesPreserved(before,after,ignoredTables=[]){
  const ignored=new Set(ignoredTables);
  for(const [name,expected] of Object.entries(before.tables??{})){
    if(ignored.has(name)) continue;
    assert.ok(after.tables?.[name],`Legacy table missing after upgrade: ${name}`);
    assert.equal(after.tables[name].rows,expected.rows,`Legacy row count changed: ${name}`);
    assert.equal(after.tables[name].sha256,expected.sha256,`Legacy table content changed: ${name}`);
  }
  return true;
}
