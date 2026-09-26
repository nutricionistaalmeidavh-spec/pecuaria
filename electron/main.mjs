import {app,BrowserWindow,ipcMain} from 'electron';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {loadDesktopEntitlementOptions} from '../runtime/desktop-license-config.mjs';
import {installStoredLicense,storedLicenseState} from '../runtime/license-store.mjs';
import {createUpdateController} from './updater.mjs';

const here=dirname(fileURLToPath(import.meta.url));
if(process.env.ARTISYS_E2E_USER_DATA)app.setPath('userData',process.env.ARTISYS_E2E_USER_DATA);
let host;
let win;
let updates;

const openWindow=({file,width=1440,height=900,minWidth=1024,minHeight=680}={})=>{
  win=new BrowserWindow({width,height,minWidth,minHeight,show:false,webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  return win.loadFile(file).then(()=>{win.once('ready-to-show',()=>win.show());return win});
};

app.whenReady().then(async()=>{
  const dataDir=join(app.getPath('userData'),'data');
  const bundledPublicKeyPath=join(here,'../branding/license-public.pem');
  const entitlement=await loadDesktopEntitlementOptions({dataDir,bundledPublicKeyPath});

  ipcMain.handle('artisys:license:state',async()=>{
    try{
      const state=await storedLicenseState({dataDir,publicKey:entitlement.licensePublicKey,edition:entitlement.edition,licenseRequired:entitlement.licenseRequired,deviceId:entitlement.deviceId});
      return{present:state.present,enforced:state.enforced,edition:state.access.edition,licensed:state.access.licensed,features:state.access.features,licenseRequired:entitlement.licenseRequired};
    }catch(error){
      if(['LICENSE_REQUIRED','LICENSE_INVALID'].includes(error?.code))return{present:false,enforced:true,edition:null,licensed:false,features:[],licenseRequired:true,error:error.message};
      throw error;
    }
  });
  ipcMain.handle('artisys:license:install',async(_event,input={})=>{
    const access=await installStoredLicense({dataDir,token:input.token,publicKey:entitlement.licensePublicKey,deviceId:entitlement.deviceId});
    return{edition:access.edition,licensed:access.licensed,features:access.features,restartRequired:true};
  });
  ipcMain.handle('artisys:license:restart',async()=>{app.relaunch();app.exit(0);return{restarting:true}});

  try{
    host=await createStandaloneHost({dataDir,...entitlement});
  }catch(error){
    if(!['LICENSE_REQUIRED','LICENSE_INVALID'].includes(error?.code))throw error;
    await openWindow({file:join(here,'activation.html'),width:680,height:620,minWidth:560,minHeight:520});
    return;
  }

  for(const n of ['describe','authState','bootstrap','login','validate','logout','search','alerts','audit','insights','simulateSale','reproductionAdmin','userAdmin','fieldSync','references','load','action','maps'])ipcMain.handle(`artisys:${n}`,(_e,p)=>host.backend[n](p));
  await openWindow({file:join(here,'../dist/index.html')});
  updates=createUpdateController({ipcMain,getWebContents:()=>win?.webContents??null});
  if(process.env.ARTISYS_DISABLE_UPDATES!=='1')setTimeout(()=>void updates.check(),4000);
});

app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('before-quit',()=>void host?.close?.());
