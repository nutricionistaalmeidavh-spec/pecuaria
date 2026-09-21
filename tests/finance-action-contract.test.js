import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_FORMS} from '../web/action-config.js';

test('statement reconciliation form uses rowId and adjustment mode without technical record ids',()=>{
  const form=ACTION_FORMS.finance.reconcileStatement;
  const names=form.fields.map(field=>field.name);
  assert.ok(names.includes('rowId'));
  assert.ok(names.includes('mode'));
  assert.ok(names.includes('settlementId'));
  assert.ok(names.includes('operationId'));
  assert.ok(names.includes('accountId'));
  assert.ok(!names.includes('adjustmentTitleId'));
  assert.ok(!names.includes('adjustmentSettlementId'));
  const normalized=form.normalize({rowId:' row-1 ',mode:'adjustment',operationId:' op-1 ',accountId:' bank ',categoryId:' cat ',description:' ajuste '});
  assert.deepEqual(normalized,{rowId:'row-1',mode:'adjustment',settlementId:null,operationId:'op-1',accountId:'bank',categoryId:'cat',description:'ajuste',notes:null});
});
