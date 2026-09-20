import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-finance-pasture-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function seedFinance(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Engorda'},{expectedVersion:0});
  await db.putRecord('cattle.lots','l2',{id:'l2',name:'Recria'},{expectedVersion:0});
  await db.putRecord('cattle.animals','a1',{id:'a1',tag:'A1',lotId:'l1',status:'active',metadata:{phase:'engorda'},weights:[]},{expectedVersion:0});
  await db.putRecord('cattle.animals','a2',{id:'a2',tag:'A2',lotId:'l1',status:'active',metadata:{phase:'engorda'},weights:[]},{expectedVersion:0});
  await db.putRecord('cattle.animals','a3',{id:'a3',tag:'A3',lotId:'l2',status:'active',metadata:{phase:'recria'},weights:[]},{expectedVersion:0});
  await db.putRecord('cattle.trades','purchase-1',{id:'purchase-1',type:'purchase',animalIds:['a3'],totalAmountMinor:12000,occurredAt:'2026-08-01T00:00:00.000Z',metadata:{}},{expectedVersion:0});
  await db.putRecord('cattle.trades','sale-1',{id:'sale-1',type:'sale',animalIds:['a1','a2'],totalAmountMinor:50000,occurredAt:'2026-09-01T00:00:00.000Z',metadata:{}},{expectedVersion:0});
  const entries=[
    {id:'feed',direction:'expense',amountMinor:10001,allocation:{kind:'cattle-lot',id:'l1'},description:'Nutrição',metadata:{category:'nutrition'}},
    {id:'san-a1',direction:'expense',amountMinor:3000,allocation:{kind:'cattle-lot',id:'l1'},description:'Sanidade individual',metadata:{category:'sanitary',animalId:'a1'}},
    {id:'san-l2',direction:'expense',amountMinor:9000,allocation:{kind:'cattle-lot',id:'l2'},description:'Sanidade lote',metadata:{category:'sanitary'}},
    {id:'general',direction:'expense',amountMinor:2000,allocation:null,description:'Despesa geral',metadata:{category:'other'}},
    {id:'purchase',direction:'expense',amountMinor:12000,allocation:{kind:'cattle-lot',id:'l2'},description:'Compra',metadata:{tradeId:'purchase-1'}},
    {id:'sale',direction:'income',amountMinor:50000,allocation:{kind:'cattle-lot',id:'l1'},description:'Venda',metadata:{tradeId:'sale-1'}}
  ];
  for(const entry of entries)await db.putRecord('cattle.finance',entry.id,entry,{expectedVersion:0});
}

async function seedPastures(db){
  await db.putRecord('cattle.lots','l1',{id:'l1',name:'Lote 1'},{expectedVersion:0});
  await db.putRecord('cattle.lots','l2',{id:'l2',name:'Lote 2'},{expectedVersion:0});
  await db.putRecord('cattle.pastures','p1',{id:'p1',name:'Piquete 1',areaHa:10,capacityAu:12,status:'active'},{expectedVersion:0});
  await db.putRecord('cattle.pastures','p2',{id:'p2',name:'Piquete 2',areaHa:5,capacityAu:6,status:'active'},{expectedVersion:0});
  const animals=[
    {id:'a1',tag:'A1',lotId:'l1',status:'active',movements:[],weights:[{measuredAt:'2026-08-01T00:00:00.000Z',weightKg:400},{measuredAt:'2026-08-10T00:00:00.000Z',weightKg:420},{measuredAt:'2026-08-20T00:00:00.000Z',weightKg:425},{measuredAt:'2026-08-29T00:00:00.000Z',weightKg:445}]},
    {id:'a2',tag:'A2',lotId:'l1',status:'active',movements:[],weights:[{measuredAt:'2026-08-01T00:00:00.000Z',weightKg:300},{measuredAt:'2026-08-10T00:00:00.000Z',weightKg:310},{measuredAt:'2026-08-20T00:00:00.000Z',weightKg:312},{measuredAt:'2026-08-29T00:00:00.000Z',weightKg:322}]},
    {id:'a3',tag:'A3',lotId:'l2',status:'active',movements:[],weights:[{measuredAt:'2026-08-01T00:00:00.000Z',weightKg:350},{measuredAt:'2026-08-20T00:00:00.000Z',weightKg:390}]},
    {id:'a4',tag:'A4',lotId:'l2',status:'active',movements:[{fromLotId:'l1',toLotId:'l2',movedAt:'2026-08-15T00:00:00.000Z',reason:'management'}],weights:[{measuredAt:'2026-08-01T00:00:00.000Z',weightKg:200},{measuredAt:'2026-08-10T00:00:00.000Z',weightKg:210},{measuredAt:'2026-08-15T00:00:00.000Z',weightKg:212},{measuredAt:'2026-08-20T00:00:00.000Z',weightKg:215}]}
  ];
  for(const animal of animals)await db.putRecord('cattle.animals',animal.id,animal,{expectedVersion:0});
  const occupancy=[
    {id:'o1',pastureId:'p1',lotId:'l1',enteredAt:'2026-08-01T00:00:00.000Z',leftAt:'2026-08-11T00:00:00.000Z',animalUnits:10},
    {id:'o2',pastureId:'p1',lotId:'l1',enteredAt:'2026-08-20T00:00:00.000Z',leftAt:'2026-08-30T00:00:00.000Z',animalUnits:8},
    {id:'o3',pastureId:'p2',lotId:'l2',enteredAt:'2026-08-01T00:00:00.000Z',leftAt:'2026-08-21T00:00:00.000Z',animalUnits:5}
  ];
  for(const row of occupancy)await db.putRecord('cattle.pasture-occupancy',row.id,row,{expectedVersion:0});
}

