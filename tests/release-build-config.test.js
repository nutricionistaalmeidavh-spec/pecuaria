import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

test('Windows installer build never auto-publishes in CI',()=>{
  assert.match(pkg.scripts['build:win'],/--publish\s+never/);
});
