import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTION_FORMS} from '../web/action-config.js';
import {normalizeFieldQuick} from '../src/field-sync.js';

const product=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));

test('final P1 contract owns body condition under animals, not pastures',()=>{
  assert.equal(product.screens.length,17);
  assert.equal(Object.values(product.actions).flat().length,62);
  assert.equal(product.rpcMethods.length,18);
  assert.equal(product.rpcMethods.includes('maps'),true);
  assert.deepEqual(product.actions.animals,[
    'save','recordMilk','move','lifecycle','batchMove','batchLifecycle','recordBodyCondition','registerBirth'
  ]);
  assert.deepEqual(product.actions.pastures,['save','enterLot','leaveLot','recordAssessment','saveRotationPlan']);
  assert.ok(ACTION_FORMS.animals.recordBodyCondition);
  assert.equal(ACTION_FORMS.pastures.recordBodyCondition,undefined);
});

test('offline body score routes through the canonical animals action',()=>{
  const command=normalizeFieldQuick('animal.bodyScore',{
    animalId:'animal-1',
    occurredAt:'2026-09-21T10:00:00Z',
    score:3.5
  },'operation-body-score');
  assert.equal(command.screenId,'animals');
  assert.equal(command.action,'recordBodyCondition');
  assert.equal(command.input.animalId,'animal-1');
  assert.equal(command.input.score,3.5);
});
