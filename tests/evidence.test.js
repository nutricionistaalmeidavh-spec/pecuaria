import test from 'node:test';
import assert from 'node:assert/strict';
import {currentCommit} from '../tooling/evidence.mjs';

test('currentCommit returns a full lowercase git sha', async()=>{
  assert.match(await currentCommit(), /^[0-9a-f]{40}$/);
});
