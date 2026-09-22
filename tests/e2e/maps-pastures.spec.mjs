import {test,expect} from '@playwright/test';

const password='Maps-E2E-2026!';
async function login(page){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('Gestão Pecuária')).toBeVisible();
}

test('pastures preserves schematic fallback and exposes geographic map, editor and browser offline state',async({page},testInfo)=>{
  await login(page);
  await page.getByTestId('nav-pastures').click();
  await expect(page.getByTestId('pasture-local-map')).toBeVisible();
  await page.getByTestId('map-mode-geographic').click();
  await expect(page.getByTestId('cattle-map')).toBeVisible();
  await expect(page.getByTestId('offline-maps-workspace')).toBeVisible();
  await expect(page.getByText('Somente no desktop Windows').first()).toBeVisible();
  await page.getByTestId('open-map-editor').click();
  await expect(page.getByTestId('cattle-map-editor')).toBeVisible();
  await expect(page.getByLabel('GeoJSON')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('pastures-geographic-map.png'),fullPage:true});
  await page.getByTestId('map-mode-schematic').click();
  await expect(page.getByTestId('pasture-local-map')).toBeVisible();
});

test('authenticated browser maps persist spatial point across reload',async({page})=>{
  await login(page);
  await page.evaluate(async()=>globalThis.artisys.maps({operation:'savePoint',input:{id:'water-e2e',kind:'water',name:'Bebedouro QA',farmUnitId:'farm-e2e',longitude:-47.9,latitude:-21.2}}));
  await page.getByTestId('nav-pastures').click();
  await page.getByTestId('map-mode-geographic').click();
  await expect(page.getByText('Bebedouro QA')).toBeVisible();
  await page.reload();
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('nav-pastures').click();
  await page.getByTestId('map-mode-geographic').click();
  await expect(page.getByText('Bebedouro QA')).toBeVisible();
});
