import {readFile} from 'node:fs/promises';
import {readStoredLicenseToken} from './license-store.mjs';

async function readOptional(path){
  if(!path)return null;
  try{return (await readFile(path,'utf8')).trim()||null}catch(error){if(error?.code==='ENOENT')return null;throw error}
}

export async function loadTrustedLicensePublicKey({env=process.env,bundledPublicKeyPath=null}={}){
  if(env.ARTISYS_LICENSE_PUBLIC_KEY?.trim())return env.ARTISYS_LICENSE_PUBLIC_KEY.trim();
  if(env.ARTISYS_LICENSE_PUBLIC_KEY_FILE?.trim()){
    const fromEnv=await readOptional(env.ARTISYS_LICENSE_PUBLIC_KEY_FILE.trim());
    if(fromEnv)return fromEnv;
  }
  return readOptional(bundledPublicKeyPath);
}

export async function loadDesktopEntitlementOptions({dataDir,env=process.env,bundledPublicKeyPath=null}={}){
  if(!dataDir)throw new TypeError('dataDir is required');
  const licenseToken=await readStoredLicenseToken(dataDir);
  const licensePublicKey=await loadTrustedLicensePublicKey({env,bundledPublicKeyPath});
  return Object.freeze({
    edition:env.ARTISYS_EDITION?.trim()||'pro',
    licenseToken,
    licensePublicKey,
    licenseRequired:env.ARTISYS_LICENSE_REQUIRED==='1',
    deviceId:env.ARTISYS_DEVICE_ID?.trim()||null
  });
}
