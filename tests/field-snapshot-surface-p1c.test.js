import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const expected=[
  'cattle.tasks','cattle.animals','cattle.lots','cattle.sanitary-protocols','cattle.inventory',
  'cattle.events','cattle.traceability','cattle.pastures','cattle.pasture-occupancy','cattle.breeding-seasons',
  'cattle.reproduction-genetics','cattle.reproduction-dose-stock','cattle.body-condition','cattle.pasture-assessments','cattle.pasture-rotation-plan'
];

test('P1C field snapshot allowlist is exactly the approved 15 local collections',async()=>{
  const source=await readFile(new URL('../src/field-sync.js',import.meta.url),'utf8');
  const match=source.match(/const SNAPSHOT_COLLECTIONS=Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(match,'snapshot collection allowlist must remain explicit');
  const actual=[...match[1].matchAll(/'([^']+)'/g)].map(item=>item[1]);
  assert.deepEqual(actual,expected);
  assert.match(source,/FIELD_SYNC_VERSION=1/);
});
