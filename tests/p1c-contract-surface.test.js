import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTION_FORMS,actionFormKeys} from '../web/action-config.js';

const product=JSON.parse(await readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8'));
const api=JSON.parse(await readFile(new URL('../qa/api-contract.json',import.meta.url),'utf8'));
const countActions=contract=>Object.values(contract.actions).reduce((sum,actions)=>sum+actions.length,0);

test('P1C final public surface is exactly 17 screens, 62 actions and 17 RPCs',()=>{
  assert.equal(product.screens.length,17);
  assert.equal(countActions(product),62);
  assert.equal(product.rpcMethods.length,17);
  assert.deepEqual(api.screens,product.screens);
  assert.deepEqual(api.actions,product.actions);
  assert.deepEqual(api.rpcMethods,product.rpcMethods);
  assert.deepEqual(product.actions.animals,['save','registerBirth','recordMilk','move','lifecycle','batchMove','batchLifecycle']);
  assert.equal(actionFormKeys().includes('animals.registerBirth'),true);
});

test('registerBirth has an explicit typed form and normalizes required and optional fields',()=>{
  const form=ACTION_FORMS.animals.registerBirth;
  assert.equal(form.title,'Registrar nascimento');
  const names=form.fields.map(field=>field.name);
  assert.deepEqual(names,['id','tag','farmUnitId','birthDate','sex','damId','sireId','lotId','breedId','categoryId','rfid','notes']);
  assert.equal(form.fields.find(field=>field.name==='farmUnitId').refCollection,'farms');
  assert.equal(form.fields.find(field=>field.name==='damId').refCollection,'animals');
  assert.equal(form.fields.find(field=>field.name==='lotId').refCollection,'lots');
  const normalized=form.normalize({
    id:' calf-qa ',tag:' C-001 ',farmUnitId:' farm-1 ',birthDate:'2026-09-20T10:00',sex:'female',damId:' dam-1 ',sireId:' ',lotId:' lot-1 ',breedId:' nelore ',categoryId:' cria ',rfid:' 9820001 ',notes:' nasceu bem '
  });
  assert.deepEqual(normalized,{
    id:'calf-qa',tag:'C-001',farmUnitId:'farm-1',birthDate:'2026-09-20T10:00:00.000Z',sex:'female',damId:'dam-1',sireId:null,lotId:'lot-1',breedId:'nelore',categoryId:'cria',rfid:'9820001',notes:'nasceu bem'
  });
});