test('deep finance allocates costs exactly to animals and phases without persisting derived rows',async()=>{
  const f=await fixture();
  try{
    await seedFinance(f.db);
    const reporting=createCattlePresentation({persistence:f.db}).services.reporting;
    const before=(await f.db.listRecords('cattle.finance')).map(x=>x.payload);
    const result=await reporting.financeInsights();
    assert.equal(result.summary.costMinor,36001);
    assert.equal(result.summary.incomeMinor,50000);
    assert.equal(result.summary.resultMinor,13999);
    assert.equal(result.allocation.allocatedCostMinor,34001);
    assert.equal(result.allocation.unallocatedCostMinor,2000);
    assert.equal(result.allocation.coveragePct,94.4);
    assert.equal(result.animals.find(x=>x.animalId==='a1').costMinor,8001);
    assert.equal(result.animals.find(x=>x.animalId==='a2').costMinor,5000);
    assert.equal(result.animals.find(x=>x.animalId==='a3').costMinor,21000);
    assert.equal(result.phases.find(x=>x.phase==='engorda').costMinor,13001);
    assert.equal(result.phases.find(x=>x.phase==='recria').costMinor,21000);
    assert.equal(result.dre.grossRevenueMinor,50000);
    assert.equal(result.dre.nutritionCostMinor,10001);
    assert.equal(result.dre.sanitaryCostMinor,12000);
    assert.equal(result.dre.acquisitionCostMinor,12000);
    assert.equal(result.dre.otherCostMinor,2000);
    assert.equal(result.dre.totalCostMinor,36001);
    assert.equal(result.dre.operatingResultMinor,13999);
    assert.deepEqual((await f.db.listRecords('cattle.finance')).map(x=>x.payload),before);
  }finally{await f.cleanup()}
});

test('pasture history reconstructs animal lot movements and compares productivity by period',async()=>{
  const f=await fixture();
  try{
    await seedPastures(f.db);
    const reporting=createCattlePresentation({persistence:f.db}).services.reporting;
    const result=await reporting.pastureInsights({from:'2026-08-01T00:00:00.000Z',to:'2026-09-01T00:00:00.000Z',now:'2026-09-01T00:00:00.000Z'});
    assert.deepEqual(result.period,{from:'2026-08-01T00:00:00.000Z',to:'2026-09-01T00:00:00.000Z',days:31});
    assert.equal(result.history.length,3);
    assert.equal(result.history.find(x=>x.id==='o1').headCount,3);
    assert.equal(result.history.find(x=>x.id==='o1').gainKg,40);
    assert.equal(result.history.find(x=>x.id==='o2').headCount,2);
    assert.equal(result.history.find(x=>x.id==='o2').gainKg,30);
    assert.equal(result.history.find(x=>x.id==='o3').headCount,2);
    assert.equal(result.history.find(x=>x.id==='o3').gainKg,43);
    const p1=result.comparison.find(x=>x.pastureId==='p1');
    const p2=result.comparison.find(x=>x.pastureId==='p2');
    assert.equal(p1.occupiedDays,20);
    assert.equal(p1.restDays,11);
    assert.equal(p1.averageStockingAuHa,0.9);
    assert.equal(p1.gainKg,70);
    assert.equal(p1.kgProducedPerHa,7);
    assert.equal(p1.arrobasProducedPerHa,0.47);
    assert.equal(p2.kgProducedPerHa,8.6);
    assert.equal(result.comparison[0].pastureId,'p2');
  }finally{await f.cleanup()}
});

test('finance and pasture workspaces expose the new depth in the existing UI',async()=>{
  const source=await readFile(new URL('../web/depth-components.jsx',import.meta.url),'utf8');
  for(const text of ['DRE pecuária','Custo individual por animal','Custo por fase','Cobertura de apropriação','Produtividade histórica','Comparação entre piquetes','kg/ha/período','@/ha/período'])assert.match(source,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
