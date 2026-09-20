import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattleShellModel} from '../src/ui.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-dashboard-ui-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('P0-P2 shell uses compact green livestock navigation with semantic icons',()=>{
  const shell=createCattleShellModel();
  assert.equal(shell.brand.theme.primary,'#315A3E');
  const overview=shell.navigation.find(item=>item.id==='overview');
  assert.equal(overview.label,'Dashboard');
  assert.deepEqual(Object.fromEntries(shell.navigation.map(item=>[item.id,item.icon])),{
    overview:'layout-dashboard',
    lots:'layers-3',
    animals:'tag',
    weights:'scale',
    sanitary:'shield-plus',
    reproduction:'heart',
    trades:'badge-dollar-sign',
    finance:'wallet-cards',
    reports:'chart-no-axes-combined',
    traceability:'scan-line',
    inventory:'package',
    pastures:'sprout',
    nutrition:'wheat',
    tasks:'calendar-check',
    data:'database',
    iot:'radio-tower',
    settings:'settings'
  });
});

test('P4 dashboard exposes only four primary KPIs while preserving complete metrics',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.lots','l1',{id:'l1',name:'Matrizes 01'},{expectedVersion:0});
    await f.db.putRecord('cattle.animals','a1',{id:'a1',tag:'BV 01234',lotId:'l1',status:'active',weights:[{measuredAt:'2026-09-19T12:00:00.000Z',weightKg:420}]},{expectedVersion:0});
    await f.db.putRecord('cattle.finance','f1',{id:'f1',kind:'cost',amountMinor:15000},{expectedVersion:0});
    const presentation=createCattlePresentation({persistence:f.db});
    const data=await presentation.load('overview');
    assert.deepEqual(Object.keys(data.primaryKpis),['activeAnimals','averageWeightKg','lots','alerts']);
    assert.equal(data.primaryKpis.activeAnimals,1);
    assert.equal(data.primaryKpis.averageWeightKg,420);
    assert.equal(data.primaryKpis.lots,1);
    assert.equal(data.primaryKpis.alerts,data.alerts.length);
    assert.equal(data.cards.costMinor,15000);
  }finally{await f.cleanup()}
});
