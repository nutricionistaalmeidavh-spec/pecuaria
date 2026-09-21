import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}

test('pastures expose local operational map and measured management without cloud maps',async({page})=>{
  await login(page);
  await page.getByTestId('nav-pastures').click();
  await expect(page.getByTestId('pasture-local-map')).toBeVisible();
  await expect(page.getByText('Mapa esquemático local')).toBeVisible();
  await expect(page.getByTestId('pasture-condition')).toBeVisible();
  await expect(page.getByTestId('pasture-rotations')).toBeVisible();
  await expect(page.getByTestId('pasture-body-condition')).toBeVisible();
  await expect(page.getByText('Pressão e ocupação')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
});

test('all P1B pasture actions are typed in the existing authenticated workspace',async({page})=>{
  await login(page);await page.getByTestId('nav-pastures').click();
  const actions=['save','enterLot','leaveLot','recordAssessment','recordBodyCondition','saveRotationPlan'];
  for(const action of actions){
    const button=page.getByTestId(`action-pastures-${action}`);await expect(button).toBeVisible();await button.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);await page.getByRole('button',{name:'Fechar'}).click();
  }
});
