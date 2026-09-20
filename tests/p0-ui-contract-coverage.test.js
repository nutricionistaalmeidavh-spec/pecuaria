import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectProductContract} from '../tooling/api-contract-gate.mjs';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('product contract certifies the complete 17-screen 49-action surface and supplemental RPCs',async()=>{
  const [product,declared]=await Promise.all([
    json('../qa/product-contract.json'),
    json('../qa/api-contract.json')
  ]);
  assert.equal(product.screens.length,17);
  assert.equal(Object.values(product.actions).flat().length,49);
  assert.deepEqual(declared.screens,product.screens);
  assert.deepEqual(declared.actions,product.actions);
  for(const method of ['insights','simulateSale','reproductionAdmin','userAdmin','fieldSync']){
    assert.ok(product.rpcMethods?.includes(method),`missing product RPC ${method}`);
    assert.ok(declared.rpcMethods?.includes(method),`missing declared RPC ${method}`);
  }
});

test('API contract projection keeps RPC methods in the certified snapshot',()=>{
  const projected=projectProductContract({
    productId:'agro-pecuaria',
    screens:['overview'],
    actions:{overview:[]},
    rpcMethods:['insights','simulateSale']
  });
  assert.deepEqual(projected.rpcMethods,['insights','simulateSale']);
});

test('professional reproduction UI exposes editing, stock adjustment and full service fields',async()=>{
  const ui=await readFile(new URL('../web/pro-management.jsx',import.meta.url),'utf8');
  for(const token of ['adjustDoseStock','Ajustar estoque','Motivo do ajuste','Data do ajuste','Doses utilizadas','Observações','Ativo','Editar cadastro']){
    assert.match(ui,new RegExp(token),token);
  }
});
