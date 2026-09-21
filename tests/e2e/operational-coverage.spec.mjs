import {test,expect} from '@playwright/test';
import {
  ADMIN_PASSWORD,login,logout,navigate,runAction,openDbRecord,listDbRecords,
  seedFarm,seedLot,seedAnimal,seedParty,expectRecord
} from './operational-helpers.mjs';

const family=(name,title,fn)=>test(`[${name}] ${title}`,fn);
const fileFromDownload=async download=>{
  const stream=await download.createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  return Buffer.concat(chunks);
};
const selectByText=async(select,text)=>{
  const value=await select.locator('option').filter({hasText:text}).first().getAttribute('value');
  if(!value)throw new Error(`Option not found: ${text}`);
  await select.selectOption(value);return value;
};

family('crud','cria, edita, exclui e confirma após recarregar',async({page})=>{
  await login(page);
  await runAction(page,'lots','save',{id:'lot-crud',name:'Lote CRUD inicial',purpose:'beef'});
  let record=await expectRecord(page,'cattle.lots','lot-crud');
  expect(record.version).toBe(1);expect(record.payload.name).toBe('Lote CRUD inicial');
  await runAction(page,'lots','save',{id:'lot-crud',name:'Lote CRUD editado',purpose:'breeding'});
  record=await expectRecord(page,'cattle.lots','lot-crud');
  expect(record.version).toBe(2);expect(record.payload.name).toBe('Lote CRUD editado');
  await runAction(page,'lots','remove',{id:'lot-crud',expectedVersion:'2'});
  record=await openDbRecord(page,'cattle.lots','lot-crud');expect(record.deletedAt).toBeTruthy();
  await page.reload();await page.getByTestId('password').fill(ADMIN_PASSWORD);await page.getByTestId('auth-submit').click();
  await navigate(page,'lots');await expect(page.getByTestId('workspace-screen')).not.toContainText('Lote CRUD editado');
});

family('animal','cadastra, pesa, move, registra ciclo de vida e abre Animal 360',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page,{id:'lot-a'});await seedLot(page,{id:'lot-b'});
  await seedAnimal(page,{id:'cow-animal',tag:'COW-ANIMAL',lotId:'lot-a'});
  await runAction(page,'weights','record',{id:'cow-animal',weightKg:'410.5',measuredAt:'2026-09-21T08:00'});
  await runAction(page,'animals','move',{id:'cow-animal',toLotId:'lot-b',movedAt:'2026-09-21T09:00',reason:'e2e'});
  await runAction(page,'animals','lifecycle',{id:'cow-animal',type:'disposal',occurredAt:'2026-09-21T10:00',reason:'qa-e2e'});
  const animal=await expectRecord(page,'cattle.animals','cow-animal');
  expect(animal.payload.weights.at(-1).weightKg).toBe(410.5);expect(animal.payload.lotId).toBe('lot-b');expect(animal.payload.lifecycle.at(-1).type).toBe('disposal');
  await navigate(page,'animals');const selector=page.getByRole('combobox',{name:'Animal'});await selector.selectOption('cow-animal');
  const detail=page.getByTestId('animal-360');await expect(detail).toBeVisible();await expect(detail).toContainText('Pesagem');await expect(detail).toContainText('Movimentação');await expect(detail).toContainText('Ciclo de vida');
});

