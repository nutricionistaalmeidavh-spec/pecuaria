import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('animal presentation exposes transactional registerBirth and explicit birth timeline label',async()=>{
  const source=await readFile(new URL('../src/presentation.js',import.meta.url),'utf8');
  assert.match(source,/registerBirth:audited\('cattle\.animal\.birth\.register'/);
  assert.match(source,/persistence\.transaction\(write\)/);
  assert.match(source,/e\.kind==='birth'\?'Nascimento'/);
});
