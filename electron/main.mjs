import {app,BrowserWindow,ipcMain} from 'electron';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createUpdateController} from './updater.mjs';

const here=dirname(fileURLToPath(import.meta.url));
let host;
let win;
let updates;

app.whenReady().then(async()=>{
  host=await createStandaloneHost({dataDir:join(app.getPath('userData'),'data')});
  for(const n of ['describe','authState','bootstrap','login','validate','logout','search','alerts','references','load','action'])ipcMain.handle(`artisys:${n}`,(_e,p)=>host.backend[n](p));
  win=new BrowserWindow({width:1440,height:900,minWidth:1024,minHeight:680,show:false,webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  updates=createUpdateController({ipcMain,getWebContents:()=>win?.webContents??null});
  await win.loadFile(join(here,'../dist/index.html'));
  win.once('ready-to-show',()=>{
    win.show();
    setTimeout(()=>void updates.check(),4000);
  });
});

app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('before-quit',()=>void host?.close?.());
