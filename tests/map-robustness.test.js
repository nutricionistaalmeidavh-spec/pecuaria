import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createMapPackageManager,MAP_PACKAGE_CONSTANTS,MapPackageError} from '../runtime/map-package-manager.mjs';

const baseMap={id:'sp',name:'São Paulo',kind:'state',available:true,version:'2026.09.1',asset:'sp.pmtiles',size:100000000,sha256:'a'.repeat(64),minZoom:7,maxZoom:14,bounds:[-53.2,-25.4,-44.1,-19.7],sourceDate:'2026-09-20'};
const manifest=release=>({schemaVersion:1,releaseVersion:release,generatedAt:'2026-09-20T00:00:00Z',source:{provider:'OpenStreetMap',license:'ODbL-1.0'},maps:[{...baseMap,version:release}]});
const sha=value=>createHash('sha256').update(value).digest('hex');
const exists=async path=>{try{await access(path);return true}catch{return false}};

async function withCli(dataDir){const cliDir=join(dataDir,'maps','tools',`pmtiles-${MAP_PACKAGE_CONSTANTS.PMTILES_VERSION}`);await mkdir(cliDir,{recursive:true});await writeFile(join(cliDir,'pmtiles.exe'),'fake');}

test('restores known-good backup after interrupted promotion',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-recovery-')),packages=join(dataDir,'maps','packages');await mkdir(packages,{recursive:true});
  const id='farm-farm-1-detailed',finalFile=`${id}.pmtiles`,backupFile=`${finalFile}.bak`,tempFile=`${finalFile}.part-1.pmtiles`,metadataFile=`${id}.json`;
  await writeFile(join(packages,backupFile),'known-good');await writeFile(join(packages,tempFile),'partial');
  await writeFile(join(packages,metadataFile),JSON.stringify({metadataVersion:1,id,fileName:finalFile,size:10,sha256:'a'.repeat(64),catalogVersion:'2026.09.1'}));
  await writeFile(join(packages,`${id}.transaction.json`),JSON.stringify({version:1,id,finalFile,backupFile,tempFile,metadataFile,stage:'backup-created'}));
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest('2026.09.1')})});
  const state=await manager.snapshot();
  assert.equal(await readFile(join(packages,finalFile),'utf8'),'known-good');
  assert.equal(await exists(join(packages,tempFile)),false);assert.equal(await exists(join(packages,`${id}.transaction.json`)),false);
  assert.equal(state.recoveryIssues.length,0);
});

test('explicit verification marks checksum divergence as corrupt',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-corrupt-')),packages=join(dataDir,'maps','packages');await mkdir(packages,{recursive:true});await withCli(dataDir);
  const id='farm-farm-1-detailed',fileName=`${id}.pmtiles`,payload='payload';await writeFile(join(packages,fileName),payload);
  await writeFile(join(packages,`${id}.json`),JSON.stringify({metadataVersion:1,id,fileName,size:payload.length,sha256:sha('different'),catalogVersion:'2026.09.1'}));
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest('2026.09.1')}),execFileImpl:async()=>({stdout:'',stderr:''})});
  const result=await manager.verifyFarmMap({id});assert.equal(result.health,'corrupt');assert.equal(result.errorCode,'MAP_PACKAGE_CORRUPT');
});

test('new catalog marks older installed package outdated without deleting it',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-outdated-')),packages=join(dataDir,'maps','packages');await mkdir(packages,{recursive:true});
  const id='farm-farm-1-detailed',fileName=`${id}.pmtiles`,payload='payload';await writeFile(join(packages,fileName),payload);
  await writeFile(join(packages,`${id}.json`),JSON.stringify({metadataVersion:1,id,fileName,size:payload.length,sha256:sha(payload),catalogVersion:'2026.09.0'}));
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest('2026.09.2')})});await manager.refreshCatalog();
  const state=await manager.snapshot();assert.equal(state.installed[0].health,'outdated');assert.equal(await readFile(join(packages,fileName),'utf8'),payload);
});

test('browser or unsupported desktop runtime reports package provider unavailable',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-runtime-'));const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest('2026.09.1')})});
  assert.equal((await manager.snapshot()).available,false);await assert.rejects(()=>manager.ensureCli(),e=>e instanceof MapPackageError&&e.code==='MAP_UNSUPPORTED_RUNTIME');
});

test('same farm/profile cannot install twice concurrently',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-lock-'));await withCli(dataDir);let releaseExtract;const gate=new Promise(resolve=>releaseExtract=resolve);
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest('2026.09.1')}),execFileImpl:async(_file,args)=>{if(args[0]==='extract'){await gate;await writeFile(args[2],'payload')}return{stdout:'',stderr:''}}});await manager.refreshCatalog();
  const input={farmUnitId:'farm-1',profile:'detailed',bounds:[-47.91,-21.22,-47.89,-21.20]};const first=manager.installFarmMap(input);await new Promise(resolve=>setTimeout(resolve,10));
  await assert.rejects(()=>manager.installFarmMap(input),e=>e.code==='MAP_INSTALL_IN_PROGRESS');releaseExtract();await first;
});
