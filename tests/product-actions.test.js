import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createCattleSecurity} from '../src/security.js';
import {createCattleRpc} from '../runtime/backend.mjs';
import productContract from '../qa/product-contract.json' with {type:'json'};

const executionOrder=[
  'data.saveFarmUnit','data.saveBreed','data.saveCategory','data.saveParty',
  'lots.save','animals.save','animals.save','animals.save','animals.recordMilk','animals.move','animals.batchMove','animals.lifecycle','animals.batchLifecycle','weights.record',
  'sanitary.saveProtocol','inventory.save','sanitary.record','sanitary.batchRecord',
  'reproduction.record','reproduction.batchRecord',
  'trades.create','trades.create','finance.addCost','finance.fromTrade','finance.saveAccount','finance.saveCategory','finance.saveTitle','finance.settleTitle','finance.reverseSettlement','finance.importStatement','finance.reconcileStatement','finance.importInvoiceXml','finance.cancelTitle',
  'traceability.save','traceability.remove','inventory.adjust',
  'pastures.save','pastures.enterLot','pastures.recordAssessment','pastures.recordBodyCondition','pastures.saveRotationPlan','pastures.leaveLot',
  'nutrition.save','nutrition.consume','tasks.save','tasks.complete',
  'reports.csv','reports.pdf','reports.issue',
  'data.exportCollection','data.validateImport','data.importCollection',
  'iot.saveDevice','iot.testDevice','iot.startDevice','iot.simulateRfid','iot.simulateWeight','iot.stopDevice','iot.bindRfid','iot.unbindRfid','iot.removeDevice',
  'settings.backup','settings.restore','lots.remove'
];

