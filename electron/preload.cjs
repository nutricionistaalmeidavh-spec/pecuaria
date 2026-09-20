const {contextBridge,ipcRenderer}=require('electron');
const call=(n,p)=>ipcRenderer.invoke(`artisys:${n}`,p);
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
contextBridge.exposeInMainWorld('artisys',Object.freeze({...Object.fromEntries(['describe','authState','bootstrap','login','validate','logout','search','alerts','audit','insights','simulateSale','reproductionAdmin','userAdmin','fieldSync','references','load','action'].map(n=>[n,p=>call(n,p)])),updates}));
