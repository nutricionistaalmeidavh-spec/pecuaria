import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const password='Electron-Maps-2026!';

test('Electron maps cross renderer preload IPC and persist local spatial data offline',async()=>{
  const userData=await mkdtemp(join(tmpdir(),'pecuaria-electron-maps-'));
  const app=await electron.launch({args:['.'],env:{...process.env,ARTISYS_E2E_USER_DATA:userData,ARTISYS_DISABLE_UPDATES:'1'}});
  try{
    const page=await app.firstWindow();
    await page.getByTestId('password').fill(password);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByText('Gestão Pecuária')).toBeVisible();
    const state=await page.evaluate(()=>globalThis.artisys.maps({operation:'state'}));
    expect(state.provider.platform).toBe(process.platform);
    await page.evaluate(()=>globalThis.artisys.maps({operation:'savePoint',input:{id:'electron-water',kind:'water',name:'Bebedouro Electron',farmUnitId:'farm-electron',longitude:-47.9,latitude:-21.2}}));
    await page.getByTestId('nav-pastures').click();
    await page.getByTestId('map-mode-geographic').click();
    await expect(page.getByText('Bebedouro Electron')).toBeVisible();
    await page.context().setOffline(true);
    await expect(page.getByTestId('cattle-map')).toBeVisible();
    await page.context().setOffline(false);
    await page.reload();
    await page.getByTestId('password').fill(password);
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('nav-pastures').click();
    await page.getByTestId('map-mode-geographic').click();
    await expect(page.getByText('Bebedouro Electron')).toBeVisible();
  }finally{await app.close();}
});
