import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,readdir,rm,stat} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const artifactDir=fileURLToPath(new URL('../qa-artifacts/',import.meta.url));
const releaseDir=fileURLToPath(new URL('../release/',import.meta.url));
const certPath=join(artifactDir,'release-certification.json');
const INSTALLER=/^ArtiSys-Pecuaria-Setup-.*\.exe$/i;
const PIN='a444031860d5b8c91adc5628759bc67c0c29d557';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const hashFile=path=>new Promise((resolve,reject)=>{const h=createHash('sha256'),s=createReadStream(path);s.on('data',chunk=>h.update(chunk));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')))});

export function validateEvidence(commit,evidence){
  for(const [name,item] of Object.entries(evidence)){
    assert.equal(item.status,'passed',`${name} evidence is not passed`);
    assert.equal(item.commit,commit,`${name} evidence is stale`);
  }
  return true;
}

export function selectInstaller(candidates){
  assert.ok(candidates.length,'Windows installer not found');
  const installer=[...candidates].sort((a,b)=>b.mtimeMs-a.mtimeMs)[0];
  assert.ok(installer.size>1024*1024,'Installer must be larger than 1 MiB');
  return installer;
}

export function validateReleaseRun({head,run,installer}){
  assert.equal(run.status,'passed','release run is not passed');
  assert.equal(run.commit,head,'release run is stale');
  assert.equal(run.utilidadesCommit,PIN,'release run used unexpected utilidades commit');
  assert.ok(Number.isFinite(Date.parse(run.startedAt)),'release run startedAt is invalid');
  assert.ok(installer.mtimeMs>=Date.parse(run.startedAt),'installer predates release run');
  assert.equal(installer.name,run.installer?.name,'installer name differs from release run');
  assert.equal(installer.sha256,run.installer?.sha256,'installer hash differs from release run');
  return true;
}

export async function certifyRelease(){
  await rm(certPath,{force:true});
  const commit=await currentCommit();
  const evidence={
    phase5:await json(join(artifactDir,'phase5-summary.json')),
    phase7:await json(join(artifactDir,'phase7-summary.json')),
    playwright:await json(join(artifactDir,'playwright-summary.json')),
    productQa:await json(join(artifactDir,'product-qa-summary.json')),
    security:await json(join(artifactDir,'security-summary.json')),
    contracts:await json(join(artifactDir,'api-contract-summary.json')),
    releaseValidation:await json(join(artifactDir,'release-validation.json'))
  };
  validateEvidence(commit,evidence);
  const run=await json(join(artifactDir,'release-run.json'));
  const names=(await readdir(releaseDir)).filter(name=>INSTALLER.test(name));
  const candidates=await Promise.all(names.map(async name=>{const info=await stat(join(releaseDir,name));return{name,path:join(releaseDir,name),size:info.size,mtimeMs:info.mtimeMs,mtime:info.mtime}}));
  let installer=candidates.find(item=>item.name===run.installer?.name)??selectInstaller(candidates);
  installer={...installer,sha256:await hashFile(installer.path)};
  validateReleaseRun({head:commit,run,installer});
  assert.equal(evidence.releaseValidation.installer?.name,installer.name,'release validation installer differs');
  assert.equal(evidence.releaseValidation.installer?.sha256,installer.sha256,'release validation hash differs');
  const record={phase:8,status:'passed',productId:'agro-pecuaria',evidence:Object.fromEntries(Object.entries(evidence).map(([name,item])=>[name,item.generatedAt])),installer:{name:installer.name,size:installer.size,mtime:installer.mtime.toISOString(),sha256:installer.sha256},utilidadesCommit:PIN};
  await writeEvidence(certPath,{...record,commit});
  return record;
}

if(basename(process.argv[1]??'').toLowerCase()==='certify-release.mjs')certifyRelease().then(()=>console.log('[PASS] FASE 8 - release certificado')).catch(error=>{console.error(`[FAIL] FASE 8 - ${error.message}`);process.exitCode=1});
