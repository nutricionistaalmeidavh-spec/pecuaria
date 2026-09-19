import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

const execFileAsync=promisify(execFile);

export async function currentCommit(){
  const {stdout}=await execFileAsync('git',['rev-parse','HEAD'],{cwd:process.cwd(),windowsHide:true});
  const commit=stdout.trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Invalid git commit: ${commit}`);
  return commit;
}

export async function writeEvidence(path,payload={}){
  const record={...payload,commit:payload.commit??await currentCommit(),generatedAt:payload.generatedAt??new Date().toISOString()};
  await mkdir(dirname(path),{recursive:true});
  const tmp=`${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp,JSON.stringify(record,null,2)+'\n','utf8');
  await rename(tmp,path);
  return record;
}
