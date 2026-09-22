import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMapPackageManager,MAP_PACKAGE_CONSTANTS,MapPackageError} from '../runtime/map-package-manager.mjs';

const manifest={schemaVersion:1,releaseVersion:'2026.09.1',generatedAt:'2026-09-20T00:00:00Z',source:{provider:'OpenStreetMap',license:'ODbL-1.0'},maps:[{id:'sp',name:'São Paulo',kind:'state',available:true,version:'2026.09.1',asset:'sp.pmtiles',size:454144673,sha256:'a'.repeat(64),minZoom:7,maxZoom:14,bounds:[-53.2,-25.4,-44.1,-19.7],sourceDate:'2026-09-20'}]};
const missing=async path=>{try{await access(path);return false}catch{return true}};

async function makeManager({verifyFails=false}={}){
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-manager-'));
  const cliDir=join(dataDir,'maps','tools',`pmtiles-${MAP_PACKAGE_CONSTANTS.PMTILES_VERSION}`);
  await mkdir(cliDir,{recursive:true});await writeFile(join(cliDir,'pmtiles.exe'),'fake');
  const calls=[];
  const execFileImpl=async(_file,args)=>{calls.push(args);if(args[0]==='extract')await writeFile(args[2],Buffer.from('pmtiles-test-payload'));if(args[0]==='verify'&&verifyFails)throw new Error('verify failed');return{stdout:'',stderr:''};};
  const fetchImpl=async url=>({ok:true,status:200,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(0),url});
  return{dataDir,calls,manager:createMapPackageManager({dataDir,platform:'win32',arch:'x64',execFileImpl,fetchImpl})};
}

test('plans from pinned mapasbrasilrelease release and never daily Protomaps build',async()=>{
  const {manager}=await makeManager();
  await manager.refreshCatalog();
  const plan=await manager.planFarmMap({farmUnitId:'farm-1',farmName:'Fazenda Norte',profile:'detailed',bounds:[-47.91,-21.22,-47.89,-21.20]});
  assert.equal(plan.sources.length,1);
  assert.equal(plan.sources[0].url,'https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v2026.09.1/sp.pmtiles');
  assert.doesNotMatch(JSON.stringify(plan),/build\.protomaps\.com/);
});

test('extracts, verifies, installs atomically and removes a farm package',async()=>{
  const {manager,dataDir,calls}=await makeManager();await manager.refreshCatalog();
  const record=await manager.installFarmMap({farmUnitId:'farm-1',farmName:'Fazenda Norte',profile:'detailed',bounds:[-47.91,-21.22,-47.89,-21.20]});
  assert.equal(record.sourceId,'sp');assert.equal(record.catalogVersion,'2026.09.1');assert.ok(record.size>0);
  assert.ok(calls.some(args=>args[0]==='extract'&&args[1].includes('/br-maps-v2026.09.1/sp.pmtiles')&&args.includes('--bbox=-47.91,-21.22,-47.89,-21.2')));
  assert.ok(calls.some(args=>args[0]==='verify'));
  const metadata=JSON.parse(await readFile(join(dataDir,'maps','packages',`${record.id}.json`),'utf8'));
  assert.equal(metadata.fileName,'farm-farm-1-detailed.pmtiles');
  assert.equal((await manager.snapshot()).installed[0].health,'healthy');
  await manager.removeFarmMap({id:record.id});
  assert.equal(await missing(join(dataDir,'maps','packages',metadata.fileName)),true);
});

test('does not replace last good package when verification fails',async()=>{
  const {manager,dataDir}=await makeManager();await manager.refreshCatalog();
  const packages=join(dataDir,'maps','packages');await mkdir(packages,{recursive:true});
  const id='farm-farm-1-detailed',fileName=`${id}.pmtiles`;
  await writeFile(join(packages,fileName),'known-good');
  await writeFile(join(packages,`${id}.json`),JSON.stringify({metadataVersion:1,id,fileName,size:10,sha256:'b'.repeat(64),catalogVersion:'2026.09.1'}));
  const failing=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>manifest}),execFileImpl:async(_file,args)=>{if(args[0]==='extract')await writeFile(args[2],'new-bad');if(args[0]==='verify')throw new Error('bad')}});
  await assert.rejects(()=>failing.installFarmMap({farmUnitId:'farm-1',profile:'detailed',bounds:[-47.91,-21.22,-47.89,-21.20]}),e=>e instanceof MapPackageError&&e.code==='MAP_VERIFY_FAILED');
  assert.equal(await readFile(join(packages,fileName),'utf8'),'known-good');
});

test('rejects multi-state plans explicitly',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pec-map-multi-'));
  const multi={...manifest,maps:[manifest.maps[0],{...manifest.maps[0],id:'mg',name:'Minas Gerais',asset:'mg.pmtiles',bounds:[-48,-23,-39,-14]}]};
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>({ok:true,status:200,json:async()=>multi}),execFileImpl:async()=>({stdout:'',stderr:''})});
  await manager.refreshCatalog();
  await assert.rejects(()=>manager.installFarmMap({farmUnitId:'border',bounds:[-47.95,-21.3,-47.8,-21.1]}),e=>e.code==='MAP_MULTI_SOURCE_REQUIRED');
});
