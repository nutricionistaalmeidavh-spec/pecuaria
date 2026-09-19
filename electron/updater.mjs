import {app} from 'electron';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {autoUpdater}=require('electron-updater');

const initialState=()=>({status:'idle',currentVersion:app.getVersion(),availableVersion:null,progress:null,error:null});

export function createUpdateController({ipcMain,getWebContents}={}){
  if(!ipcMain?.handle)throw new TypeError('ipcMain is required.');
  if(typeof getWebContents!=='function')throw new TypeError('getWebContents is required.');

  autoUpdater.autoDownload=false;
  autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.allowPrerelease=false;
  autoUpdater.allowDowngrade=false;

  let state=initialState();
  const publish=patch=>{
    state=Object.freeze({...state,...patch});
    const target=getWebContents();
    if(target&&!target.isDestroyed?.())target.send('artisys:updates:status',state);
    return state;
  };

  autoUpdater.on('checking-for-update',()=>publish({status:'checking',error:null,progress:null}));
  autoUpdater.on('update-available',info=>publish({status:'available',availableVersion:info?.version??null,error:null,progress:null}));
  autoUpdater.on('update-not-available',()=>publish({status:'current',availableVersion:null,error:null,progress:null}));
  autoUpdater.on('download-progress',progress=>publish({status:'downloading',progress:{percent:Number(progress?.percent??0),transferred:Number(progress?.transferred??0),total:Number(progress?.total??0)},error:null}));
  autoUpdater.on('update-downloaded',info=>publish({status:'downloaded',availableVersion:info?.version??state.availableVersion,progress:{percent:100},error:null}));
  autoUpdater.on('error',error=>publish({status:'error',error:String(error?.message??error),progress:null}));

  async function check(){
    if(!app.isPackaged)return publish({status:'development',error:null});
    try{
      publish({status:'checking',error:null});
      await autoUpdater.checkForUpdates();
      return state;
    }catch(error){return publish({status:'error',error:String(error?.message??error)})}
  }

  async function download(){
    if(state.status!=='available'&&state.status!=='error')throw new Error('No update is ready to download.');
    publish({status:'downloading',error:null,progress:{percent:0}});
    await autoUpdater.downloadUpdate();
    return state;
  }

  function install(){
    if(state.status!=='downloaded')throw new Error('Update has not finished downloading.');
    autoUpdater.quitAndInstall(false,true);
    return{status:'installing'};
  }

  ipcMain.handle('artisys:updates:state',()=>state);
  ipcMain.handle('artisys:updates:check',()=>check());
  ipcMain.handle('artisys:updates:download',()=>download());
  ipcMain.handle('artisys:updates:install',()=>install());

  return Object.freeze({check,download,install,getState:()=>state,autoDownload:autoUpdater.autoDownload,autoInstallOnAppQuit:autoUpdater.autoInstallOnAppQuit});
}