family('sanitary','aplica sanidade, baixa estoque, apropria custo e expõe carência',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-san',tag:'COW-SAN'});
  await runAction(page,'inventory','save',{id:'med-e2e',name:'Medicamento E2E',kind:'medicine',unit:'dose',quantity:'10',minQuantity:'1',batch:'B1',costMinor:'100'});
  await runAction(page,'sanitary','saveProtocol',{id:'protocol-e2e',name:'Protocolo E2E',productItemId:'med-e2e',activeIngredient:'Teste',dose:'2',unit:'dose',intervalDays:'30',withdrawalDays:'7'});
  await runAction(page,'sanitary','record',{id:'san-e2e',animalId:'cow-san',protocolId:'protocol-e2e',productItemId:'med-e2e',dose:'2',unit:'dose',occurredAt:'2026-09-21T08:00'});
  const inventory=await expectRecord(page,'cattle.inventory','med-e2e');expect(inventory.payload.quantity).toBe(8);
  const event=await expectRecord(page,'cattle.events','san-e2e');expect(Date.parse(event.payload.withdrawalUntil)).toBeGreaterThan(Date.parse(event.payload.occurredAt));
  const movement=await expectRecord(page,'cattle.inventory-movements','sanitary-san-e2e');expect(movement.payload.quantity).toBe(2);
  const cost=await expectRecord(page,'cattle.finance','san-e2e:finance');expect(cost.payload.amountMinor).toBe(200);
  await navigate(page,'overview');await page.locator('.notification-button').click();await expect(page.getByText(/carência|withdrawal/i).first()).toBeVisible();
});

family('sale','simula, vende, encerra animal e confirma lançamento financeiro',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-sale',tag:'COW-SALE'});await seedParty(page,'buyer-e2e');
  await runAction(page,'weights','record',{id:'cow-sale',weightKg:'500',measuredAt:'2026-09-20T08:00'});
  await navigate(page,'trades');const simulator=page.getByTestId('commercial-simulator');await expect(simulator).toBeVisible();
  await simulator.locator('select').first().selectOption('lot-e2e');
  const inputs=simulator.locator('input');await inputs.nth(0).fill('52');await inputs.nth(1).fill('30000');
  await simulator.getByRole('button',{name:/Simular/i}).click();await expect(simulator).toContainText(/@|líquido|cenário/i);
  expect(await listDbRecords(page,'cattle.trades')).toHaveLength(0);
  await runAction(page,'trades','create',{id:'sale-e2e',type:'sale',partyId:'buyer-e2e',animalIds:['cow-sale'],occurredAt:'2026-09-21T12:00',liveWeightKg:'500',carcassYieldPct:'52',pricePerCarcassArrobaMinor:'30000',deductionsMinor:'1000',freightMinor:'2000',commissionMinor:'500'});
  const animal=await expectRecord(page,'cattle.animals','cow-sale');expect(animal.payload.status).not.toBe('active');expect(animal.payload.lifecycle.at(-1).type).toBe('sale');
  await expectRecord(page,'cattle.trades','sale-e2e');const finance=await expectRecord(page,'cattle.finance','sale-e2e:finance');expect(finance.payload.amountMinor).toBeGreaterThan(0);
  await navigate(page,'finance');await expect(page.getByTestId('workspace-screen')).toContainText('sale-e2e');
});

