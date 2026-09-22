import {test,expect} from '@playwright/test';
import {login,navigate,seedFarm,seedLot,seedAnimal,openDbRecord} from './operational-helpers.mjs';

test('P0 organiza áreas críticas e protege a pesagem de curral',async({page})=>{
  await login(page);
  await seedFarm(page);
  await seedLot(page,{id:'lot-p0'});
  await seedAnimal(page,{id:'cow-p0',tag:'COW-P0',lotId:'lot-p0'});

  await navigate(page,'animals');
  await expect(page.getByTestId('animal-operations')).toBeVisible();
  await page.getByTestId('animal-operation-search').fill('COW-P0');
  await page.locator('.animal-select-row').filter({hasText:'COW-P0'}).getByRole('checkbox').check();
  await expect(page.getByTestId('animal-selection-count')).toContainText('1 selecionado');
  await expect(page.getByRole('button',{name:'Mover selecionado'})).toBeEnabled();

  await navigate(page,'weights');
  await page.getByTestId('corral-identifier').fill('COW-P0');
  await page.getByTestId('corral-identifier').press('Enter');
  await page.getByTestId('corral-weight').fill('2000');
  await expect(page.getByTestId('weight-anomaly')).toBeVisible();
  await page.getByRole('button',{name:'Confirmar peso atípico'}).click();
  await page.getByRole('button',{name:'Registrar e próximo'}).click();
  await expect.poll(async()=>{const row=await openDbRecord(page,'cattle.animals','cow-p0');return row?.payload?.weights?.at(-1)?.weightKg}).toBe(2000);

  for(const [screen,testId] of [['sanitary','sanitary-tabs'],['reproduction','reproduction-tabs'],['finance','finance-admin-tabs'],['pastures','pasture-tabs'],['settings','settings-tabs']]){
    await navigate(page,screen);
    await expect(page.getByTestId(testId)).toBeVisible();
  }

  await navigate(page,'trades');
  await expect(page.getByTestId('trade-live-summary')).toBeVisible();

  await navigate(page,'tasks');
  await expect(page.getByTestId('field-action-groups')).toBeVisible();
  await expect(page.getByTestId('field-sync-status')).toBeVisible();
});
