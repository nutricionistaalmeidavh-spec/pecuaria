import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {resolveProductAccess} from './license.mjs';

const LICENSE_FILE='license.token';
const ENFORCEMENT_FILE='license.enforced';
const cleanToken=value=>typeof value==='string'?value.trim():'';
const exists=async path=>{try{await readFile(path,'utf8');return true}catch(error){if(error?.code==='ENOENT')return false;throw error}};

export async function readStoredLicenseToken(dataDir){
  if(!dataDir)throw new TypeError('dataDir is required');
  try{return cleanToken(await readFile(join(dataDir,LICENSE_FILE),'utf8'))||null}catch(error){if(error?.code==='ENOENT')return null;throw error}
}

export async function isStoredLicenseEnforced(dataDir){
  if(!dataDir)throw new TypeError('dataDir is required');
  return exists(join(dataDir,ENFORCEMENT_FILE));
}

export async function loadStoredProductAccess({
  dataDir,publicKey=null,edition='pro',licenseRequired=false,deviceId=null,now=null
}={}){
  const [token,enforced]=await Promise.all([readStoredLicenseToken(dataDir),isStoredLicenseEnforced(dataDir)]);
  return resolveProductAccess({
    edition,licenseToken:token,licensePublicKey:publicKey,
    licenseRequired:licenseRequired||enforced,deviceId,now
  });
}

export async function installStoredLicense({dataDir,token,publicKey,deviceId=null,now=null}={}){
  if(!dataDir)throw new TypeError('dataDir is required');
  const normalized=cleanToken(token);
  if(!normalized)throw new TypeError('license token is required');
  const access=resolveProductAccess({
    licenseToken:normalized,licensePublicKey:publicKey,
    licenseRequired:true,deviceId,now
  });
  await mkdir(dataDir,{recursive:true});
  const marker=join(dataDir,ENFORCEMENT_FILE),target=join(dataDir,LICENSE_FILE),temporary=join(dataDir,`${LICENSE_FILE}.${process.pid}.${Date.now()}.tmp`);
  const hadMarker=await isStoredLicenseEnforced(dataDir);
  if(!hadMarker)await writeFile(marker,'1\n',{encoding:'utf8',mode:0o600});
  try{
    await writeFile(temporary,`${normalized}\n`,{encoding:'utf8',mode:0o600});
    await rename(temporary,target);
  }catch(error){
    await rm(temporary,{force:true}).catch(()=>{});
    if(!hadMarker)await rm(marker,{force:true}).catch(()=>{});
    throw error;
  }
  return access;
}

export async function removeStoredLicense({dataDir}={}){
  if(!dataDir)throw new TypeError('dataDir is required');
  await rm(join(dataDir,LICENSE_FILE),{force:true});
  return true;
}

export async function storedLicenseState({dataDir,publicKey=null,edition='pro',licenseRequired=false,deviceId=null,now=null}={}){
  const [token,enforced]=await Promise.all([readStoredLicenseToken(dataDir),isStoredLicenseEnforced(dataDir)]);
  if(!token)return Object.freeze({present:false,enforced,access:resolveProductAccess({edition,licenseRequired:licenseRequired||enforced})});
  const access=resolveProductAccess({licenseToken:token,licensePublicKey:publicKey,licenseRequired:licenseRequired||enforced,deviceId,now});
  return Object.freeze({present:true,enforced,access});
}

export const STORED_LICENSE_FILENAME=LICENSE_FILE;
export const STORED_LICENSE_ENFORCEMENT_FILENAME=ENFORCEMENT_FILE;