family('reproduction','gerencia genética, doses, estação e serviço com baixa de sêmen',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-repro',tag:'COW-REPRO',sex:'female'});
  await navigate(page,'reproduction');const panel=page.getByTestId('professional-reproduction');await expect(panel).toBeVisible();
  const genetics=panel.getByTestId('genetics-register');await genetics.getByLabel('Tipo').selectOption('semen');await genetics.getByLabel('Nome').fill('Sêmen E2E');await genetics.getByRole('button',{name:'Salvar genética'}).click();
  await expect(genetics).toContainText('Sêmen E2E');
  const doses=panel.getByTestId('semen-dose-stock');await selectByText(doses.getByLabel('Sêmen'),'Sêmen E2E');await doses.getByLabel('Lote/partida').fill('DOSE-E2E');await doses.getByLabel('Doses',{exact:true}).fill('5');await doses.getByLabel('Estoque mínimo').fill('1');await doses.getByRole('button',{name:'Adicionar lote de doses'}).click();
  const season=panel.getByTestId('breeding-season');await season.getByLabel('Nome').fill('Estação E2E');await season.getByLabel('Início').fill('2026-09-01');await season.getByLabel('Fim').fill('2026-12-31');await season.getByLabel('Status').selectOption('active');await season.getByRole('button',{name:'Salvar estação'}).click();
  const service=page.getByRole('heading',{name:'Registrar serviço com rastreabilidade'}).locator('..');await service.getByLabel('Matriz').selectOption('cow-repro');await service.getByLabel('Data/hora').fill('2026-09-21T10:00');await service.getByLabel('Método').selectOption('iatf');
  await selectByText(service.getByLabel('Touro / sêmen'),'Sêmen E2E');await selectByText(service.getByLabel('Lote de doses'),'DOSE-E2E');await service.getByLabel('Doses utilizadas').fill('2');await selectByText(service.getByLabel('Estação'),'Estação E2E');await service.getByRole('button',{name:/Registrar serviço/i}).click();
  await expect.poll(async()=>{const rows=await listDbRecords(page,'cattle.reproduction-dose-stock');return rows[0]?.payload?.quantityDoses}).toBe(3);
  const events=await listDbRecords(page,'cattle.events');expect(events.some(row=>row.payload.kind==='reproduction'&&row.payload.animalId==='cow-repro'&&row.payload.metadata?.dosesUsed===2)).toBe(true);
});

family('pasture','cadastra área, entra lote, sai e preserva histórico',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);
  await runAction(page,'pastures','save',{id:'pasture-e2e',name:'Pasto E2E',farmUnitId:'farm-e2e',areaHa:'10',capacityAu:'8',forage:'braquiária',status:'available'});
  await runAction(page,'pastures','enterLot',{id:'occupancy-e2e',pastureId:'pasture-e2e',lotId:'lot-e2e',enteredAt:'2026-09-20T08:00',animalUnits:'4'});
  await runAction(page,'pastures','leaveLot',{id:'occupancy-e2e',leftAt:'2026-09-21T08:00'});
  const occupancy=await expectRecord(page,'cattle.pasture-occupancy','occupancy-e2e');expect(occupancy.payload.leftAt).toBeTruthy();
  await navigate(page,'pastures');await expect(page.getByTestId('secondary-pastures')).toContainText('occupancy-e2e');
});

family('nutrition','registra plano, consumo e baixa transacional do alimento',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-feed',tag:'COW-FEED'});
  await runAction(page,'inventory','save',{id:'feed-e2e',name:'Ração E2E',kind:'feed',unit:'kg',quantity:'100',minQuantity:'10',costMinor:'50'});
  await runAction(page,'nutrition','save',{id:'nutrition-e2e',name:'Plano E2E',lotId:'lot-e2e',feedItemId:'feed-e2e',dailyKgPerHead:'2',startsAt:'2026-09-20T08:00'});
  await runAction(page,'nutrition','consume',{planId:'nutrition-e2e',days:'2',occurredAt:'2026-09-21T08:00'});
  const feed=await expectRecord(page,'cattle.inventory','feed-e2e');expect(feed.payload.quantity).toBe(96);
  const movements=await listDbRecords(page,'cattle.inventory-movements');expect(movements.some(row=>row.payload.itemId==='feed-e2e'&&row.payload.type==='out')).toBe(true);
});

family('reports','gera CSV/PDF, baixa arquivos e persiste emissão',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);
  let downloadPromise=page.waitForEvent('download');await runAction(page,'reports','csv',{type:'lot-kpis',lotId:'lot-e2e'});let download=await downloadPromise;let bytes=await fileFromDownload(download);expect(bytes.length).toBeGreaterThan(0);expect(download.suggestedFilename()).toMatch(/\.csv$/);
  downloadPromise=page.waitForEvent('download');await runAction(page,'reports','pdf',{type:'lot-kpis',lotId:'lot-e2e'});download=await downloadPromise;bytes=await fileFromDownload(download);expect(bytes.subarray(0,4).toString()).toBe('%PDF');
  await runAction(page,'reports','issue',{id:'issued-e2e',type:'lot-kpis',format:'json',lotId:'lot-e2e'});await expectRecord(page,'issued-documents','issued-e2e');await navigate(page,'reports');await expect(page.getByTestId('workspace-screen')).toContainText('issued-e2e');
});

