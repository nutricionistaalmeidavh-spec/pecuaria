import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,readdir,stat} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=join(root,'qa-artifacts'),releaseDir=join(root,'release');
const installerPattern=/^ArtiSys-Pecuaria-Setup-.*\.exe$/i;
const required=['phase5','phase7','playwright','productQa','security','contracts'];
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const hashFile=path=>new Promise((resolve,reject)=>{const h=createHash('sha256'),s=createReadStream(path);s.on('data',chunk=>h.update(chunk));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')))});

export function validateReleaseEvidence({commit,evidence={},installer,run}={}){
  assert.match(commit??'',/^[a-f0-9]{40}$/,'invalid release commit');
  for(const name of required){
    const item=evidence[name];
    assert.ok(item,`${name} evidence missing`);
    assert.equal(item.status,'passed',`${name} evidence is not passed`);
    assert.equal(item.commit,commit,`${name} evidence is stale`);
  }
  assert.ok(installer,'Windows installer missing');
  assert.ok(installer.size>1024*1024,'Windows installer must be larger than 1 MiB');
  assert.match(installer.sha256??'',/^[a-f0-9]{64}$/,'installer hash is invalid');
  assert.equal(run?.status,'passed','release run is not passed');
  assert.equal(run?.commit,commit,'release run is stale');
  assert.ok(Number.isFinite(Date.parse(run?.startedAt)),'release run startedAt is invalid');
  assert.ok(installer.mtimeMs>=Date.parse(run.startedAt),'installer predates release run');
  assert.equal(installer.name,run?.installer?.name,'installer name differs from release run');
  assert.equal(installer.sha256,run?.installer?.sha256,'installer hash differs from release run');
  return{status:'passed',failedRequired:[]};
}

export async function runReleaseValidator(){
  const commit=await currentCommit();
  const files={phase5:'phase5-summary.json',phase7:'phase7-summary.json',playwright:'playwright-summary.json',productQa:'product-qa-summary.json',security:'security-summary.json',contracts:'api-contract-summary.json'};
  const evidence={};
  for(const [name,file] of Object.entries(files))evidence[name]=await json(join(artifacts,file));
  const run=await json(join(artifacts,'release-run.json'));
  const names=(await readdir(releaseDir)).filter(name=>installerPattern.test(name));
  assert.ok(names.length,'Windows installer missing');
  const candidates=await Promise.all(names.map(async name=>{const info=await stat(join(releaseDir,name));return{name,path:join(releaseDir,name),size:info.size,mtimeMs:info.mtimeMs}}));
  let installer=candidates.find(item=>item.name===run?.installer?.name)??candidates.sort((a,b)=>b.mtimeMs-a.mtimeMs)[0];
  installer={...installer,sha256:await hashFile(installer.path)};
  const result=validateReleaseEvidence({commit,evidence,installer,run});
  return writeEvidence(join(artifacts,'release-validation.json'),{...result,installer:{name:installer.name,size:installer.size,sha256:installer.sha256},commit});
}

if(basename(process.argv[1]??'')==='release-validator-gate.mjs')runReleaseValidator().then(()=>console.log('[PASS] Release validator')).catch(error=>{console.error(`[FAIL] Release validator - ${error.message}`);process.exitCode=1});
