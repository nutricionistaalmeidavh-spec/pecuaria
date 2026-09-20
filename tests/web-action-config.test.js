import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTION_FORMS,actionFormKeys} from '../web/action-config.js';

const contract=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));
const expected=Object.entries(contract.actions).flatMap(([screen,actions])=>actions.map(action=>`${screen}.${action}`)).sort();

test('every contracted action has a typed operational form definition',()=>{
  assert.ok(expected.every(key=>actionFormKeys().includes(key)));
  assert.equal(expected.length,25);
  for(const [screen,actions] of Object.entries(contract.actions)){
    for(const action of actions){
      const form=ACTION_FORMS[screen][action];
      assert.equal(typeof form.title,'string');
      assert.ok(Array.isArray(form.fields));
      assert.equal(typeof form.normalize,'function');
      for(const field of form.fields){
        assert.ok(field.name);
        assert.ok(['text','number','date','datetime-local','select','textarea','list','password'].includes(field.type));
      }
    }
  }
});

test('normalizers convert numeric and list fields before RPC',()=>{
  const weight=ACTION_FORMS.weights.record.normalize({id:'a1',weightKg:'410.5',measuredAt:'2026-09-19T12:00'});
  assert.equal(weight.weightKg,410.5);
  assert.equal(typeof weight.weightKg,'number');

  const sale=ACTION_FORMS.trades.create.normalize({id:'t1',type:'sale',partyId:'p1',animalIds:'a1, a2\na3',totalAmountMinor:'250000',occurredAt:'2026-09-19T12:00'});
  assert.deepEqual(sale.animalIds,['a1','a2','a3']);
  assert.equal(sale.totalAmountMinor,250000);

  const device=ACTION_FORMS.iot.saveDevice.normalize({id:'scale-1',name:'Balança',profileId:'mqtt-scale',stationId:'curral',url:'mqtt://192.168.1.20:1883',topics:'peso, status',username:'local',password:'segredo'});
  assert.deepEqual(device.config.topics,['peso','status']);
  assert.equal(device.config.password,'segredo');
});

test('normal UI source does not expose the raw JSON action editor',async()=>{
  const main=await readFile(new URL('../web/main.jsx',import.meta.url),'utf8');
  assert.ok(!main.includes('action-json'));
  assert.ok(!main.includes('JSON.parse(raw)'));
});