family('transfer','exporta, valida e importa JSON em outro banco local',async({browser})=>{
  const source=await browser.newContext({acceptDownloads:true});const sourcePage=await source.newPage();await login(sourcePage);await seedLot(sourcePage,{id:'lot-transfer',farmUnitId:''});
  const downloadPromise=sourcePage.waitForEvent('download');await runAction(sourcePage,'data','exportCollection',{collection:'cattle.lots'});const exported=await fileFromDownload(await downloadPromise);const document=exported.toString('utf8');expect(JSON.parse(document).records.length).toBe(1);
  const target=await browser.newContext();const targetPage=await target.newPage();await login(targetPage);
  await runAction(targetPage,'data','validateImport',{document});await expect(targetPage.getByTestId('action-result-panel')).toBeVisible();
  await runAction(targetPage,'data','importCollection',{document});const imported=await expectRecord(targetPage,'cattle.lots','lot-transfer');expect(imported.payload.name).toContain('lot-transfer');
  await source.close();await target.close();
});

family('rbac','entra com perfil restrito e oculta telas e ações sem permissão',async({page})=>{
  await login(page);await navigate(page,'settings');const admin=page.getByTestId('user-administration');await expect(admin).toBeVisible();
  await admin.getByRole('textbox',{name:'Usuário',exact:true}).fill('viewer-e2e');await admin.getByLabel('Senha inicial').fill('Viewer-E2E-2026!');await admin.getByRole('combobox',{name:'Perfil',exact:true}).selectOption('viewer');await admin.getByRole('button',{name:'Criar usuário'}).click();await expect(admin).toContainText('viewer-e2e');
  await logout(page);await page.getByTestId('username').fill('viewer-e2e');await page.getByTestId('password').fill('Viewer-E2E-2026!');await page.getByTestId('auth-submit').click();await expect(page.getByTestId('sidebar')).toBeVisible();
  await expect(page.getByTestId('nav-lots')).toBeVisible();await page.getByTestId('nav-lots').click();await expect(page.getByTestId('action-lots-save')).toHaveCount(0);await expect(page.getByTestId('action-lots-remove')).toHaveCount(0);
  await expect(page.getByTestId('nav-settings')).toHaveCount(0);await expect(page.getByTestId('nav-iot')).toHaveCount(0);await expect(page.getByTestId('nav-finance')).toHaveCount(0);
});

family('iot','cadastra, testa, inicia, vincula, simula e para dispositivos locais',async({page})=>{
  await login(page);await seedFarm(page);await seedLot(page);await seedAnimal(page,{id:'cow-iot',tag:'COW-IOT'});
  await runAction(page,'iot','saveDevice',{id:'rfid-sim',name:'RFID sim',profileId:'simulator-rfid',stationId:'curral-e2e',enabled:'true'});
  await runAction(page,'iot','saveDevice',{id:'scale-sim',name:'Balança sim',profileId:'simulator-scale',stationId:'curral-e2e',enabled:'true'});
  await runAction(page,'iot','testDevice',{id:'rfid-sim'});await runAction(page,'iot','startDevice',{id:'rfid-sim'});await runAction(page,'iot','startDevice',{id:'scale-sim'});
  await runAction(page,'iot','bindRfid',{tagId:'RFID-E2E',animalId:'cow-iot'});await runAction(page,'iot','simulateRfid',{deviceId:'rfid-sim',tagId:'RFID-E2E'});await runAction(page,'iot','simulateWeight',{deviceId:'scale-sim',value:'432.1',unit:'kg',stable:'true'});
  await expect.poll(async()=>{const row=await openDbRecord(page,'cattle.animals','cow-iot');return row?.payload?.weights?.at(-1)?.weightKg}).toBe(432.1);
  await runAction(page,'iot','stopDevice',{id:'scale-sim'});await runAction(page,'iot','stopDevice',{id:'rfid-sim'});
});

