import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattleReportingService} from '../src/services/reporting.js';

test('pasture report preserves legacy columns and adds assessment plus planned-vs-actual fields',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-pasture-report-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  try{
    await db.putRecord('cattle.pastures','p1',{id:'p1',name:'Piquete 1',farmUnitId:'farm-1',areaHa:10,capacityAu:20,status:'available',forage:'Brachiaria'},{expectedVersion:0});
    await db.putRecord('cattle.pasture-assessments','a1',{id:'a1',pastureId:'p1',occurredAt:'2026-09-20T10:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:92,photoPaths:[]},{expectedVersion:0});
    await db.putRecord('cattle.pasture-rotation-plan','r1',{id:'r1',pastureId:'p1',lotId:'lot-1',plannedEnterAt:'2026-09-20T08:00:00Z',plannedLeaveAt:'2026-09-22T08:00:00Z',status:'completed'},{expectedVersion:0});
    await db.putRecord('cattle.pasture-occupancy','o1',{id:'o1',pastureId:'p1',lotId:'lot-1',enteredAt:'2026-09-20T10:00:00Z',leftAt:'2026-09-22T14:00:00Z',animalUnits:10},{expectedVersion:0});
    const report=await createCattleReportingService(db).build('pasture',{});
    const row=report.rows.find(item=>item.id==='p1');
    assert.equal(row.name,'Piquete 1');assert.equal(row.areaHa,10);assert.equal(row.activeOccupancies,0);
    assert.equal(row.latestAssessmentScore,4);assert.equal(row.latestHeightCm,28);assert.equal(row.latestForageMassKgHa,3200);assert.equal(row.latestGroundCoverPct,92);
    assert.equal(row.rotationPlanId,'r1');assert.equal(row.actualEnterAt,'2026-09-20T10:00:00Z');assert.equal(row.actualLeaveAt,'2026-09-22T14:00:00Z');
    assert.equal(row.enterVarianceHours,2);assert.equal(row.leaveVarianceHours,6);
  }finally{await db.close();await rm(dir,{recursive:true,force:true})}
});
