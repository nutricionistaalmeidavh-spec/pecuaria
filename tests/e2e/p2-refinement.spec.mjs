import {test,expect} from '@playwright/test';
import {login,navigate} from './operational-helpers.mjs';

test('[p2-ux] dashboard preferences persist favorites and density per local access profile',async({page})=>{
  await login(page);
  const prefs=page.getByTestId('p2-preferences');
  await expect(prefs).toBeVisible();
  await prefs.getByLabel('Densidade da interface').selectOption('compact');
  await prefs.getByText('Editar favoritos').click();
  const finance=prefs.getByLabel('Financeiro');
  if(!await finance.isChecked())await finance.check();
  await navigate(page,'animals');
  await navigate(page,'overview');
  const restored=page.getByTestId('p2-preferences');
  await expect(restored.getByLabel('Densidade da interface')).toHaveValue('compact');
  await expect(restored.getByTestId('dashboard-favorites').getByRole('button',{name:'Financeiro'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-density','compact');
});

test('[p2-ux] field favorites persist and mobile targets remain touch sized',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);
  const openMobileNav=async()=>{
    const toggle=page.getByTestId('mobile-nav-toggle');
    if(await toggle.isVisible())await toggle.click();
  };
  await openMobileNav();
  await navigate(page,'tasks');
  const favorites=page.getByTestId('field-favorites');
  await expect(favorites).toBeVisible();
  await favorites.getByText('Editar').click();
  const rfid=favorites.getByLabel('RFID');
  if(!await rfid.isChecked())await rfid.check();
  await openMobileNav();
  await navigate(page,'overview');
  await openMobileNav();
  await navigate(page,'tasks');
  const rfidButton=page.getByTestId('field-favorites').getByRole('button',{name:'RFID'});
  await expect(rfidButton).toBeVisible();
  const box=await rfidButton.boundingBox();
  expect(box?.height??0).toBeGreaterThanOrEqual(44);
});

test('[p2-ux] skip link and dialog Escape provide keyboard-only access',async({page})=>{
  await login(page);
  await page.evaluate(()=>document.activeElement?.blur?.());
  await page.keyboard.press('Tab');
  const skip=page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await navigate(page,'lots');
  await expect(page.getByTestId('action-lots-save')).toHaveText('Novo lote');
  await page.getByTestId('action-lots-save').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await navigate(page,'inventory');
  await expect(page.getByTestId('action-inventory-save')).toHaveText('Novo insumo');
});

test('[p2-ux] optional telemetry records only local technical events',async({page})=>{
  await login(page);
  await navigate(page,'settings');
  const panel=page.getByTestId('local-telemetry-panel');
  await expect(panel).toContainText('Nada é enviado para internet ou SaaS');
  const enable=panel.getByRole('button',{name:'Ativar registro local'});
  if(await enable.isVisible())await enable.click();
  await navigate(page,'lots');
  await page.getByTestId('action-lots-save').click();
  await page.getByRole('button',{name:'Cancelar'}).click();
  const telemetry=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(key=>key==='artisys-pecuaria:p2:telemetry');
    return key?JSON.parse(localStorage.getItem(key)):null;
  });
  expect(telemetry?.enabled).toBe(true);
  expect(telemetry?.events?.length??0).toBeGreaterThan(0);
  expect(telemetry.events.some(event=>event.type==='ui.action.open')).toBe(true);
  expect(JSON.stringify(telemetry)).not.toMatch(/password|token|secret|credential/i);
});
