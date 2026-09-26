import {sign,verify} from 'node:crypto';

const obj=(value,name)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${name} must be an object`);
  return value;
};
const encode=value=>Buffer.from(value).toString('base64url');
const decode=value=>Buffer.from(value,'base64url');

export function createLicensePayload(value){
  obj(value,'license payload');
  for(const key of ['licenseId','product','customerId','issuedAt']){
    if(typeof value[key]!=='string'||!value[key].trim())throw new TypeError(`${key} is required`);
  }
  if(Number.isNaN(Date.parse(value.issuedAt)))throw new TypeError('issuedAt is invalid');
  if(value.expiresAt!=null&&Number.isNaN(Date.parse(value.expiresAt)))throw new TypeError('expiresAt is invalid');
  return{
    licenseId:value.licenseId,
    product:value.product,
    customerId:value.customerId,
    issuedAt:value.issuedAt,
    expiresAt:value.expiresAt??null,
    deviceIds:[...(value.deviceIds??[])],
    features:[...(value.features??[])]
  };
}

export function signLicense(payload,privateKey){
  const normalized=createLicensePayload(payload);
  const body=encode(JSON.stringify(normalized));
  const signature=sign(null,Buffer.from(body),privateKey).toString('base64url');
  return `${body}.${signature}`;
}

export function verifyLicense(token,publicKey,options={}){
  try{
    const [body,signature,...rest]=String(token).split('.');
    if(!body||!signature||rest.length)return{valid:false,reason:'malformed',payload:null};
    if(!verify(null,Buffer.from(body),publicKey,decode(signature)))return{valid:false,reason:'signature',payload:null};
    const payload=createLicensePayload(JSON.parse(decode(body).toString('utf8')));
    const now=new Date(options.now??Date.now());
    if(payload.expiresAt&&now>new Date(payload.expiresAt))return{valid:false,reason:'expired',payload};
    if(options.product&&payload.product!==options.product)return{valid:false,reason:'product-mismatch',payload};
    if(options.deviceId&&payload.deviceIds.length&&!payload.deviceIds.includes(options.deviceId))return{valid:false,reason:'device-mismatch',payload};
    return{valid:true,reason:'ok',payload};
  }catch{
    return{valid:false,reason:'malformed',payload:null};
  }
}

export function isFeatureEnabled(payload,feature){
  return Array.isArray(payload?.features)&&payload.features.includes(feature);
}
