import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {attachBrowserMaps} from './maps/browser-runtime.js';

function withAuthenticatedMaps(backend){
  let currentAuth=null;
  let editionFeatures=null;
  const featureEnabled=feature=>editionFeatures==null||editionFeatures.has(feature);
  const applyEditionContext=meta=>{
    const edition=meta?.edition?.id??'pro',features=Array.isArray(meta?.edition?.features)?meta.edition.features:[];
    editionFeatures=new Set(features);
    document.documentElement.dataset.edition=edition;
    document.documentElement.dataset.editionFeatures=features.join(',');
    return meta;
  };
  return Object.freeze({
    ...backend,
    async describe(auth=null){return applyEditionContext(await backend.describe(auth))},
    reproductionAdmin(payload={}){return payload?.operation==='state'&&!featureEnabled('reproduction.pro')?Promise.resolve(null):backend.reproductionAdmin(payload)},
    userAdmin(payload={}){return payload?.operation==='state'&&!featureEnabled('user.admin')?Promise.resolve(null):backend.userAdmin(payload)},
    fieldSync(payload={}){return payload?.operation==='state'&&!featureEnabled('field.offline')?Promise.resolve(null):backend.fieldSync(payload)},
    async login(input){
      const result=await backend.login(input);
      currentAuth={sessionId:result.session.id,token:result.token};
      return result;
    },
    async logout(auth=currentAuth){
      try{return await backend.logout(auth)}finally{currentAuth=null;editionFeatures=null}
    },
    maps(payload={}){
      return backend.maps({...payload,auth:payload.auth??currentAuth});
    }
  });
}

if(!globalThis.artisys){
  const persistence=createBrowserPersistence({productId:'agro-pecuaria'});
  const recovery=createBrowserRecovery(persistence);
  const presentation=createCattlePresentation({persistence,recovery});
  const coreBackend=createRpcBackend({presentation,persistence});
  globalThis.artisys=withAuthenticatedMaps(attachBrowserMaps({coreBackend,presentation,persistence}));
}

await import('./main.jsx');
