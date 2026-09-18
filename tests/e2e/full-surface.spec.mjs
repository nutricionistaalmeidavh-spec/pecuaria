import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const contract=JSON.parse(await readFile(new URL('../../qa/product-contract.json',import.meta.url),'utf8'));
test('percorre 100% das telas publicadas pelo produto',async({page},testInfo)=>{await page.goto('/');await page.getByTestId('password').fill(['Qa','Browser','2026!'].join('-'));await page.getByTestId('auth-submit').click();for(let i=0;i<contract.screens.length;i+=1){const id=contract.screens[i],nav=page.getByTestId(`nav-${id}`);await expect(nav,`navegação ${id}`).toBeVisible();await nav.click();await expect(nav).toHaveClass(/on/);await page.screenshot({path:testInfo.outputPath(`${String(i+1).padStart(2,'0')}-${id}.png`),fullPage:true})}});
