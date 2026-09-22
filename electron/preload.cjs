const {contextBridge,ipcRenderer}=require('electron');
const call=(n,p)=>ipcRenderer.invoke(`artisys:${n}`,p);
let currentAuth=null;
const updates=Object.freeze({
  state:()=>ipcRenderer.invoke('artisys:updates:state'),
  check:()=>ipcRenderer.invoke('artisys:updates:check'),
  download:()=>ipcRenderer.invoke('artisys:updates:download'),
  install:()=>ipcRenderer.invoke('artisys:updates:install'),
  onStatus:handler=>{
    if(typeof handler!=='function')throw new TypeError('handler must be a function');
    const listener=(_event,state)=>handler(state);
    ipcRenderer.on('artisys:updates:status',listener);
    return()=>ipcRenderer.removeListener('artisys:updates:status',listener);
  }
});
const names=['describe','authState','bootstrap','validate','search','alerts','audit','insights','simulateSale','reproductionAdmin','userAdmin','fieldSync','references','load','action'];
const api=Object.fromEntries(names.map(n=>[n,p=>call(n,p)]));
api.login=async input=>{const result=await call('login',input);currentAuth={sessionId:result.session.id,token:result.token};return result;};
api.logout=async auth=>{try{return await call('logout',auth??currentAuth)}finally{currentAuth=null;}};
api.maps=payload=>call('maps',{...(payload??{}),auth:payload?.auth??currentAuth});
contextBridge.exposeInMainWorld('artisys',Object.freeze({...api,updates}));
