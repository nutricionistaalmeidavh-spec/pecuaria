import {access,mkdir,readFile,writeFile,rename,rm,stat,statfs,readdir} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildRegionalMapPlan,validateMapManifest} from '../src/maps/core/index.js';

const execFileAsync=promisify(execFile);
const PMTILES_VERSION='1.31.2';
const WINDOWS_X64_ASSET=Object.freeze({
  url:`https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Windows_x86_64.zip`,
  sha256:'a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1'
});
export const MAP_RELEASE_REPOSITORY='nutricionistaalmeidavh-spec/mapasbrasilrelease';
const DEFAULT_MANIFEST_URL='https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/latest/download/maps-manifest.json';
const releaseBase=version=>`https://github.com/${MAP_RELEASE_REPOSITORY}/releases/download/br-maps-v${version}`;
const PROFILE_LABELS=Object.freeze({basic:'Básico',detailed:'Detalhado',maximum:'Máximo'});
const safeId=value=>String(value??'farm').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'farm';
const ensureBounds=bounds=>{if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new TypeError('Valid farm bounds are required.');return bounds;};
const exists=async path=>{try{await access(path);return true}catch{return false}};
const atomicJson=async(path,value)=>{const temp=`${path}.tmp-${process.pid}-${Date.now()}`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,path);};
const sha256Buffer=buffer=>createHash('sha256').update(buffer).digest('hex');
async function sha256File(path){const {createReadStream}=await import('node:fs');return new Promise((resolveDigest,reject)=>{const hash=createHash('sha256'),stream=createReadStream(path);stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolveDigest(hash.digest('hex')));});}
function releaseParts(value){const match=/^(\d{4})\.(\d{2})\.(\d+)$/.exec(String(value??''));return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null;}
function newerRelease(candidate,current){const a=releaseParts(candidate),b=releaseParts(current);if(!a||!b)return false;for(let i=0;i<3;i+=1){if(a[i]!==b[i])return a[i]>b[i];}return false;}

export class MapPackageError extends Error{
  constructor(code,message,{retryable=false,cause=null}={}){super(message,{cause});this.name='MapPackageError';this.code=code;this.retryable=Boolean(retryable);}
}
export function normalizeMapPackageError(error,fallbackCode='MAP_RECOVERY_FAILED'){
  if(error instanceof MapPackageError)return error;
  if(error?.code==='ENOSPC')return new MapPackageError('MAP_DISK_FULL','Espaço em disco insuficiente para concluir o mapa.',{retryable:true,cause:error});
  const retryable=new Set(['MAP_CATALOG_UNAVAILABLE','MAP_SOURCE_UNAVAILABLE','MAP_EXTRACT_FAILED']);
  return new MapPackageError(fallbackCode,error?.message||'Falha no gerenciamento do mapa.',{retryable:retryable.has(fallbackCode),cause:error});
}

