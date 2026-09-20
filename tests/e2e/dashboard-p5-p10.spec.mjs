import {test,expect} from '@playwright/test';

async function login(page){
  await page.goto('/');
  await page.getByTestId('password').fill(['Qa','Browser','2026!'].join('-'));
  await page.getByTestId('auth-submit').click();
}

test('P5-P7 overview exposes performance, operational cards and recent activity',async({page})=>{
  await login(page);
  for(const id of ['performance-card','performance-chart','reproduction-card','sanitary-card','lot-distribution-card','finance-card','activity-feed']){
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId('performance-chart').locator('svg')).toHaveCount(1);
});

test('P8 internal screens use the refined workspace language without losing actions',async({page})=>{
  await login(page);
  await page.getByTestId('nav-animals').click();
  await expect(page.getByTestId('workspace-screen')).toBeVisible();
  await expect(page.getByTestId('workspace-screen-icon').locator('svg')).toHaveCount(1);
  await expect(page.getByTestId('action-animals-save')).toBeVisible();
  await expect(page.getByTestId('action-animals-move')).toBeVisible();
});

test('P9 mobile navigation is a drawer and operational tables become readable cards',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);

  const toggle=page.getByTestId('mobile-nav-toggle');
  await expect(toggle).toBeVisible();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open','false');
  await toggle.click();
  await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open','true');
  await page.getByTestId('nav-lots').click();

  await page.getByTestId('action-lots-save').click();
  await page.getByTestId('field-id').fill('mobile-lot');
  await page.getByTestId('field-name').fill('Lote Mobile');
  await page.getByTestId('action-submit').click();

  const table=page.getByTestId('data-table');
  await expect(table).toBeVisible();
  const firstCell=table.locator('tbody td').first();
  await expect(firstCell).toHaveAttribute('data-label');
});

test('P10 overview has no horizontal overflow at supported viewports',async({page})=>{
  for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await login(page);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    expect(overflow,`${viewport.width}px should not overflow horizontally`).toBe(false);
    await page.evaluate(()=>localStorage.clear());
  }
});
