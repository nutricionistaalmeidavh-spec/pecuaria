const {contextBridge,ipcRenderer}=require('electron');
const call=(n,p)=>ipcRenderer.invoke(`artisys:${n}`,p);
let currentAuth=null;
let editionFeatures=null;
const applyEditionContext=meta=>{
  const edition=meta?.edition?.id??'pro',features=Array.isArray(meta?.edition?.features)?meta.edition.features:[];
  editionFeatures=new Set(features);
  if(typeof document!=='undefined'){
    document.documentElement.dataset.edition=edition;
    document.documentElement.dataset.editionFeatures=features.join(',');
  }
  return meta;
};
const featureEnabled=feature=>editionFeatures==null||editionFeatures.has(feature);
const updates=Object.freeze({
  state:async()=>{const state=await ipcRenderer.invoke('artisys:updates:state');if(typeof document!=='undefined'&&state?.currentVersion)document.documentElement.dataset.appVersion=state.currentVersion;return state},
  check:()=>ipcRenderer.invoke('artisys:updates:check'),
  download:()=>ipcRenderer.invoke('artisys:updates:download'),
  install:()=>ipcRenderer.invoke('artisys:updates:install'),
  onStatus:handler=>{
    if(typeof handler!=='function')throw new TypeError('handler must be a function');
    const listener=(_event,state)=>{if(typeof document!=='undefined'&&state?.currentVersion)document.documentElement.dataset.appVersion=state.currentVersion;handler(state)};
    ipcRenderer.on('artisys:updates:status',listener);
    return()=>ipcRenderer.removeListener('artisys:updates:status',listener);
  }
});
const licensing=Object.freeze({
  state:()=>ipcRenderer.invoke('artisys:license:state'),
  install:token=>ipcRenderer.invoke('artisys:license:install',{token}),
  remove:()=>ipcRenderer.invoke('artisys:license:remove')
});
const names=['authState','bootstrap','validate','search','alerts','audit','insights','simulateSale','references','load','action'];
const api=Object.fromEntries(names.map(n=>[n,p=>call(n,p)]));
api.describe=async p=>applyEditionContext(await call('describe',p));
api.reproductionAdmin=p=>p?.operation==='state'&&!featureEnabled('reproduction.pro')?Promise.resolve(null):call('reproductionAdmin',p);
api.userAdmin=p=>p?.operation==='state'&&!featureEnabled('user.admin')?Promise.resolve(null):call('userAdmin',p);
api.fieldSync=p=>p?.operation==='state'&&!featureEnabled('field.offline')?Promise.resolve(null):call('fieldSync',p);
api.login=async input=>{const result=await call('login',input);currentAuth={sessionId:result.session.id,token:result.token};return result;};
api.logout=async auth=>{try{return await call('logout',auth??currentAuth)}finally{currentAuth=null;editionFeatures=null;}};
api.maps=payload=>call('maps',{...(payload??{}),auth:payload?.auth??currentAuth});
contextBridge.exposeInMainWorld('artisys',Object.freeze({...api,updates,licensing}));
