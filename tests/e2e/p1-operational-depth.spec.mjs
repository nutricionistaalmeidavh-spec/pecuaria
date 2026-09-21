import {test,expect} from '@playwright/test';

const password='P1-E2E-2026!';
async function login(page){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('Gestão Pecuária')).toBeVisible();
}
async function openAction(page,screen,action){
  await page.getByTestId(`nav-${screen}`).click();
  await page.getByTestId(`action-${screen}-${action}`).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
}
async function fill(page,name,value){
  const input=page.getByTestId(`field-${name}`);
  const tag=await input.evaluate(element=>element.tagName);
  if(tag==='SELECT')await input.selectOption(String(value));
  else await input.fill(String(value));
}
async function submit(page){
  await page.getByTestId('action-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function seedFarmLot(page){
  await openAction(page,'data','saveFarmUnit');
  await fill(page,'id','farm-int');
  await fill(page,'name','Fazenda Integrada');
  await submit(page);
  await openAction(page,'lots','save');
  await fill(page,'id','lot-int');
  await fill(page,'name','Lote Integrado');
  await fill(page,'farmUnitId','farm-int');
  await submit(page);
}

test('finance journey creates a title, partially settles it and reverses the settlement',async({page})=>{
  await login(page);
  await openAction(page,'finance','saveTitle');
  for(const [name,value] of Object.entries({id:'title-int',direction:'payable',description:'Título integrado',originalAmountMinor:'10000',issuedAt:'2026-09-21',dueAt:'2026-09-30'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('finance-titles')).toContainText('Título integrado');
  await expect(page.getByTestId('finance-titles')).toContainText('Aberto');

  await openAction(page,'finance','settleTitle');
  for(const [name,value] of Object.entries({id:'settlement-int',operationId:'settlement-op-int',titleId:'title-int',amountMinor:'2500',occurredAt:'2026-09-21T10:00'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('finance-titles')).toContainText('Parcial');

  await openAction(page,'finance','reverseSettlement');
  for(const [name,value] of Object.entries({id:'reversal-int',operationId:'reversal-op-int',settlementId:'settlement-int',occurredAt:'2026-09-21T11:00',reason:'Correção E2E'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('finance-titles')).toContainText('Aberto');
  await expect(page.getByTestId('finance-forecast')).toBeVisible();
});

test('pasture and animal operations coexist on the same local dataset',async({page})=>{
  await login(page);
  await seedFarmLot(page);

  await openAction(page,'pastures','save');
  for(const [name,value] of Object.entries({id:'pasture-int',name:'Piquete Integrado',farmUnitId:'farm-int',areaHa:'12.5',capacityAu:'20',forage:'Brachiaria',status:'available'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('pasture-local-map')).toContainText('Piquete Integrado');

  await openAction(page,'pastures','recordAssessment');
  for(const [name,value] of Object.entries({id:'assessment-int',pastureId:'pasture-int',occurredAt:'2026-09-21T09:00',score:'4',heightCm:'28',forageMassKgHa:'3200',groundCoverPct:'90'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('pasture-condition')).toContainText('4');

  await openAction(page,'pastures','saveRotationPlan');
  for(const [name,value] of Object.entries({id:'rotation-int',pastureId:'pasture-int',lotId:'lot-int',plannedEnterAt:'2026-09-25T08:00',plannedLeaveAt:'2026-09-28T08:00',status:'planned'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('pasture-rotations')).toBeVisible();

  await openAction(page,'animals','registerBirth');
  for(const [name,value] of Object.entries({id:'calf-int',tag:'BIRTH-INT',farmUnitId:'farm-int',birthDate:'2026-09-21T07:30',sex:'female',lotId:'lot-int',notes:'Nascimento integrado'}))await fill(page,name,value);
  await submit(page);
  await expect(page.getByTestId('data-table')).toContainText('BIRTH-INT');

  await page.getByTestId('nav-tasks').click();
  const switcher=page.getByTestId('field-operation-switcher');
  await switcher.getByRole('button',{name:'Animal 360º',exact:true}).click();
  await expect(page.getByTestId('field-animal360')).toBeVisible();
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
});

test('field workspace remains touch-usable on mobile without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.getByTestId('mobile-nav-toggle').click();
  await page.getByTestId('nav-tasks').click();
  const workspace=page.getByTestId('field-mobile-workspace');
  await expect(workspace).toBeVisible();
  const switcher=page.getByTestId('field-operation-switcher');
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button',{name:'Nascimento',exact:true}).click();
  await expect(page.getByTestId('field-quick-birth').getByRole('button',{name:'Registrar nascimento'})).toBeVisible();
  await switcher.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await expect(page.getByTestId('field-secure-sync')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.locator('[data-testid="action-json"]')).toHaveCount(0);
});
