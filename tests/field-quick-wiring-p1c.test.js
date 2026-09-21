import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('field sync preparation and imported operation application share normalizeFieldQuick',async()=>{
  const source=await readFile(new URL('../src/field-sync.js',import.meta.url),'utf8');
  assert.match(source,/export function normalizeFieldQuick\(/);
  assert.doesNotMatch(source,/function normalizeQuick\(/);
  const calls=[...source.matchAll(/normalizeFieldQuick\(/g)];
  assert.ok(calls.length>=3,'export plus prepare/apply calls must use the same normalizer');
});