family('fieldOffline','opera em campo, sincroniza pacote, persiste e detecta conflito real',async({browser})=>{
  const base=await browser.newContext({acceptDownloads:true});const basePage=await base.newPage();await login(basePage);await seedFarm(basePage);await seedLot(basePage);await seedLot(basePage,{id:'lot-conflict'});await seedAnimal(basePage,{id:'cow-field',tag:'COW-FIELD'});
  await runAction(basePage,'tasks','save',{id:'task-apply',title:'Aplicar E2E',dueAt:'2026-09-21T12:00',kind:'management',animalId:'cow-field'});
  await navigate(basePage,'tasks');const baseSwitcher=basePage.getByTestId('field-operation-switcher');await baseSwitcher.getByRole('button',{name:'Sincronizar',exact:true}).click();
  let downloadPromise=basePage.waitForEvent('download');await basePage.getByRole('button',{name:'Criar base local'}).click();const pairing=await fileFromDownload(await downloadPromise);
  downloadPromise=basePage.waitForEvent('download');await basePage.getByRole('button',{name:'Exportar pacote'}).click();const snapshotBundle=await fileFromDownload(await downloadPromise);

  const field=await browser.newContext({acceptDownloads:true});const fieldPage=await field.newPage();await login(fieldPage);await navigate(fieldPage,'tasks');const fieldSwitcher=fieldPage.getByTestId('field-operation-switcher');await fieldSwitcher.getByRole('button',{name:'Sincronizar',exact:true}).click();
  let syncCard=fieldPage.getByTestId('field-secure-sync');await syncCard.locator('input[type=file]').first().setInputFiles({name:'pairing.json',mimeType:'application/json',buffer:pairing});
  await expect(syncCard.getByRole('button',{name:'Exportar pacote'})).toBeVisible();
  syncCard=fieldPage.getByTestId('field-secure-sync');await syncCard.locator('input[type=file]').last().setInputFiles({name:'snapshot.sync.json',mimeType:'application/json',buffer:snapshotBundle});
  await expect(fieldPage.getByRole('status')).toContainText('Pacote local importado');
  await expect.poll(async()=>openDbRecord(fieldPage,'cattle.tasks','task-apply')).not.toBeNull();

  await fieldSwitcher.getByRole('button',{name:'Tarefas',exact:true}).click();const queue=fieldPage.getByTestId('field-task-queue');await expect(queue).toContainText('Aplicar E2E');await queue.locator('article').filter({hasText:'Aplicar E2E'}).getByRole('button',{name:'Concluir'}).click();
  await expect.poll(async()=>{const row=await openDbRecord(fieldPage,'cattle.tasks','task-apply');return row?.payload?.status}).toBe('completed');
  await fieldSwitcher.getByRole('button',{name:'Mover',exact:true}).click();const move=fieldPage.getByTestId('field-quick-move');await move.getByLabel('Animal').selectOption('cow-field');await move.getByLabel('Destino').selectOption('lot-conflict');await move.getByRole('button',{name:'Mover animal'}).click();
  await expect.poll(async()=>{const row=await openDbRecord(fieldPage,'cattle.animals','cow-field');return row?.payload?.lotId}).toBe('lot-conflict');
  await expect.poll(async()=>{const rows=await listDbRecords(fieldPage,'cattle.field-sync-queue');return rows.filter(row=>row.payload.status==='ready').length}).toBe(2);

  await runAction(basePage,'lots','remove',{id:'lot-conflict',expectedVersion:'1'});
  await fieldSwitcher.getByRole('button',{name:'Sincronizar',exact:true}).click();downloadPromise=fieldPage.waitForEvent('download');await fieldPage.getByRole('button',{name:'Exportar pacote'}).click();const fieldBundle=await fileFromDownload(await downloadPromise);
  await baseSwitcher.getByRole('button',{name:'Sincronizar',exact:true}).click();syncCard=basePage.getByTestId('field-secure-sync');await syncCard.locator('input[type=file]').last().setInputFiles({name:'field.sync.json',mimeType:'application/json',buffer:fieldBundle});

  const applied=await expectRecord(basePage,'cattle.tasks','task-apply');expect(applied.payload.status).toBe('completed');expect((await openDbRecord(basePage,'cattle.animals','cow-field')).payload.lotId).toBe('lot-e2e');
  const receipts=await listDbRecords(basePage,'cattle.field-sync-receipts');expect(receipts.some(row=>row.payload.status==='conflict'&&row.payload.kind==='animal.move')).toBe(true);

  downloadPromise=basePage.waitForEvent('download');await basePage.getByRole('button',{name:'Exportar pacote'}).click();const receiptBundle=await fileFromDownload(await downloadPromise);
  syncCard=fieldPage.getByTestId('field-secure-sync');await syncCard.locator('input[type=file]').last().setInputFiles({name:'receipts.sync.json',mimeType:'application/json',buffer:receiptBundle});await expect(syncCard).toContainText('1 conflito(s)');
  await base.close();await field.close();
});

