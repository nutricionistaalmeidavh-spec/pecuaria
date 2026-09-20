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
  'lots.save','lots.remove','animals.save','animals.move','animals.lifecycle','weights.record',
  'sanitary.saveProtocol','sanitary.record','reproduction.record','trades.create','finance.addCost',
  'finance.fromTrade','reports.csv','reports.issue',
  'iot.saveDevice','iot.testDevice','iot.bindRfid','iot.startDevice','iot.simulateRfid','iot.simulateWeight',
  'iot.stopDevice','iot.unbindRfid','iot.removeDevice',
  'settings.backup','settings.restore'
];

async function authFor(host){
  await host.backend.bootstrap({username:'qa-admin',password:'Qa-Standalone-2026!'});
  const logged=await host.backend.login({username:'qa-admin',password:'Qa-Standalone-2026!'});
  return{sessionId:logged.session.id,token:logged.token};
}

test('scenario registry exactly matches and executes all 25 contracted actions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-actions-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    const auth=await authFor(host);
    const repos=createCattleRepositories(host.persistence);

    await repos.lots.save(createCattleLot({id:'lot-main',name:'Principal',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.lots.save(createCattleLot({id:'lot-target',name:'Destino',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.lots.save(createCattleLot({id:'lot-remove',name:'Remover',farmUnitId:'farm-1'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-move',tag:'MOVE-QA',farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-life',tag:'LIFE-QA',farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-weight',tag:'WEIGHT-QA',farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-sanitary',tag:'SAN-QA',farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});
    await repos.animals.save(createAnimal({id:'animal-repro',tag:'REP-QA',farmUnitId:'farm-1',lotId:'lot-main'}),{expectedVersion:0});

    await host.presentation.services.iot.saveDevice({id:'iot-sim-scale',name:'Balança QA',profileId:'simulator-scale',stationId:'curral-qa',enabled:true,config:{}});
    await host.presentation.services.iot.startDevice('iot-sim-scale');

    let backupId=null;
    const run=(screenId,action,input={})=>host.backend.action({screenId,action,input,auth});
    const scenarios={
      'lots.save':()=>run('lots','save',createCattleLot({id:'lot-action',name:'Ação',farmUnitId:'farm-1'})),
      'lots.remove':async()=>{
        const current=await repos.lots.get('lot-remove');
        return run('lots','remove',{id:'lot-remove',expectedVersion:current.version});
      },
      'animals.save':()=>run('animals','save',createAnimal({id:'animal-action',tag:'ACTION-QA',farmUnitId:'farm-1',lotId:'lot-main'})),
      'animals.move':()=>run('animals','move',{id:'animal-move',toLotId:'lot-target',movedAt:'2026-09-19T15:00:00Z',reason:'qa'}),
      'animals.lifecycle':()=>run('animals','lifecycle',{id:'animal-life',type:'death',occurredAt:'2026-09-19T15:05:00Z',reason:'qa'}),
      'weights.record':()=>run('weights','record',{id:'animal-weight',weightKg:410,measuredAt:'2026-09-19T15:10:00Z'}),
      'sanitary.saveProtocol':()=>run('sanitary','saveProtocol',createSanitaryProtocol({id:'protocol-qa',name:'Vacina QA',productItemId:'product-1',dose:2,unit:'ml'})),
      'sanitary.record':()=>run('sanitary','record',{id:'sanitary-qa',animalId:'animal-sanitary',protocolId:'protocol-qa',productItemId:'product-1',dose:2,unit:'ml',occurredAt:'2026-09-19T15:15:00Z'}),
      'reproduction.record':()=>run('reproduction','record',{id:'repro-qa',animalId:'animal-repro',type:'service',occurredAt:'2026-09-19T15:20:00Z'}),
      'trades.create':()=>run('trades','create',{id:'trade-qa',type:'purchase',partyId:'supplier-1',animalIds:[],totalAmountMinor:100000,occurredAt:'2026-09-19T15:25:00Z'}),
      'finance.addCost':()=>run('finance','addCost',{id:'cost-qa',lotId:'lot-main',amountMinor:25000,description:'Custo QA',category:'qa'}),
      'finance.fromTrade':()=>run('finance','fromTrade',{tradeId:'trade-qa',id:'trade-finance-qa',lotId:'lot-main'}),
      'reports.csv':async()=>{
        const result=await run('reports','csv',{type:'lot-kpis',rows:[{lotId:'lot-main',headCount:5,averageWeightKg:410,costPerHeadMinor:1000,marginMinor:5000}]});
        assert.equal(result.format,'csv');
        assert.equal(result.rowCount,1);
        return result;
      },
      'reports.issue':()=>run('reports','issue',{id:'document-qa',type:'lot-kpis',format:'csv',content:'lotId,headCount\nlot-main,5'}),
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
    assert.equal(expectedActions.length,25);

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