export function createMapPackageManager({dataDir,fetchImpl=globalThis.fetch,execFileImpl=execFileAsync,platform=process.platform,arch=process.arch,now=()=>new Date()}={}){
  if(typeof dataDir!=='string'||!dataDir.trim())throw new TypeError('dataDir is required.');
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required.');
  const root=resolve(dataDir,'maps'),tools=join(root,'tools'),packages=join(root,'packages'),catalogPath=join(root,'catalog.json');
  const cliDir=join(tools,`pmtiles-${PMTILES_VERSION}`),cliPath=join(cliDir,'pmtiles.exe');
  let catalogCache=null,initPromise=null,recoveryIssues=[];
  const active=new Set();
  const journalPath=id=>join(packages,`${id}.transaction.json`);
  const writeJournal=(id,value)=>atomicJson(journalPath(id),{version:1,id,...value});
  const localName=value=>{const raw=String(value??''),name=basename(raw);if(!name||name!==raw)throw new MapPackageError('MAP_RECOVERY_FAILED','Registro de recuperação contém caminho inválido.');return name;};
  const addRecoveryIssue=issue=>{const normalized=Object.freeze({code:String(issue.code??'MAP_RECOVERY_FAILED'),id:String(issue.id??''),message:String(issue.message??'Falha de recuperação de mapa.')});if(!recoveryIssues.some(current=>current.code===normalized.code&&current.id===normalized.id&&current.message===normalized.message))recoveryIssues.push(normalized);};

  async function reconcilePackages(){
    recoveryIssues=[];const names=await readdir(packages),referencedTemps=new Set();
    for(const name of names.filter(value=>value.endsWith('.transaction.json'))){
      const path=join(packages,name);
      try{
        const record=JSON.parse(await readFile(path,'utf8'));
        if(record?.version!==1||typeof record.id!=='string'||!record.id)throw new Error('unsupported transaction journal');
        const finalFile=localName(record.finalFile),backupFile=localName(record.backupFile),tempFile=localName(record.tempFile),metadataFile=localName(record.metadataFile);
        referencedTemps.add(tempFile);
        const finalPath=join(packages,finalFile),backupPath=join(packages,backupFile),tempPath=join(packages,tempFile),metadataPath=join(packages,metadataFile);
        let finalExists=await exists(finalPath),backupExists=await exists(backupPath);
        if(!finalExists&&backupExists){await rename(backupPath,finalPath);finalExists=true;backupExists=false;}
        if(finalExists&&backupExists&&await exists(metadataPath)){await rm(backupPath,{force:true});backupExists=false;}
        await rm(tempPath,{force:true});
        if(finalExists)await rm(path,{force:true});else addRecoveryIssue({code:'MAP_RECOVERY_FAILED',id:record.id,message:'Não foi possível restaurar o pacote offline.'});
      }catch(error){addRecoveryIssue({code:'MAP_RECOVERY_FAILED',id:name.replace('.transaction.json',''),message:error?.message||'Registro de recuperação inválido.'});}
    }
    for(const name of names.filter(value=>/\.part-[^/]*\.pmtiles$/.test(value)))if(!referencedTemps.has(name))await rm(join(packages,name),{force:true});
  }
  async function init(){await Promise.all([mkdir(tools,{recursive:true}),mkdir(packages,{recursive:true})]);if(!initPromise)initPromise=reconcilePackages();await initPromise;}
  async function loadCachedCatalog(){if(catalogCache)return catalogCache;if(await exists(catalogPath)){try{catalogCache=validateMapManifest(JSON.parse(await readFile(catalogPath,'utf8')))}catch{catalogCache=null}}return catalogCache;}
  async function refreshCatalog(url=DEFAULT_MANIFEST_URL){
    await init();let response;try{response=await fetchImpl(url,{redirect:'follow'})}catch(error){throw normalizeMapPackageError(error,'MAP_CATALOG_UNAVAILABLE')}
    if(!response.ok)throw new MapPackageError('MAP_CATALOG_UNAVAILABLE',`Catálogo de mapas indisponível (${response.status}).`,{retryable:true});
    let value;try{value=validateMapManifest(await response.json())}catch(error){throw new MapPackageError('MAP_CATALOG_INVALID','O catálogo de mapas recebido é inválido.',{cause:error})}
    await atomicJson(catalogPath,value);catalogCache=value;return value;
  }
  async function planFarmMap({farmUnitId,farmName=null,bounds,profile='detailed'}={}){
    const checkedBounds=ensureBounds(bounds),manifest=(await loadCachedCatalog())??await refreshCatalog();
    const plan=buildRegionalMapPlan({areaId:farmUnitId,areaName:farmName,bounds:checkedBounds,manifest,profile,releaseBaseUrl:releaseBase(manifest.releaseVersion)});
    const estimatedBytes=Math.max(2_000_000,Math.round((plan.sources[0]?.size??0)*0.05));
    return Object.freeze({...plan,profileLabel:PROFILE_LABELS[profile]??plan.profileLabel,releaseVersion:manifest.releaseVersion,estimatedBytes,outputAsset:`farm-${safeId(farmUnitId)}-${profile}.pmtiles`,attribution:'OpenStreetMap contributors · pacote ArtiSys Mapas Brasil'});
  }
  async function ensureCli(){
    await init();if(await exists(cliPath))return cliPath;
    if(platform!=='win32'||arch!=='x64')throw new MapPackageError('MAP_UNSUPPORTED_RUNTIME','A instalação de mapas offline está disponível no aplicativo desktop Windows x64.');
    await mkdir(cliDir,{recursive:true});let response;try{response=await fetchImpl(WINDOWS_X64_ASSET.url,{redirect:'follow'})}catch(error){throw normalizeMapPackageError(error,'MAP_SOURCE_UNAVAILABLE')}
    if(!response.ok)throw new MapPackageError('MAP_SOURCE_UNAVAILABLE',`Falha ao baixar a ferramenta PMTiles (${response.status}).`,{retryable:true});
    const buffer=Buffer.from(await response.arrayBuffer()),digest=sha256Buffer(buffer);if(digest!==WINDOWS_X64_ASSET.sha256)throw new MapPackageError('MAP_VERIFY_FAILED','O checksum da ferramenta PMTiles não confere.');
    const zipPath=join(cliDir,'pmtiles.zip'),expandDir=join(cliDir,'expanded');await writeFile(zipPath,buffer);await rm(expandDir,{recursive:true,force:true});await mkdir(expandDir,{recursive:true});
    await execFileImpl('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${zipPath.replaceAll("'","''")}' -DestinationPath '${expandDir.replaceAll("'","''")}' -Force`],{windowsHide:true});
    const candidates=[join(expandDir,'pmtiles.exe'),join(expandDir,'pmtiles')];let source=null;for(const candidate of candidates)if(await exists(candidate)){source=candidate;break;}if(!source)throw new MapPackageError('MAP_VERIFY_FAILED','O executável PMTiles não foi encontrado no arquivo verificado.');
    await rename(source,cliPath);await rm(zipPath,{force:true});await rm(expandDir,{recursive:true,force:true});return cliPath;
  }
  async function installed(){
    await init();const names=(await readdir(packages)).filter(name=>name.endsWith('.json')&&!name.endsWith('.transaction.json')).sort(),values=[];
    for(const name of names){const id=name.slice(0,-5);try{const metadata=JSON.parse(await readFile(join(packages,name),'utf8')),fileName=localName(metadata.fileName),filePath=join(packages,fileName);let health='missing';if(await exists(filePath)){const info=await stat(filePath);if(metadata.metadataVersion!==1||typeof metadata.sha256!=='string'||!/^[a-f0-9]{64}$/.test(metadata.sha256))health='unverified';else if(!Number.isFinite(Number(metadata.size))||info.size!==Number(metadata.size))health='corrupt';else if(newerRelease(catalogCache?.releaseVersion,metadata.catalogVersion))health='outdated';else health='healthy';}values.push(Object.freeze({...metadata,health}));}catch(error){addRecoveryIssue({code:'MAP_PACKAGE_CORRUPT',id,message:error?.message||'Metadados locais do mapa estão corrompidos.'});}}
    return values;
  }
  async function snapshot(){const catalog=await loadCachedCatalog();return Object.freeze({available:platform==='win32'&&arch==='x64',platform,arch,repository:MAP_RELEASE_REPOSITORY,manifestUrl:DEFAULT_MANIFEST_URL,catalogVersion:catalog?.releaseVersion??null,catalogAvailable:Boolean(catalog),catalog:catalog?Object.freeze(catalog):null,installed:Object.freeze(await installed()),recoveryIssues:Object.freeze([...recoveryIssues]),profiles:Object.freeze([{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}])});}
  async function preflight(estimatedBytes){try{const fsInfo=await statfs(packages),available=Number(fsInfo.bavail)*Number(fsInfo.bsize),required=Math.max(150*1024*1024,Number(estimatedBytes??0)*2.2);if(Number.isFinite(available)&&available<required)throw new MapPackageError('MAP_DISK_FULL',`Espaço insuficiente: ${Math.round(available/1024/1024)} MiB disponíveis, ${Math.round(required/1024/1024)} MiB necessários.`,{retryable:true});return{availableBytes:available,requiredBytes:required};}catch(error){if(error instanceof MapPackageError)throw error;return{availableBytes:null,requiredBytes:null};}}
  async function installFarmMap(input={}){
    await init();const profile=String(input.profile??'detailed'),bounds=ensureBounds(input.bounds),key=`${safeId(input.farmUnitId)}:${profile}`;if(active.has(key))throw new MapPackageError('MAP_INSTALL_IN_PROGRESS','Este mapa da fazenda já está sendo instalado.',{retryable:true});active.add(key);
    let finalPath=null,tempPath=null,backupPath=null,metadataPath=null,recordId=null,metadataCommitted=false,hadFinalAtStart=false;
    try{
      const plan=await planFarmMap({...input,bounds,profile});if(plan.sources.length!==1)throw new MapPackageError('MAP_MULTI_SOURCE_REQUIRED','A propriedade intercepta mais de um pacote regional; selecione ou componha as fontes explicitamente.');
      const source=plan.sources[0],cli=await ensureCli();await preflight(plan.estimatedBytes);recordId=`farm-${safeId(input.farmUnitId)}-${profile}`;finalPath=join(packages,plan.outputAsset);hadFinalAtStart=await exists(finalPath);tempPath=`${finalPath}.part-${process.pid}-${Date.now()}.pmtiles`;backupPath=`${finalPath}.bak`;metadataPath=join(packages,`${recordId}.json`);
      const journalBase={finalFile:basename(finalPath),backupFile:basename(backupPath),tempFile:basename(tempPath),metadataFile:basename(metadataPath),startedAt:now().toISOString()};
      await rm(tempPath,{force:true});try{await execFileImpl(cli,['extract',source.url,tempPath,`--bbox=${plan.bbox}`,`--maxzoom=${plan.maxZoom}`,'--overfetch=0','--download-threads=4'],{windowsHide:true,maxBuffer:8*1024*1024})}catch(error){throw normalizeMapPackageError(error,'MAP_EXTRACT_FAILED')}
      try{await execFileImpl(cli,['verify',tempPath],{windowsHide:true,maxBuffer:8*1024*1024})}catch(error){throw normalizeMapPackageError(error,'MAP_VERIFY_FAILED')}
      const info=await stat(tempPath);if(info.size<=0)throw new MapPackageError('MAP_PACKAGE_EMPTY','O mapa extraído está vazio.');const digest=await sha256File(tempPath);
      await writeJournal(recordId,{...journalBase,stage:'verified-temp'});if(await exists(finalPath)){await rm(backupPath,{force:true});await rename(finalPath,backupPath);await writeJournal(recordId,{...journalBase,stage:'backup-created'});}await rename(tempPath,finalPath);await writeJournal(recordId,{...journalBase,stage:'final-promoted'});
      const record=Object.freeze({metadataVersion:1,id:recordId,farmUnitId:String(input.farmUnitId),farmName:input.farmName??null,profile,profileLabel:plan.profileLabel,fileName:basename(finalPath),size:info.size,sha256:digest,verifiedAt:now().toISOString(),catalogVersion:plan.releaseVersion,sourceId:source.id,sourceUrl:source.url,sourceSha256:source.sha256,bounds:Object.freeze([...bounds]),minZoom:plan.minZoom,maxZoom:plan.maxZoom,attribution:plan.attribution,installedAt:now().toISOString()});
      await atomicJson(metadataPath,record);metadataCommitted=true;await writeJournal(recordId,{...journalBase,stage:'metadata-written'});await rm(backupPath,{force:true});await rm(journalPath(recordId),{force:true});return record;
    }catch(error){if(backupPath&&await exists(backupPath)&&!metadataCommitted){if(finalPath&&await exists(finalPath))await rm(finalPath,{force:true});await rename(backupPath,finalPath);if(recordId)await rm(journalPath(recordId),{force:true});}else if(!metadataCommitted&&!hadFinalAtStart&&finalPath&&await exists(finalPath)&&!(backupPath&&await exists(backupPath))){await rm(finalPath,{force:true});}if(tempPath)await rm(tempPath,{force:true});throw normalizeMapPackageError(error,'MAP_EXTRACT_FAILED');}finally{active.delete(key);}
  }
  async function verifyFarmMap({id}={}){await init();const clean=safeId(id),metadataPath=join(packages,`${clean}.json`);if(!(await exists(metadataPath)))throw new MapPackageError('MAP_PACKAGE_MISSING','Metadados do mapa local não foram encontrados.');let metadata;try{metadata=JSON.parse(await readFile(metadataPath,'utf8'))}catch(error){throw new MapPackageError('MAP_PACKAGE_CORRUPT','Metadados locais do mapa estão corrompidos.',{cause:error})}let fileName;try{fileName=localName(metadata.fileName)}catch(error){throw new MapPackageError('MAP_PACKAGE_CORRUPT','Metadados locais do mapa contêm caminho inválido.',{cause:error})}const filePath=join(packages,fileName);if(!(await exists(filePath)))return Object.freeze({...metadata,health:'missing'});const cli=await ensureCli();try{await execFileImpl(cli,['verify',filePath],{windowsHide:true,maxBuffer:8*1024*1024})}catch{return Object.freeze({...metadata,health:'corrupt',errorCode:'MAP_PACKAGE_CORRUPT'})}const info=await stat(filePath);if(metadata.metadataVersion===1&&Number.isFinite(Number(metadata.size))&&Number(metadata.size)!==info.size)return Object.freeze({...metadata,health:'corrupt',errorCode:'MAP_PACKAGE_CORRUPT'});const digest=await sha256File(filePath);if(metadata.sha256&&metadata.sha256!==digest)return Object.freeze({...metadata,health:'corrupt',errorCode:'MAP_PACKAGE_CORRUPT'});const catalog=await loadCachedCatalog(),upgraded={...metadata,metadataVersion:1,size:info.size,sha256:digest,verifiedAt:now().toISOString(),catalogVersion:metadata.catalogVersion??catalog?.releaseVersion??null};await atomicJson(metadataPath,upgraded);return Object.freeze({...upgraded,health:newerRelease(catalog?.releaseVersion,upgraded.catalogVersion)?'outdated':'healthy'});}
  async function removeFarmMap({id}={}){await init();const clean=safeId(id);if(!clean.startsWith('farm-'))throw new TypeError('Valid farm map id is required.');const metadataPath=join(packages,`${clean}.json`);if(!(await exists(metadataPath)))return{removed:false,id:clean};const metadata=JSON.parse(await readFile(metadataPath,'utf8'));await rm(join(packages,basename(metadata.fileName)),{force:true});await rm(metadataPath,{force:true});return{removed:true,id:clean};}
  return Object.freeze({snapshot,refreshCatalog,planFarmMap,installFarmMap,verifyFarmMap,removeFarmMap,ensureCli,manifestUrl:DEFAULT_MANIFEST_URL});
}
export const MAP_PACKAGE_CONSTANTS=Object.freeze({PMTILES_VERSION,WINDOWS_X64_ASSET,DEFAULT_MANIFEST_URL});
