import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createDeepPastureInsights} from '../src/services/pasture-history.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-p1b-integration-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  const presentation=createCattlePresentation({persistence:db});
  await db.putRecord('cattle.lots','lot-1',{id:'lot-1',name:'Lote 1',farmUnitId:'farm-1',purpose:'beef',metadata:{}},{expectedVersion:0});
  await db.putRecord('cattle.animals','animal-1',{id:'animal-1',tag:'A-1',farmUnitId:'farm-1',lotId:'lot-1',sex:'female',status:'active',weights:[],milkRecords:[],movements:[],lifecycle:[],metadata:{}},{expectedVersion:0});
  return{dir,db,presentation,async close(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('pasture presentation exposes six operational actions through the transactional service',async()=>{
  const f=await fixture();
  try{
    const actions=Object.keys(f.presentation.screen('pastures').actions);
    assert.deepEqual(actions,['save','enterLot','leaveLot','recordAssessment','recordBodyCondition','saveRotationPlan']);
    await f.presentation.action('pastures','save',{id:'p1',name:'Piquete 1',farmUnitId:'farm-1',areaHa:10,restTargetDays:12,targetHeightCm:30});
    await f.presentation.action('pastures','save',{id:'p2',name:'Piquete 2',farmUnitId:'farm-1',areaHa:8});
    await f.presentation.action('pastures','enterLot',{id:'occ-1',pastureId:'p1',lotId:'lot-1',enteredAt:'2026-09-20T08:00:00Z',animalUnits:5});
    await assert.rejects(()=>f.presentation.action('pastures','enterLot',{id:'occ-2',pastureId:'p2',lotId:'lot-1',enteredAt:'2026-09-20T09:00:00Z',animalUnits:5}),/already|active|occup/i);
    await f.presentation.action('pastures','recordAssessment',{id:'assessment-1',pastureId:'p1',occurredAt:'2026-09-20T10:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:92});
    await f.presentation.action('pastures','recordBodyCondition',{id:'body-1',animalId:'animal-1',occurredAt:'2026-09-20T10:15:00Z',score:3.5});
    await f.presentation.action('pastures','saveRotationPlan',{id:'rotation-1',pastureId:'p2',lotId:'lot-1',plannedEnterAt:'2026-09-25T08:00:00Z',plannedLeaveAt:'2026-09-28T08:00:00Z'});
    const loaded=await f.presentation.load('pastures',{});
    assert.equal(loaded.management.pastures.find(item=>item.id==='p1').latestAssessment.score,4);
    assert.equal(loaded.management.bodyCondition[0].score,3.5);
    assert.equal(loaded.management.rotationPlans[0].id,'rotation-1');
  }finally{await f.close()}
});

test('deep pasture insights enrich existing productivity with measured assessment and planned rotation only',async()=>{
  const f=await fixture();
  try{
    await f.presentation.action('pastures','save',{id:'p1',name:'Piquete 1',farmUnitId:'farm-1',areaHa:10,targetHeightCm:30});
    await f.presentation.action('pastures','recordAssessment',{id:'assessment-1',pastureId:'p1',occurredAt:'2026-09-20T10:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:92});
    await f.presentation.action('pastures','saveRotationPlan',{id:'rotation-1',pastureId:'p1',lotId:'lot-1',plannedEnterAt:'2026-09-25T08:00:00Z',plannedLeaveAt:'2026-09-28T08:00:00Z'});
    const insights=await createDeepPastureInsights(f.db)({now:'2026-09-21T00:00:00Z'});
    const row=insights.rows.find(item=>item.id==='p1');
    assert.equal(row.latestAssessment.score,4);
    assert.equal(row.heightDeltaCm,-2);
    assert.equal(row.nextRotation.id,'rotation-1');
    assert.equal(insights.summary.assessedAreas,1);
    assert.equal(insights.summary.plannedRotations,1);
    assert.equal((await f.db.listRecords('cattle.pasture-derived')).length,0);
  }finally{await f.close()}
});
