import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createCattleRepositories,createSanitaryProtocol} from '../src/catalog.js';
import {createAnimal,createCattleLot} from '../src/index.js';
import {createSecurityService} from '../src/security.js';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';

const contract=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));
const expectedActions=Object.entries(contract.actions)
  .flatMap(([screen,actions])=>actions.map(action=>`${screen}.${action}`))
  .sort();
const executionOrder=[
  'lots.save','lots.remove',
  'animals.save','animals.registerBirth','animals.recordMilk','animals.move','animals.lifecycle','animals.batchMove','animals.batchLifecycle',
  'weights.record',
  'inventory.save','inventory.adjust',
  'sanitary.saveProtocol','sanitary.record','sanitary.batchRecord',
  'reproduction.record','reproduction.batchRecord',
  'trades.create','finance.addCost','finance.fromTrade','finance.saveAccount','finance.saveCategory','finance.saveTitle','finance.settleTitle','finance.importStatement','finance.reconcileStatement','finance.reverseSettlement','finance.cancelTitle','finance.importInvoiceXml',
  'traceability.save','traceability.remove',
  'pastures.save','pastures.enterLot','pastures.recordAssessment','animals.recordBodyCondition','pastures.saveRotationPlan','pastures.leaveLot',
  'nutrition.save','nutrition.consume',
  'tasks.save','tasks.complete',
  'data.saveFarmUnit','data.saveBreed','data.saveCategory','data.saveParty','data.exportCollection','data.validateImport','data.importCollection',
  'reports.csv','reports.pdf','reports.issue',
  'iot.saveDevice','iot.testDevice','iot.bindRfid','iot.startDevice','iot.simulateRfid','iot.simulateWeight',
  'iot.stopDevice','iot.unbindRfid','iot.removeDevice',
  'settings.backup','settings.restore'
];

async function authFor(host){
  await host.backend.bootstrap({username:'qa-admin',password:'Qa-Standalone-2026!'});
  const logged=await host.backend.login({username:'qa-admin',password:'Qa-Standalone-2026!'});
  return{sessionId:logged.session.id,token:logged.token};
}

