import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildRegionalMapPlan,validateMapManifest} from '../src/maps/core/index.js';

export const MAP_RELEASE_REPOSITORY='nutricionistaalmeidavh-spec/mapasbrasilrelease';
export const DEFAULT_MAP_MANIFEST_URL='https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/latest/download/maps-manifest.json';
const releaseBase=version=>`https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v${version}`;

export function createMapCatalog({dataDir,fetchImpl=globalThis.fetch}={}){
  if(typeof dataDir!=='string'||!dataDir.trim())throw new TypeError('dataDir is required.');
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required.');
  const root=join(dataDir,'maps'),cachePath=join(root,'maps-manifest.json');
  let cached=null;
  const loadCached=async()=>{if(cached)return cached;try{cached=validateMapManifest(JSON.parse(await readFile(cachePath,'utf8')));}catch{cached=null;}return cached;};
  const refresh=async()=>{
    let response;try{response=await fetchImpl(DEFAULT_MAP_MANIFEST_URL,{redirect:'follow'});}catch(error){throw new Error(`Map catalog unavailable: ${error?.message??error}`);}
    if(!response.ok)throw new Error(`Map catalog unavailable (${response.status}).`);
    const manifest=validateMapManifest(await response.json());
    await mkdir(root,{recursive:true});const temp=`${cachePath}.tmp-${process.pid}`;await writeFile(temp,`${JSON.stringify(manifest,null,2)}\n`);await rename(temp,cachePath);cached=manifest;return manifest;
  };
  const snapshot=async()=>{const manifest=await loadCached();return Object.freeze({repository:MAP_RELEASE_REPOSITORY,manifestUrl:DEFAULT_MAP_MANIFEST_URL,catalogAvailable:Boolean(manifest),releaseVersion:manifest?.releaseVersion??null,mapCount:manifest?.maps?.filter(item=>item.available===true).length??0});};
  const plan=async({farmUnitId,farmName=null,bounds,profile='detailed'}={})=>{
    const manifest=(await loadCached())??await refresh();
    return buildRegionalMapPlan({areaId:farmUnitId,areaName:farmName,bounds,manifest,profile,releaseBaseUrl:releaseBase(manifest.releaseVersion)});
  };
  return Object.freeze({snapshot,refresh,plan,manifestUrl:DEFAULT_MAP_MANIFEST_URL});
}
