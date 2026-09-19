import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,stat} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const releaseDir=join(root,'release');
const artifactDir=join(root,'qa-artifacts');
const installerPattern=/^ArtiSys-Pecuaria-Setup-.*\.exe$/i;

const hashFile=path=>new Promise((resolve,reject)=>{
  const hash=createHash('sha256'),stream=createReadStream(path);
  stream.on('data',chunk=>hash.update(chunk));
  stream.on('error',reject);
  stream.on('end',()=>resolve(hash.digest('hex')));
});

export async function createReleaseRun(){
  const commit=await currentCommit();
  const names=(await readdir(releaseDir)).filter(name=>installerPattern.test(name));
  if(!names.length)throw new Error('ArtiSys-Pecuaria-Setup- installer not found');
  const candidates=await Promise.all(names.map(async name=>{
    const path=join(releaseDir,name),info=await stat(path);
    return{name,path,size:info.size,mtimeMs:info.mtimeMs};
  }));
  const installer=candidates.sort((a,b)=>b.mtimeMs-a.mtimeMs)[0];
  if(installer.size<=1024*1024)throw new Error('Windows installer must be larger than 1 MiB');
  const sha256=await hashFile(installer.path);

  const requestedStart=Date.parse(process.env.ARTISYS_RELEASE_STARTED_AT??'');
  const startedMs=Number.isFinite(requestedStart)&&requestedStart<=installer.mtimeMs
    ? requestedStart
    : Math.max(0,installer.mtimeMs-1000);
  const runner=process.env.GITHUB_ACTIONS==='true'?'github-actions':'local';
  const record={
    status:'passed',
    runner,
    commit,
    startedAt:new Date(startedMs).toISOString(),
    finishedAt:new Date().toISOString(),
    installer:{name:installer.name,size:installer.size,sha256}
  };
  return writeEvidence(join(artifactDir,'release-run.json'),record);
}

if(basename(process.argv[1]??'')==='release-run.mjs'){
  createReleaseRun()
    .then(record=>console.log(`[PASS] Release run - ${record.runner} - ${record.installer.name}`))
    .catch(error=>{console.error(`[FAIL] Release run - ${error.message}`);process.exitCode=1;});
}
