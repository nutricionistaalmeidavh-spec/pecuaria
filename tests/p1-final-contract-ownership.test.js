import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTION_FORMS} from '../web/action-config.js';

const product=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));

test('final P1 contract owns body condition under animals, not pastures',()=>{
  assert.equal(product.screens.length,17);
  assert.equal(Object.values(product.actions).flat().length,62);
  assert.equal(product.rpcMethods.length,17);
  assert.deepEqual(product.actions.animals,[
    'save','recordMilk','move','lifecycle','batchMove','batchLifecycle','recordBodyCondition','registerBirth'
  ]);
  assert.deepEqual(product.actions.pastures,['save','enterLot','leaveLot','recordAssessment','saveRotationPlan']);
  assert.ok(ACTION_FORMS.animals.recordBodyCondition);
  assert.equal(ACTION_FORMS.pastures.recordBodyCondition,undefined);
});

test('offline body score routes through the canonical animals action',async()=>{
  const source=await readFile(new URL('../src/field-sync.js',import.meta.url),'utf8');
  assert.match(source,/animal\.bodyScore[\s\S]*screenId:'animals'[\s\S]*action:'recordBodyCondition'/);
});
