import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {resolveProductAccess} from './license.mjs';

const LICENSE_FILE='license.token';
const cleanToken=value=>typeof value==='string'?value.trim():'';

export async function readStoredLicenseToken(dataDir){
  if(!dataDir)throw new TypeError('dataDir is required');
  try{return cleanToken(await readFile(join(dataDir,LICENSE_FILE),'utf8'))||null}catch(error){if(error?.code==='ENOENT')return null;throw error}
}

export async function loadStoredProductAccess({
  dataDir,publicKey=null,edition='pro',licenseRequired=false,deviceId=null,now=null
}={}){
  const token=await readStoredLicenseToken(dataDir);
  return resolveProductAccess({
    edition,licenseToken:token,licensePublicKey:publicKey,
    licenseRequired,deviceId,now
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
  await writeFile(join(dataDir,LICENSE_FILE),`${normalized}\n`,{encoding:'utf8',mode:0o600});
  return access;
}

export async function removeStoredLicense({dataDir}={}){
  if(!dataDir)throw new TypeError('dataDir is required');
  await rm(join(dataDir,LICENSE_FILE),{force:true});
  return true;
}

export async function storedLicenseState({dataDir,publicKey=null,edition='pro',licenseRequired=false,deviceId=null,now=null}={}){
  const token=await readStoredLicenseToken(dataDir);
  if(!token)return Object.freeze({present:false,access:resolveProductAccess({edition,licenseRequired:false})});
  const access=resolveProductAccess({licenseToken:token,licensePublicKey:publicKey,licenseRequired,deviceId,now});
  return Object.freeze({present:true,access});
}

export const STORED_LICENSE_FILENAME=LICENSE_FILE;
