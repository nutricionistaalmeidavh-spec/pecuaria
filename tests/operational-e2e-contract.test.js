import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const contract=JSON.parse(await readFile(new URL('../qa/operational-e2e-contract.json',import.meta.url),'utf8'));
const spec=await readFile(new URL('./e2e/operational-coverage.spec.mjs',import.meta.url),'utf8').catch(()=>null);

test('operational E2E suite covers the 14 certified UI families',()=>{
  assert.ok(spec,'tests/e2e/operational-coverage.spec.mjs must exist');
  assert.equal(contract.families.length,14);
  for(const family of contract.families){
    assert.match(spec,new RegExp(`data-family=["']${family}["']|family\\(['"]${family}['"]`),`missing operational family ${family}`);
  }
});
