import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {attachBrowserMaps} from './maps/browser-runtime.js';

function withAuthenticatedMaps(backend){
  let currentAuth=null;
  return Object.freeze({
    ...backend,
    async login(input){
      const result=await backend.login(input);
      currentAuth={sessionId:result.session.id,token:result.token};
      return result;
    },
    async logout(auth=currentAuth){
      try{return await backend.logout(auth)}finally{currentAuth=null}
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
