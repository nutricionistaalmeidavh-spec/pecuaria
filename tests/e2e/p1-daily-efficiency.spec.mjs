import {test,expect} from '@playwright/test';
import {login,navigate,runAction,seedFarm,seedLot,seedAnimal} from './operational-helpers.mjs';

test('[p1-ux] report builder persists local choices and exposes generation preview',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page);
  await navigate(page,'reports');
  const builder=page.getByTestId('p1-report-builder');await expect(builder).toBeVisible();
  await builder.getByRole('button',{name:/Desempenho/}).click();
  await builder.getByLabel('Formato').selectOption('csv');
  await builder.getByLabel('Lote').selectOption('lot-e2e');
  await expect(builder.getByTestId('report-preview')).toContainText('artisys-performance-');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('artisys-pecuaria:p1-report-builder')));
  expect(saved).toMatchObject({type:'performance',format:'csv',lotId:'lot-e2e'});
});

test('[p1-ux] inventory and nutrition expose operational alerts and autonomy',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-p1',tag:'COW-P1'});
  await runAction(page,'inventory','save',{id:'feed-p1',name:'Ração P1',kind:'feed',unit:'kg',quantity:'5',minQuantity:'10',costMinor:'100'});
  await navigate(page,'inventory');const inventory=page.getByTestId('p1-inventory');await expect(inventory).toBeVisible();await expect(inventory.getByTestId('inventory-alerts')).toContainText('1');
  await runAction(page,'nutrition','save',{id:'plan-p1',name:'Plano P1',lotId:'lot-e2e',feedItemId:'feed-p1',dailyKgPerHead:'2',startsAt:'2026-09-22T08:00'});
  await navigate(page,'nutrition');const nutrition=page.getByTestId('p1-nutrition');await expect(nutrition).toBeVisible();await expect(nutrition.getByTestId('nutrition-autonomy')).toContainText(/Autonomia|dias/);await expect(nutrition).toContainText(/estoque mínimo/i);
});

test('[p1-ux] traceability, data transfer and IoT clarify local-only workflows',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-trace-p1',tag:'TRACE-P1'});
  await runAction(page,'traceability','save',{id:'trace-p1',animalId:'cow-trace-p1',type:'gta',documentNumber:'GTA-P1',issuer:'Local',issuedAt:'2026-09-01T08:00',expiresAt:'2026-09-10T08:00'});
  await navigate(page,'traceability');const trace=page.getByTestId('p1-traceability');await expect(trace).toContainText('SISBOV/GTA');await expect(trace.getByTestId('traceability-filter')).toContainText('Vencidos');
  await navigate(page,'data');await expect(page.getByTestId('p1-data-transfer')).toBeVisible();await expect(page.getByTestId('import-wizard')).toContainText('Validar estrutura');
  await runAction(page,'iot','saveDevice',{id:'sim-p1',name:'Simulador P1',profileId:'simulator-rfid',stationId:'curral-p1',enabled:'true'});
  await navigate(page,'iot');const iot=page.getByTestId('p1-iot-devices');await expect(iot).toContainText('Simulador P1');await expect(iot).toContainText(/Simulador/);await expect(iot.getByTestId('iot-device-status').first()).toBeVisible();
});
