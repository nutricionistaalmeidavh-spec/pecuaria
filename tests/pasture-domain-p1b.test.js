import test from 'node:test';
import assert from 'node:assert/strict';
import {P1_COLLECTIONS,createPasture,createPastureAssessment,createBodyCondition,createPastureRotationPlan} from '../src/p1.js';

test('P1B adds assessment body-condition and rotation collections',()=>{
  for(const collection of ['cattle.pasture-assessments','cattle.body-condition','cattle.pasture-rotation-plan'])assert.ok(P1_COLLECTIONS.includes(collection),collection);
  assert.equal(P1_COLLECTIONS.length,10);
});

test('pasture accepts local schematic fields and rejects invalid geometry/status',()=>{
  const pasture=createPasture({id:'p1',name:'Piquete 1',farmUnitId:'farm-1',areaHa:8.5,capacityAu:14,status:'available',color:'#778899',polygon:[{x:0,y:0},{x:80,y:0},{x:50,y:70}],restTargetDays:28,occupancyTargetDays:4,targetHeightCm:30,notes:'rotacao'});
  assert.equal(pasture.status,'available');assert.equal(pasture.polygon.length,3);assert.equal(pasture.targetHeightCm,30);
  assert.throws(()=>createPasture({...pasture,id:'bad',polygon:[{x:0,y:0},{x:150,y:0},{x:1,y:1}]}),/polygon|coordinate|0.*100/i);
  assert.throws(()=>createPasture({...pasture,id:'bad2',status:'invalid'}),/status/i);
});

test('pasture assessment validates scale measurements and local photo paths',()=>{
  const row=createPastureAssessment({id:'a1',pastureId:'p1',occurredAt:'2026-09-20',score:4,heightCm:32,forageMassKgHa:2800,groundCoverPct:92,notes:'boa',photoPaths:['photos/p1-1.jpg']});
  assert.equal(row.score,4);assert.equal(row.scaleMin,1);assert.equal(row.scaleMax,5);assert.deepEqual(row.photoPaths,['photos/p1-1.jpg']);
  assert.throws(()=>createPastureAssessment({...row,id:'bad',score:6}),/score|scale/i);
  assert.throws(()=>createPastureAssessment({...row,id:'bad2',groundCoverPct:101}),/cover|100/i);
  assert.throws(()=>createPastureAssessment({...row,id:'bad3',photoPaths:[{binary:true}]}),/photo/i);
});

test('body condition is observation-only and rotation plan dates/status are validated',()=>{
  const body=createBodyCondition({id:'bc1',animalId:'cow-1',occurredAt:'2026-09-20',score:3.5,notes:'campo'});
  assert.equal(body.score,3.5);assert.equal(body.scaleId,'bovine-1-5');
  assert.throws(()=>createBodyCondition({...body,id:'bad',score:0}),/score|scale/i);
  const plan=createPastureRotationPlan({id:'r1',pastureId:'p1',lotId:'l1',plannedEnterAt:'2026-09-21',plannedLeaveAt:'2026-09-25',status:'planned'});
  assert.equal(plan.status,'planned');
  assert.throws(()=>createPastureRotationPlan({...plan,id:'bad',plannedLeaveAt:'2026-09-20'}),/leave|after|date/i);
  assert.throws(()=>createPastureRotationPlan({...plan,id:'bad2',status:'done'}),/status/i);
});
