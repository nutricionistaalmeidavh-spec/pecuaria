import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){await page.goto('/');await page.getByTestId('password').fill(password);await page.getByTestId('auth-submit').click();await expect(page.getByText('Gestão Pecuária')).toBeVisible();}

test('P1C field workspace exposes focused offline operations and Animal 360 without raw JSON',async({page})=>{
  await login(page);
  await page.getByTestId('nav-tasks').click();
  await expect(page.getByTestId('field-mobile-workspace')).toBeVisible();
  const switcher=page.getByTestId('field-operation-switcher');
  await expect(switcher).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);

  const sections=[
    ['Reprodução','field-quick-reproduction'],
    ['Nascimento','field-quick-birth'],
    ['RFID','field-quick-rfid'],
    ['Pastos','field-quick-pasture'],
    ['Escores','field-quick-scores'],
    ['Animal 360º','field-animal360']
  ];
  for(const [label,testId] of sections){
    await switcher.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByTestId(testId)).toBeVisible();
  }
});

test('P1C representative field forms are typed and birth is exposed as a normal contracted action',async({page})=>{
  await login(page);
  await page.getByTestId('nav-tasks').click();
  const switcher=page.getByTestId('field-operation-switcher');

  await switcher.getByRole('button',{name:'Nascimento',exact:true}).click();
  const birth=page.getByTestId('field-quick-birth');
  await expect(birth.getByLabel('ID *')).toBeVisible();
  await expect(birth.getByLabel('Brinco *')).toBeVisible();
  await expect(birth.getByRole('button',{name:'Registrar nascimento'})).toBeVisible();

  await switcher.getByRole('button',{name:'Reprodução',exact:true}).click();
  await expect(page.getByTestId('field-quick-reproduction').getByRole('button',{name:'Registrar evento'})).toBeVisible();

  await switcher.getByRole('button',{name:'Pastos',exact:true}).click();
  await expect(page.getByTestId('field-quick-pasture').getByRole('button',{name:/Registrar (entrada|saída)/})).toBeVisible();

  await switcher.getByRole('button',{name:'Escores',exact:true}).click();
  await expect(page.getByTestId('field-quick-scores').getByRole('button',{name:'Registrar escore'})).toBeVisible();

  await switcher.getByRole('button',{name:'RFID',exact:true}).click();
  await expect(page.getByTestId('field-quick-rfid').getByRole('button',{name:'Vincular identificação'})).toBeVisible();

  await page.getByTestId('nav-animals').click();
  await expect(page.getByTestId('action-animals-registerBirth')).toBeVisible();
  await page.getByTestId('action-animals-registerBirth').click();
  await expect(page.getByRole('dialog',{name:'Registrar nascimento'})).toBeVisible();
  await expect(page.getByTestId('field-farmUnitId')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
});
