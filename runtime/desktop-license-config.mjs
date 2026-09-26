import {access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isStoredLicenseEnforced,readStoredLicenseToken} from './license-store.mjs';

const DB_FILE='artisys-pecuaria.sqlite';
async function readOptional(path){
  if(!path)return null;
  try{return (await readFile(path,'utf8')).trim()||null}catch(error){if(error?.code==='ENOENT')return null;throw error}
}
const exists=async path=>{try{await access(path);return true}catch(error){if(error?.code==='ENOENT')return false;throw error}};

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
  const [licenseToken,licensePublicKey,enforced,legacyDatabase]=await Promise.all([
    readStoredLicenseToken(dataDir),
    loadTrustedLicensePublicKey({env,bundledPublicKeyPath}),
    isStoredLicenseEnforced(dataDir),
    exists(join(dataDir,DB_FILE))
  ]);
  const explicit=env.ARTISYS_LICENSE_REQUIRED;
  const licenseRequired=explicit==='1'?true:explicit==='0'?false:env.ARTISYS_E2E_USER_DATA?false:(enforced||!legacyDatabase);
  return Object.freeze({
    edition:env.ARTISYS_EDITION?.trim()||'pro',
    licenseToken,
    licensePublicKey,
    licenseRequired,
    legacyCompatibility:legacyDatabase&&!enforced&&!licenseToken,
    deviceId:env.ARTISYS_DEVICE_ID?.trim()||null
  });
}