family('backup','cria snapshot, altera dados, restaura e confirma estado anterior',async({page})=>{
  await login(page);await runAction(page,'lots','save',{id:'lot-backup',name:'Antes do backup',purpose:'beef'});await runAction(page,'settings','backup',{id:'backup-e2e'});
  await runAction(page,'lots','save',{id:'lot-backup',name:'Depois do backup',purpose:'beef'});expect((await openDbRecord(page,'cattle.lots','lot-backup')).payload.name).toBe('Depois do backup');
  await runAction(page,'settings','restore',{id:'backup-e2e'});expect((await openDbRecord(page,'cattle.lots','lot-backup')).payload.name).toBe('Antes do backup');await navigate(page,'lots');await expect(page.getByTestId('workspace-screen')).toContainText('Antes do backup');
});

family('updates','exige ações explícitas para verificar, baixar e instalar',async({page})=>{
  await login(page);
  await page.evaluate(()=>{
    window.__updateCalls={check:0,download:0,install:0};
    window.artisys={updates:{
      state:async()=>({status:'current',currentVersion:'1.0.1',availableVersion:null}),
      onStatus:()=>()=>{},
      check:async()=>{window.__updateCalls.check++;return{status:'available',currentVersion:'1.0.1',availableVersion:'1.0.2'}},
      download:async()=>{window.__updateCalls.download++;return{status:'downloaded',currentVersion:'1.0.1',availableVersion:'1.0.2'}},
      install:async()=>{window.__updateCalls.install++;return{status:'installing',currentVersion:'1.0.1',availableVersion:'1.0.2'}}
    }};
  });
  await navigate(page,'settings');await expect(page.getByTestId('check-updates')).toBeVisible();expect(await page.evaluate(()=>window.__updateCalls)).toEqual({check:0,download:0,install:0});
  await page.getByTestId('check-updates').click();await expect(page.getByTestId('update-available')).toBeVisible();expect(await page.evaluate(()=>window.__updateCalls)).toEqual({check:1,download:0,install:0});
  await page.getByRole('button',{name:'Baixar atualização'}).click();await expect(page.getByTestId('update-downloaded')).toBeVisible();expect(await page.evaluate(()=>window.__updateCalls)).toEqual({check:1,download:1,install:0});
  await page.getByRole('button',{name:'Instalar e reiniciar'}).click();await expect.poll(()=>page.evaluate(()=>window.__updateCalls.install)).toBe(1);
});
