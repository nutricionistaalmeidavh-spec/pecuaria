import test from 'node:test';
import assert from 'node:assert/strict';
import {createCattleShellModel} from '../src/ui.js';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';
import {ACTION_FORMS,actionFormKeys} from '../web/action-config.js';

test('P1 exposes Dispositivos e IoT in product navigation',()=>{
  const shell=createCattleShellModel();
  const item=shell.navigation.find(v=>v.id==='iot');
  assert.equal(item?.label,'Dispositivos e IoT');
});

test('IoT permissions are read-only for manager and write-capable for admin',()=>{
  assert.equal(SECURITY_POLICY.manager.includes('iot:read'),true);
  assert.equal(SECURITY_POLICY.manager.includes('iot:write'),false);
  assert.deepEqual(PRESENTATION_ACCESS.screens.iot,{read:'iot:read',write:'iot:write'});
  assert.deepEqual(SECURITY_POLICY.admin,['*']);
});

test('IoT operational forms cover configuration, lifecycle, RFID binding and simulator',()=>{
  assert.ok(ACTION_FORMS.iot);
  const expected=['saveDevice','removeDevice','testDevice','startDevice','stopDevice','bindRfid','unbindRfid','simulateRfid','simulateWeight'];
  for(const action of expected)assert.equal(actionFormKeys().includes(`iot.${action}`),true,action);
  const normalized=ACTION_FORMS.iot.saveDevice.normalize({id:'scale-1',name:'Balança',profileId:'serial-scale',stationId:'curral',port:'COM4',baudRate:'9600',enabled:'true'});
  assert.deepEqual(normalized.config,{port:'COM4',baudRate:9600});
  assert.equal(normalized.enabled,true);
});
