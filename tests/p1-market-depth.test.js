import test from 'node:test';
import assert from 'node:assert/strict';
import {createTraceabilityRecord,createInventoryItem,createPasture,createNutritionPlan,createManagementTask,P1_COLLECTIONS} from '../src/p1.js';
import {ACTION_FORMS} from '../web/action-config.js';

test('P1 market depth exposes domain collections and UI workflows',()=>{
  assert.equal(P1_COLLECTIONS.length,7);
  for(const screen of ['traceability','inventory','pastures','nutrition','tasks'])assert.ok(ACTION_FORMS[screen]);
});

test('P1 traceability distinguishes official documents from internal identity',()=>{
  const row=createTraceabilityRecord({id:'tr-1',animalId:'a-1',officialId:'BR-1',type:'gta',documentNumber:'GTA-1',issuedAt:'2026-09-20T00:00:00Z'});
  assert.equal(row.type,'gta');assert.equal(row.officialId,'BR-1');
});

test('P1 inventory pasture nutrition and agenda validate operational data',()=>{
  assert.equal(createInventoryItem({id:'med-1',name:'Vacina',quantity:10,minQuantity:2}).quantity,10);
  assert.equal(createPasture({id:'p-1',name:'Piquete 1',farmUnitId:'f-1',areaHa:12}).areaHa,12);
  assert.equal(createNutritionPlan({id:'n-1',name:'Plano',lotId:'l-1',dailyKgPerHead:2.5,startsAt:'2026-09-20'}).lotId,'l-1');
  assert.equal(createManagementTask({id:'t-1',title:'Revisar lote',dueAt:'2026-09-21'}).status,'pending');
});
