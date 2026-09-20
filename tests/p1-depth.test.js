import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventoryMovement,createPastureOccupancy,nutritionEconomics,P1_COLLECTIONS} from '../src/p1.js';
import {cattleProductionEconomics} from '../src/finance.js';
import {ACTION_FORMS} from '../web/action-config.js';

test('P1 depth exposes durable ledgers',()=>{
  assert.ok(P1_COLLECTIONS.includes('cattle.inventory-movements'));
  assert.ok(P1_COLLECTIONS.includes('cattle.pasture-occupancy'));
  const m=createInventoryMovement({id:'m1',itemId:'feed',type:'out',quantity:12,occurredAt:'2026-09-20'});
  assert.equal(m.quantity,12);
  const o=createPastureOccupancy({id:'o1',pastureId:'p1',lotId:'l1',enteredAt:'2026-09-20',animalUnits:20});
  assert.equal(o.animalUnits,20);
});

test('nutrition economics derives consumption and cost',()=>{
  const x=nutritionEconomics({plan:{dailyKgPerHead:2},headCount:10,feedCostMinorPerKg:150,days:3});
  assert.equal(x.totalKg,60);assert.equal(x.totalCostMinor,9000);assert.equal(x.costPerHeadDayMinor,300);
});

test('livestock economics exposes cost per gain arroba and margin',()=>{
  const entries=[{direction:'expense',amountMinor:30000,allocation:{id:'l1'}},{direction:'income',amountMinor:50000,allocation:{id:'l1'}}];
  const animals=[{lotId:'l1',status:'active',weights:[{weightKg:300},{weightKg:330}]}];
  const x=cattleProductionEconomics(entries,{lotId:'l1',animals});
  assert.equal(x.totalGainKg,30);assert.equal(x.marginMinor,20000);assert.ok(x.costPerKgGainMinor>0);assert.ok(x.costPerArrobaMinor>0);
});

test('P1 depth workflows are accessible in UI',()=>{
  for(const key of ['inventory.adjust','pastures.enterLot','pastures.leaveLot','nutrition.consume']){
    const [screen,action]=key.split('.');assert.ok(ACTION_FORMS[screen]?.[action],key);
  }
});
