import {COMMERCIAL_CATALOG} from './edition-commerce.js';

export function createDistributionManifest({version}={}){
  if(typeof version!=='string'||!version.trim())throw new TypeError('version is required');
  const normalized=version.trim();
  return Object.freeze({
    product:'agro-pecuaria',
    strategy:'single-installer',
    version:normalized,
    editions:Object.freeze(['essential','management','pro']),
    skus:Object.freeze(COMMERCIAL_CATALOG.map(item=>item.sku)),
    artifacts:Object.freeze([
      Object.freeze({
        platform:'windows',arch:'x64',format:'nsis',
        file:`ArtiSys-Pecuaria-Setup-${normalized}.exe`,
        sharedAcrossEditions:true
      })
    ]),
    entitlement:'offline-signed-license',
    requiresEditionSpecificBuild:false
  });
}
