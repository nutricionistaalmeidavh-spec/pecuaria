import {readFile,mkdir,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const sqlPath=fileURLToPath(new URL('../qa/fixtures/legacy-fixture.sql',import.meta.url));

export async function createLegacyFixture(target){
  if(!target)throw new TypeError('fixture target is required');
  await mkdir(dirname(target),{recursive:true});
  await rm(target,{force:true});
  const sql=await readFile(sqlPath,'utf8');
  const db=new DatabaseSync(target);
  try{
    db.exec('PRAGMA foreign_keys=ON;');
    db.exec(sql);
    const check=db.prepare('PRAGMA integrity_check').get();
    if((check?.integrity_check??'')!=='ok')throw new Error('fixture integrity check failed');
  }finally{db.close();}
  return target;
}