test('scenario registry exactly matches and executes all 62 contracted actions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-actions-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    const auth=await authFor(host);
    const repos=createCattleRepositories(host.persistence);

    await repos.lots.save(createCattleLot({id:'lot-main',name:'Principal',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.lots.save(createCattleLot({id:'lot-target',name:'Destino',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.lots.save(createCattleLot({id:'lot-remove',name:'Remover',farmUnitId:'farm-1'}),{expectedVersion:0});
    const animals=[
      ['animal-move','MOVE-QA'],['animal-life','LIFE-QA'],['animal-weight','WEIGHT-QA'],['animal-milk','MILK-QA'],
      ['animal-sanitary','SAN-QA'],['animal-repro','REP-QA'],['animal-batch-move-1','BM-1'],['animal-batch-move-2','BM-2'],
      ['animal-batch-life-1','BL-1'],['animal-batch-life-2','BL-2'],['animal-san-batch-1','SB-1'],['animal-san-batch-2','SB-2'],
      ['animal-repro-batch-1','RB-1'],['animal-repro-batch-2','RB-2']
    ];
    for(const [id,tag] of animals)await repos.animals.save(createAnimal({id,tag,farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});

    await host.presentation.services.iot.saveDevice({id:'iot-sim-scale',name:'Balança QA',profileId:'simulator-scale',stationId:'curral-qa',enabled:true,config:{}});
    await host.presentation.services.iot.startDevice('iot-sim-scale');

    let backupId=null,statementLineId=null;
    const statementInput={sourceName:'qa.csv',text:'date;description;amount\n2026-09-20;Baixa QA;-300,00'};
    const run=(screenId,action,input={})=>host.backend.action({screenId,action,input,auth});
    const transferDocument={
      format:'artisys-pecuaria-export',version:1,productId:'agro-pecuaria',collection:'cattle.parties',exportedAt:'2026-09-19T19:00:00.000Z',
      records:[{id:'party-import',payload:{id:'party-import',name:'Importado QA',roles:['other'],document:null,phone:null,email:null,notes:null}}]
    };
    const scenarios={
      'lots.save':()=>run('lots','save',createCattleLot({id:'lot-action',name:'Ação',farmUnitId:'farm-1'})),
      'lots.remove':async()=>{
        const current=await repos.lots.get('lot-remove');
        return run('lots','remove',{id:'lot-remove',expectedVersion:current.version});
      },
      'animals.save':()=>run('animals','save',createAnimal({id:'animal-action',tag:'ACTION-QA',farmUnitId:'farm-1',lotId:'lot-main',purpose:'dairy'})),
      'animals.registerBirth':()=>run('animals','registerBirth',{id:'animal-birth',tag:'BIRTH-QA',farmUnitId:'farm-1',birthDate:'2026-09-19T14:40:00Z',sex:'female',damId:'animal-repro',lotId:'lot-main',notes:'qa birth'}),
      'animals.recordMilk':()=>run('animals','recordMilk',{id:'animal-action',liters:12.5,measuredAt:'2026-09-19T14:45:00Z'}),
      'animals.move':()=>run('animals','move',{id:'animal-move',toLotId:'lot-target',movedAt:'2026-09-19T15:00:00Z',reason:'qa'}),
      'animals.lifecycle':()=>run('animals','lifecycle',{id:'animal-life',type:'death',occurredAt:'2026-09-19T15:05:00Z',reason:'qa'}),
      'animals.batchMove':()=>run('animals','batchMove',{animalIds:['animal-batch-move-1','animal-batch-move-2'],toLotId:'lot-target',movedAt:'2026-09-19T15:06:00Z',reason:'qa-batch'}),
      'animals.batchLifecycle':()=>run('animals','batchLifecycle',{animalIds:['animal-batch-life-1','animal-batch-life-2'],type:'disposal',occurredAt:'2026-09-19T15:07:00Z',reason:'qa-batch'}),
      'weights.record':()=>run('weights','record',{id:'animal-weight',weightKg:410,measuredAt:'2026-09-19T15:10:00Z'}),
      'inventory.save':()=>run('inventory','save',{id:'feed-qa',name:'Ração QA',kind:'feed',unit:'kg',quantity:10000,minQuantity:100,batch:'F001',costMinor:250}),
      'inventory.adjust':()=>run('inventory','adjust',{id:'feed-qa',delta:50,type:'in',occurredAt:'2026-09-19T15:11:00Z',reason:'qa',unitCostMinor:250}),
      'sanitary.saveProtocol':()=>run('sanitary','saveProtocol',createSanitaryProtocol({id:'protocol-qa',name:'Vacina QA',productItemId:'product-1',dose:2,unit:'ml'})),
      'sanitary.record':()=>run('sanitary','record',{id:'sanitary-qa',animalId:'animal-sanitary',protocolId:'protocol-qa',productItemId:'product-1',dose:2,unit:'ml',occurredAt:'2026-09-19T15:15:00Z'}),
      'sanitary.batchRecord':()=>run('sanitary','batchRecord',{idPrefix:'san-batch',animalIds:['animal-san-batch-1','animal-san-batch-2'],protocolId:'protocol-qa',productItemId:'product-1',dose:2,unit:'ml',occurredAt:'2026-09-19T15:16:00Z'}),
      'reproduction.record':()=>run('reproduction','record',{id:'repro-qa',animalId:'animal-repro',type:'service',occurredAt:'2026-09-19T15:20:00Z'}),
      'reproduction.batchRecord':()=>run('reproduction','batchRecord',{idPrefix:'repro-batch',animalIds:['animal-repro-batch-1','animal-repro-batch-2'],type:'pregnancy-check',occurredAt:'2026-09-19T15:21:00Z',metadata:{result:'negative'}}),
      'trades.create':()=>run('trades','create',{id:'trade-qa',type:'purchase',partyId:'supplier-1',animalIds:[],totalAmountMinor:100000,occurredAt:'2026-09-19T15:25:00Z'}),
      'finance.addCost':()=>run('finance','addCost',{id:'cost-qa',lotId:'lot-main',amountMinor:25000,description:'Custo QA',category:'qa'}),
      'finance.fromTrade':()=>run('finance','fromTrade',{tradeId:'trade-qa',id:'trade-finance-qa',lotId:'lot-main'}),
      'finance.saveAccount':()=>run('finance','saveAccount',{id:'fin-account-qa',name:'Conta QA',kind:'bank'}),
      'finance.saveCategory':()=>run('finance','saveCategory',{id:'fin-category-qa',name:'Custos QA',direction:'payable'}),
      'finance.saveTitle':()=>run('finance','saveTitle',{id:'fin-title-qa',direction:'payable',description:'Título QA',originalAmountMinor:100000,issuedAt:'2026-09-19',dueAt:'2026-10-01',categoryId:'fin-category-qa',accountId:'fin-account-qa'}),
      'finance.settleTitle':()=>run('finance','settleTitle',{id:'fin-settlement-qa',operationId:'fin-op-settle-qa',titleId:'fin-title-qa',amountMinor:30000,occurredAt:'2026-09-20T10:00:00Z',accountId:'fin-account-qa'}),
      'finance.importStatement':async()=>{const result=await run('finance','importStatement',statementInput);const lines=await host.persistence.listRecords('cattle.finance-reconciliations');statementLineId=lines[0]?.id;assert.ok(statementLineId);return result;},
      'finance.reconcileStatement':()=>run('finance','reconcileStatement',{lineId:statementLineId,settlementId:'fin-settlement-qa'}),
      'finance.reverseSettlement':()=>run('finance','reverseSettlement',{id:'fin-reversal-qa',operationId:'fin-op-reverse-qa',settlementId:'fin-settlement-qa',occurredAt:'2026-09-20T11:00:00Z',reason:'qa'}),
      'finance.cancelTitle':async()=>{await run('finance','saveTitle',{id:'fin-title-cancel-qa',direction:'receivable',description:'Cancelar QA',originalAmountMinor:5000,issuedAt:'2026-09-19',dueAt:'2026-10-02'});return run('finance','cancelTitle',{id:'fin-title-cancel-qa',cancelledAt:'2026-09-20T12:00:00Z',reason:'qa'});},
      'finance.importInvoiceXml':()=>run('finance','importInvoiceXml',{sourceName:'nfe-qa.xml',xml:'<NFe><infNFe><ide><nNF>77</nNF><dEmi>2026-09-20</dEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor QA</xNome></emit><total><ICMSTot><vNF>123.45</vNF></ICMSTot></total></infNFe></NFe>'}),
      'traceability.save':()=>run('traceability','save',{id:'trace-qa',animalId:'animal-weight',officialId:'BR-QA-001',type:'identity',documentNumber:'DOC-QA',issuer:'QA',issuedAt:'2026-09-19T15:30:00Z'}),
      'traceability.remove':async()=>{
        const current=await host.persistence.getRecord('cattle.traceability','trace-qa');
        return run('traceability','remove',{id:'trace-qa',expectedVersion:current.version});
      },
      'pastures.save':()=>run('pastures','save',{id:'pasture-qa',name:'Piquete QA',farmUnitId:'farm-1',areaHa:12.5,capacityAu:20,status:'active',forage:'Brachiaria'}),
      'pastures.enterLot':()=>run('pastures','enterLot',{id:'occupancy-qa',pastureId:'pasture-qa',lotId:'lot-main',enteredAt:'2026-09-19T15:35:00Z',animalUnits:10,notes:'qa'}),
      'pastures.recordAssessment':()=>run('pastures','recordAssessment',{id:'assessment-qa',pastureId:'pasture-qa',occurredAt:'2026-09-19T16:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:90}),
      'animals.recordBodyCondition':()=>run('animals','recordBodyCondition',{id:'body-qa',animalId:'animal-weight',occurredAt:'2026-09-19T16:05:00Z',score:3.5}),
      'pastures.saveRotationPlan':()=>run('pastures','saveRotationPlan',{id:'rotation-qa',pastureId:'pasture-qa',lotId:'lot-main',plannedEnterAt:'2026-09-25T08:00:00Z',plannedLeaveAt:'2026-09-28T08:00:00Z'}),
      'pastures.leaveLot':()=>run('pastures','leaveLot',{id:'occupancy-qa',leftAt:'2026-09-20T15:35:00Z'}),
      'nutrition.save':()=>run('nutrition','save',{id:'nutrition-qa',name:'Plano QA',lotId:'lot-main',feedItemId:'feed-qa',dailyKgPerHead:1.5,startsAt:'2026-09-19T00:00:00Z',notes:'qa'}),
      'nutrition.consume':()=>run('nutrition','consume',{planId:'nutrition-qa',days:1,occurredAt:'2026-09-19T16:00:00Z'}),
      'tasks.save':()=>run('tasks','save',{id:'task-qa',title:'Manejo QA',dueAt:'2026-09-21T10:00:00Z',kind:'management',animalId:'animal-weight',status:'pending'}),
      'tasks.complete':()=>run('tasks','complete',{id:'task-qa'}),
      'data.saveFarmUnit':()=>run('data','saveFarmUnit',{id:'farm-action',name:'Fazenda QA',registration:'REG-QA',location:'QA'}),
      'data.saveBreed':()=>run('data','saveBreed',{id:'breed-qa',name:'Nelore QA',species:'bovine'}),
      'data.saveCategory':()=>run('data','saveCategory',{id:'category-qa',name:'Recria QA',purpose:'beef'}),
      'data.saveParty':()=>run('data','saveParty',{id:'party-qa',name:'Fornecedor QA',roles:['supplier'],document:'00.000.000/0001-00'}),
      'data.exportCollection':async()=>{
        const result=await run('data','exportCollection',{collection:'cattle.breeds'});
        assert.equal(result.format,'artisys-pecuaria-export');
        assert.ok(result.records.some(record=>record.id==='breed-qa'));
        return result;
      },
      'data.validateImport':async()=>{
        const result=await run('data','validateImport',{document:transferDocument});
        assert.equal(result.valid,true);
        assert.equal(result.imported,0);
        return result;
      },
      'data.importCollection':async()=>{
        const result=await run('data','importCollection',{document:transferDocument});
        assert.equal(result.imported,1);
        return result;
      },
      'reports.csv':async()=>{
        const result=await run('reports','csv',{type:'lot-kpis',lotId:'lot-main'});
        assert.equal(result.format,'csv');
        assert.ok(result.rowCount>=1);
        return result;
      },
      'reports.pdf':async()=>{
        const result=await run('reports','pdf',{type:'lot-kpis',lotId:'lot-main'});
        assert.equal(result.format,'pdf');
        assert.ok(result.content);
        return result;
      },
      'reports.issue':()=>run('reports','issue',{id:'document-qa',type:'lot-kpis',format:'csv',lotId:'lot-main'}),
      'iot.saveDevice':()=>run('iot','saveDevice',{id:'iot-sim-rfid',name:'RFID QA',profileId:'simulator-rfid',stationId:'curral-qa',enabled:true,config:{}}),
      'iot.testDevice':()=>run('iot','testDevice',{id:'iot-sim-rfid'}),
      'iot.bindRfid':()=>run('iot','bindRfid',{tagId:'RFID-QA-001',animalId:'animal-weight'}),
      'iot.startDevice':()=>run('iot','startDevice',{id:'iot-sim-rfid'}),
      'iot.simulateRfid':async()=>{
        const result=await run('iot','simulateRfid',{deviceId:'iot-sim-rfid',tagId:'RFID-QA-001'});
        assert.equal(result.type,'animal-selected');
        return result;
      },
      'iot.simulateWeight':async()=>{
        const result=await run('iot','simulateWeight',{deviceId:'iot-sim-scale',value:420,unit:'kg',stable:true});
        assert.equal(result.type,'weight-recorded');
        assert.equal(result.animalId,'animal-weight');
        return result;
      },
      'iot.stopDevice':()=>run('iot','stopDevice',{id:'iot-sim-rfid'}),
      'iot.unbindRfid':()=>run('iot','unbindRfid',{tagId:'RFID-QA-001'}),
      'iot.removeDevice':()=>run('iot','removeDevice',{id:'iot-sim-rfid'}),
      'settings.backup':async()=>{
        const result=await run('settings','backup',{id:'actions-known-good'});
        backupId=result.id;
        return result;
      },
      'settings.restore':async()=>{
        assert.equal(backupId,'actions-known-good');
        return run('settings','restore',{id:backupId});
      }
    };

    assert.deepEqual(Object.keys(scenarios).sort(),expectedActions);
    assert.deepEqual([...executionOrder].sort(),expectedActions);
    assert.equal(expectedActions.length,62);

    const covered=[];
    for(const key of executionOrder){
      const result=await scenarios[key]();
      assert.notEqual(result,undefined,`${key} must return a result`);
      covered.push(key);
    }
    assert.deepEqual(covered,executionOrder);
    assert.deepEqual([...covered].sort(),expectedActions);

    const weighted=await repos.animals.get('animal-weight');
    assert.equal(weighted.payload.weights.at(-1).weightKg,420);

    const born=await repos.animals.get('animal-birth');
    assert.equal(born?.payload?.tag,'BIRTH-QA');
    const birthEvents=await repos.events.list();
    assert.ok(birthEvents.some(record=>record.id==='animal-birth:birth'&&record.payload?.kind==='birth'&&record.payload?.animalId==='animal-birth'));

    const finance=(await host.presentation.load('finance')).admin;
    const title=finance.titles.find(item=>item.id==='fin-title-qa');
    assert.equal(title?.openAmountMinor,100000);
    assert.equal(title?.status,'open');
    const replay=await run('finance','importStatement',statementInput);
    assert.equal(replay.imported,0);
    assert.equal(replay.skipped,1);

    const assessments=await host.persistence.listRecords('cattle.pasture-assessments');
    const bodyScores=await host.persistence.listRecords('cattle.body-condition');
    const rotations=await host.persistence.listRecords('cattle.pasture-rotation-plan');
    assert.ok(assessments.some(record=>record.id==='assessment-qa'));
    assert.ok(bodyScores.some(record=>record.id==='body-qa'));
    assert.ok(rotations.some(record=>record.id==='rotation-qa'));

    const audit=await host.presentation.services.audit.list();
    assert.ok(audit.some(entry=>entry.action==='settings.restore'));
    assert.ok(audit.some(entry=>entry.action==='cattle.report.issue'));
    assert.ok(audit.some(entry=>entry.action==='cattle.animal.move'));
    assert.ok(audit.some(entry=>entry.action==='iot.weight.record'));
    assert.ok(audit.some(entry=>entry.action==='iot.device.save'));
  }finally{
    await host?.close();
    await rm(root,{recursive:true,force:true});
  }
});

test('negative functional cases are rejected without silent corruption',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-negative-actions-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    const auth=await authFor(host);
    const repos=createCattleRepositories(host.persistence);
    await repos.lots.save(createCattleLot({id:'lot-1',name:'Lote 1',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-1',tag:'NEG-001',farmUnitId:'farm-1',lotId:'lot-1'}),{expectedVersion:0});
    const run=(screenId,action,input={})=>host.backend.action({screenId,action,input,auth});

    await assert.rejects(()=>run('animals','save',createAnimal({id:'animal-duplicate',tag:' neg-001 ',farmUnitId:'farm-1'})),/Animal tag already exists/i);
    await assert.rejects(()=>run('animals','move',{id:'animal-1',toLotId:'missing',movedAt:'2026-09-19T16:00:00Z'}),/Lot not found/i);
    await assert.rejects(()=>run('weights','record',{id:'animal-1',weightKg:0,measuredAt:'2026-09-19T16:00:00Z'}),/positive/i);
    await run('weights','record',{id:'animal-1',weightKg:400,measuredAt:'2026-09-19T16:00:00Z'});
    await assert.rejects(()=>run('weights','record',{id:'animal-1',weightKg:405,measuredAt:'2026-09-18T16:00:00Z'}),/chronological/i);
    await assert.rejects(()=>run('sanitary','record',{id:'san-missing',animalId:'missing',protocolId:'missing',productItemId:'p',dose:1,unit:'ml',occurredAt:'2026-09-19T16:00:00Z'}),/Animal not found/i);

    const current=await repos.lots.get('lot-1');
    await assert.rejects(()=>repos.lots.save({...current.payload,name:'Conflict'},{expectedVersion:current.version+10}),/Version conflict/i);
  }finally{
    await host?.close();
    await rm(root,{recursive:true,force:true});
  }
});

test('manager cannot restore a backup even though manager can back up',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-manager-restore-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  try{
    const security=createSecurityService(db);
    await security.bootstrapUser({id:'manager-1',username:'manager',password:'password-123',roles:['manager']});
    const auth=await security.authenticate({username:'manager',password:'password-123'});
    await security.authorize({sessionId:auth.session.id,token:auth.token,permission:'settings:backup'});
    await assert.rejects(
      ()=>security.authorize({sessionId:auth.session.id,token:auth.token,permission:'settings:restore'}),
      error=>error?.code==='FORBIDDEN'
    );
  }finally{
    await db.close();
    await rm(dir,{recursive:true,force:true});
  }
});


test('P0 additive actions execute through authenticated presentation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-p0-additive-'));let host;
  try{host=await createStandaloneHost({dataDir:root});const auth=await authFor(host);const repos=createCattleRepositories(host.persistence);
    await repos.lots.save(createCattleLot({id:'p0-l1',name:'P0',farmUnitId:'p0-f1'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'p0-a1',tag:'P0-A1',farmUnitId:'p0-f1',lotId:'p0-l1'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'p0-a2',tag:'P0-A2',farmUnitId:'p0-f1',lotId:'p0-l1'}),{expectedVersion:0});
    const run=(s,a,input)=>host.backend.action({screenId:s,action:a,input,auth});
    await run('sanitary','batchRecord',{animalIds:['p0-a1','p0-a2'],idPrefix:'vac',productItemId:'vacina',dose:2,unit:'ml',occurredAt:'2026-09-19T20:00:00Z'});
    await run('reproduction','batchRecord',{animalIds:['p0-a1','p0-a2'],idPrefix:'rep',type:'pregnancy-check',occurredAt:'2026-09-19T20:10:00Z'});
    const events=await repos.events.list();assert.equal(events.length,4);
    const detail=await host.backend.load({screenId:'animals',auth,context:{animalId:'p0-a1'}});assert.equal(detail.detail.animal.id,'p0-a1');assert.ok(detail.detail.timeline.length>=2);
  }finally{await host?.close();await rm(root,{recursive:true,force:true});}
});