const contractedActions=()=>Object.entries(productContract.actions).flatMap(([screen,actions])=>actions.map(action=>`${screen}.${action}`)).sort();

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-actions-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const security=createCattleSecurity({persistence:db});
  await security.bootstrapAdmin({username:'admin',password:'P1-Product-Actions!'});
  const presentation=createCattlePresentation({persistence:db,security});
  const rpc=createCattleRpc({presentation,security,persistence:db});
  const login=await rpc.login({username:'admin',password:'P1-Product-Actions!'});
  return{dir,db,security,presentation,rpc,token:login.token,async close(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('scenario registry exactly matches and executes all 61 contracted actions',async()=>{
  const f=await fixture();
  try{
    const run=(screen,action,payload={})=>f.rpc.action({token:f.token,screen,action,payload});
    let backupId=null;
    const scenarios={
      'data.saveFarmUnit':()=>run('data','saveFarmUnit',{id:'farm-main',name:'Fazenda Principal',registration:'QA',location:'Campo'}),
      'data.saveBreed':()=>run('data','saveBreed',{id:'nelore',name:'Nelore',species:'bovine'}),
      'data.saveCategory':()=>run('data','saveCategory',{id:'matriz',name:'Matriz',purpose:'breeding'}),
      'data.saveParty':()=>run('data','saveParty',{id:'buyer-qa',name:'Comprador QA',roles:['buyer'],document:'00000000000'}),
      'lots.save':()=>run('lots','save',{id:'lot-main',name:'Lote principal',farmUnitId:'farm-main',purpose:'beef'}),
      'lots.remove':()=>run('lots','remove',{id:'lot-remove',expectedVersion:1}),
      'animals.save':async()=>{
        const existing=await f.db.getRecord('cattle.animals','animal-main');
        if(existing)return run('animals','save',{...existing.payload,name:'Animal QA atualizado',expectedVersion:existing.version});
        return run('animals','save',{id:'animal-main',tag:'A-001',name:'Animal QA',farmUnitId:'farm-main',lotId:'lot-main',breedId:'nelore',categoryId:'matriz',sex:'female',birthDate:'2024-01-01',status:'active'});
      },
      'animals.recordMilk':()=>run('animals','recordMilk',{id:'animal-dairy',measuredAt:'2026-09-19T09:00:00Z',liters:8.5}),
      'animals.move':()=>run('animals','move',{id:'animal-main',toLotId:'lot-main',movedAt:'2026-09-19T10:00:00Z',reason:'qa'}),
      'animals.batchMove':()=>run('animals','batchMove',{animalIds:['animal-main'],toLotId:'lot-main',movedAt:'2026-09-19T10:15:00Z',reason:'qa batch'}),
      'animals.lifecycle':()=>run('animals','lifecycle',{id:'animal-main',type:'weaning',occurredAt:'2026-09-19T10:30:00Z',notes:'qa'}),
      'animals.batchLifecycle':()=>run('animals','batchLifecycle',{animalIds:['animal-main'],type:'classification',occurredAt:'2026-09-19T10:45:00Z',notes:'qa batch'}),
      'weights.record':()=>run('weights','record',{id:'animal-weight',weightKg:410,measuredAt:'2026-09-19T11:00:00Z',source:'manual'}),
      'sanitary.saveProtocol':()=>run('sanitary','saveProtocol',{id:'protocol-qa',name:'Protocolo QA',productName:'Produto QA',dose:1,doseUnit:'mL',route:'subcutaneous',withdrawalDays:0,activeIngredient:'teste'}),
      'sanitary.record':()=>run('sanitary','record',{id:'sanitary-qa',animalId:'animal-main',protocolId:'protocol-qa',occurredAt:'2026-09-19T11:30:00Z',dose:1}),
      'sanitary.batchRecord':()=>run('sanitary','batchRecord',{idPrefix:'sanitary-batch',animalIds:['animal-main'],protocolId:'protocol-qa',occurredAt:'2026-09-19T11:45:00Z',dose:1}),
      'reproduction.record':()=>run('reproduction','record',{id:'repro-qa',animalId:'animal-main',type:'insemination',occurredAt:'2026-09-19T12:00:00Z',notes:'qa'}),
      'reproduction.batchRecord':()=>run('reproduction','batchRecord',{idPrefix:'repro-batch',animalIds:['animal-main'],type:'diagnosis',occurredAt:'2026-09-19T12:15:00Z',result:'open'}),
      'trades.create':async()=>{
        const saleAnimal=await f.db.getRecord('cattle.animals','animal-sale');
        if(saleAnimal?.payload?.status==='active')return run('trades','create',{id:'trade-sale',type:'sale',occurredAt:'2026-09-19T13:00:00Z',animalIds:['animal-sale'],partyId:'buyer-qa',amountMinor:300000,lotId:'lot-main'});
        return run('trades','create',{id:'trade-buy',type:'purchase',occurredAt:'2026-09-19T13:05:00Z',animalIds:[],partyId:'buyer-qa',amountMinor:150000});
      },
      'finance.addCost':()=>run('finance','addCost',{id:'cost-qa',occurredAt:'2026-09-19T13:30:00Z',amountMinor:12000,category:'feed',lotId:'lot-main',description:'Custo QA'}),
      'finance.fromTrade':()=>run('finance','fromTrade',{id:'finance-trade-qa',tradeId:'trade-buy',lotId:'lot-main'}),
      'finance.saveAccount':()=>run('finance','saveAccount',{id:'cash-qa',name:'Caixa QA',kind:'cash',openingBalanceMinor:100000}),
      'finance.saveCategory':()=>run('finance','saveCategory',{id:'category-qa',name:'Operacional QA',direction:'both'}),
      'finance.saveTitle':()=>run('finance','saveTitle',{id:'title-qa',direction:'payable',description:'Título QA',originalAmountMinor:20000,issuedAt:'2026-09-19T13:45:00Z',dueAt:'2026-09-25T13:45:00Z',accountId:'cash-qa',categoryId:'category-qa'}),
      'finance.settleTitle':()=>run('finance','settleTitle',{titleId:'title-qa',amountMinor:5000,occurredAt:'2026-09-19T14:00:00Z',accountId:'cash-qa',operationId:'settlement-qa'}),
      'finance.reverseSettlement':()=>run('finance','reverseSettlement',{settlementId:'settlement-qa',occurredAt:'2026-09-19T14:05:00Z',reason:'qa'}),
      'finance.importStatement':()=>run('finance','importStatement',{sourceName:'qa.csv',content:'date;description;amount\n2026-09-19;Compra QA;-50,00'}),
      'finance.reconcileStatement':async()=>{
        const imported=(await f.db.listRecords('cattle.finance-statement')).find(record=>record.payload.description==='Compra QA');
        return run('finance','reconcileStatement',{statementId:imported.payload.id,titleId:'title-qa',occurredAt:'2026-09-19T14:10:00Z'});
      },
      'finance.importInvoiceXml':()=>run('finance','importInvoiceXml',{sourceName:'qa.xml',content:'<NFe><infNFe><ide><nNF>123</nNF><dhEmi>2026-09-19T14:00:00Z</dhEmi></ide><emit><CNPJ>00000000000100</CNPJ><xNome>Fornecedor QA</xNome></emit><total><ICMSTot><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe>'}),
      'finance.cancelTitle':()=>run('finance','cancelTitle',{id:'title-cancel-qa',reason:'qa'}),
      'traceability.save':()=>run('traceability','save',{id:'trace-qa',animalId:'animal-main',officialId:'BR-QA',type:'identity',issuedAt:'2026-09-19T14:30:00Z'}),
      'traceability.remove':()=>run('traceability','remove',{id:'trace-remove',expectedVersion:1}),
      'inventory.save':()=>run('inventory','save',{id:'feed-qa',name:'Ração QA',kind:'feed',unit:'kg',quantity:1000,minQuantity:100,costMinor:200}),
      'inventory.adjust':()=>run('inventory','adjust',{id:'feed-qa',delta:50,occurredAt:'2026-09-19T15:00:00Z',reason:'qa'}),
      'pastures.save':()=>run('pastures','save',{id:'pasture-qa',name:'Piquete QA',farmUnitId:'farm-main',areaHa:20,capacityAu:15,status:'available',forage:'Braquiária',restTargetDays:14,targetHeightCm:30}),
      'pastures.enterLot':()=>run('pastures','enterLot',{id:'occupancy-qa',pastureId:'pasture-qa',lotId:'lot-main',enteredAt:'2026-09-19T15:35:00Z',animalUnits:10,notes:'qa'}),
      'pastures.recordAssessment':()=>run('pastures','recordAssessment',{id:'assessment-qa',pastureId:'pasture-qa',occurredAt:'2026-09-19T16:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:90}),
      'pastures.recordBodyCondition':()=>run('pastures','recordBodyCondition',{id:'body-qa',animalId:'animal-weight',occurredAt:'2026-09-19T16:05:00Z',score:3.5}),
      'pastures.saveRotationPlan':()=>run('pastures','saveRotationPlan',{id:'rotation-qa',pastureId:'pasture-qa',lotId:'lot-main',plannedEnterAt:'2026-09-25T08:00:00Z',plannedLeaveAt:'2026-09-28T08:00:00Z'}),
      'pastures.leaveLot':()=>run('pastures','leaveLot',{id:'occupancy-qa',leftAt:'2026-09-20T15:35:00Z'}),
      'nutrition.save':()=>run('nutrition','save',{id:'nutrition-qa',name:'Plano QA',lotId:'lot-main',feedItemId:'feed-qa',dailyKgPerHead:2,startsAt:'2026-09-19T16:00:00Z'}),
      'nutrition.consume':()=>run('nutrition','consume',{planId:'nutrition-qa',days:1,occurredAt:'2026-09-19T16:30:00Z'}),
      'tasks.save':()=>run('tasks','save',{id:'task-qa',title:'Manejo QA',dueAt:'2026-09-22T10:00:00Z',kind:'management',lotId:'lot-main'}),
      'tasks.complete':()=>run('tasks','complete',{id:'task-qa'}),
      'reports.csv':()=>run('reports','csv',{type:'animals'}),
      'reports.pdf':()=>run('reports','pdf',{type:'animals',title:'QA'}),
      'reports.issue':()=>run('reports','issue',{id:'report-qa',type:'animals',format:'csv'}),
      'data.exportCollection':()=>run('data','exportCollection',{collection:'cattle.animals'}),
      'data.validateImport':async()=>{const exported=await run('data','exportCollection',{collection:'cattle.breeds'});return run('data','validateImport',{document:exported.document})},
      'data.importCollection':async()=>{const exported=await run('data','exportCollection',{collection:'cattle.breeds'});const document={...exported.document,records:[{id:'breed-imported',payload:{id:'breed-imported',name:'Importada',species:'bovine'},version:1}]};return run('data','importCollection',{document})},
      'iot.saveDevice':()=>run('iot','saveDevice',{id:'rfid-qa',name:'RFID QA',profile:'rfid',connector:'simulator',enabled:false,stationId:'curral-qa'}),
      'iot.testDevice':()=>run('iot','testDevice',{id:'rfid-qa'}),
      'iot.startDevice':()=>run('iot','startDevice',{id:'rfid-qa'}),
      'iot.stopDevice':()=>run('iot','stopDevice',{id:'rfid-qa'}),
      'iot.bindRfid':()=>run('iot','bindRfid',{tag:'EID-QA',animalId:'animal-main',stationId:'curral-qa'}),
      'iot.unbindRfid':()=>run('iot','unbindRfid',{tag:'EID-QA',stationId:'curral-qa'}),
      'iot.simulateRfid':()=>run('iot','simulateRfid',{deviceId:'rfid-qa',tag:'EID-QA'}),
      'iot.simulateWeight':()=>run('iot','simulateWeight',{deviceId:'rfid-qa',weightKg:420,stable:true}),
      'iot.removeDevice':()=>run('iot','removeDevice',{id:'rfid-qa'}),
      'settings.backup':async()=>{const result=await run('settings','backup',{id:'actions-known-good'});backupId=result.id??'actions-known-good';return result},
      'settings.restore':async()=>{
        assert.equal(backupId,'actions-known-good');
        return run('settings','restore',{id:backupId});
      }
    };

    assert.deepEqual(Object.keys(scenarios).sort(),contractedActions());
    assert.deepEqual([...executionOrder].sort(),contractedActions());
    assert.equal(contractedActions().length,61);

    const covered=[];
    for(const key of executionOrder){
      const result=await scenarios[key]();
      assert.notEqual(result,undefined,`${key} must return a result`);
      covered.push(key);
    }
    assert.deepEqual(covered.slice().sort(),contractedActions());
  }finally{await f.close()}
});

test('negative functional cases are rejected without silent corruption',async()=>{
  const f=await fixture();
  try{
    const run=(screen,action,payload={})=>f.rpc.action({token:f.token,screen,action,payload});
    await run('data','saveFarmUnit',{id:'farm-main',name:'Fazenda Principal'});
    await run('lots','save',{id:'lot-main',name:'Lote principal',farmUnitId:'farm-main',purpose:'beef'});
    await assert.rejects(()=>run('animals','save',{id:'bad-animal',tag:'BAD',farmUnitId:'farm-main',lotId:'missing',sex:'female',status:'active'}),/Lot/i);
    assert.equal(await f.db.getRecord('cattle.animals','bad-animal'),null);
    await assert.rejects(()=>run('inventory','adjust',{id:'missing',delta:-1,occurredAt:'2026-09-19'}),/Inventory item/i);
  }finally{await f.close()}
});

test('manager cannot restore a backup even though manager can back up',async()=>{
  const f=await fixture();
  try{
    const adminToken=f.token;
    await f.rpc.userAdmin({token:adminToken,operation:'save',input:{id:'manager-qa',username:'managerqa',displayName:'Manager QA',role:'manager',password:'Manager-QA-2026!'}});
    const manager=await f.rpc.login({username:'managerqa',password:'Manager-QA-2026!'});
    const backup=await f.rpc.action({token:manager.token,screen:'settings',action:'backup',payload:{id:'manager-backup'}});
    assert.equal(backup.id,'manager-backup');
    await assert.rejects(()=>f.rpc.action({token:manager.token,screen:'settings',action:'restore',payload:{id:'manager-backup'}}),/permission|forbidden|admin/i);
  }finally{await f.close()}
});

test('P0 additive actions execute through authenticated presentation',async()=>{
  const f=await fixture();
  try{
    const run=(screen,action,payload={})=>f.rpc.action({token:f.token,screen,action,payload});
    await run('data','saveFarmUnit',{id:'farm-p0',name:'Fazenda P0'});
    await run('lots','save',{id:'lot-p0',name:'Lote P0',farmUnitId:'farm-p0',purpose:'beef'});
    await run('lots','save',{id:'lot-p0b',name:'Lote P0 B',farmUnitId:'farm-p0',purpose:'beef'});
    await run('animals','save',{id:'animal-p0',tag:'P0-1',farmUnitId:'farm-p0',lotId:'lot-p0',sex:'female',status:'active'});
    const moved=await run('animals','batchMove',{animalIds:['animal-p0'],toLotId:'lot-p0b',movedAt:'2026-09-19T19:00:00Z'});
    assert.equal(moved[0].payload.lotId,'lot-p0b');
    const life=await run('animals','batchLifecycle',{animalIds:['animal-p0'],type:'classification',occurredAt:'2026-09-19T19:05:00Z'});
    assert.equal(life[0].payload.lifecycle.at(-1).type,'classification');
  }finally{await f.close()}
});
