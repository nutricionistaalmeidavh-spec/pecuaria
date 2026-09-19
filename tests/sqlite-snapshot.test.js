import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {snapshotSqlite,assertLegacyTablesPreserved} from '../tooling/sqlite-snapshot.mjs';

test('snapshot preserves digest of preexisting legacy table',async()=>{const root=await mkdtemp(join(tmpdir(),'snapshot-'));const path=join(root,'db.sqlite');try{const db=new DatabaseSync(path);db.exec('CREATE TABLE customer_data(id TEXT PRIMARY KEY,value TEXT);');db.prepare('INSERT INTO customer_data VALUES(?,?)').run('1','A');db.prepare('INSERT INTO customer_data VALUES(?,?)').run('2','B');db.close();const before=snapshotSqlite(path);const db2=new DatabaseSync(path);db2.exec('CREATE TABLE migration_only(id TEXT PRIMARY KEY);');db2.close();const after=snapshotSqlite(path);assert.equal(before.tables.customer_data.rows,2);assert.doesNotThrow(()=>assertLegacyTablesPreserved(before,after));}finally{await rm(root,{recursive:true,force:true});}});
