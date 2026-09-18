import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlaywrightSummary} from '../tooling/qa-web.mjs';

test('playwright summary binds status to commit and exit code',()=>{const summary=buildPlaywrightSummary({commit:'a'.repeat(40),exitCode:0,startedAt:'2026-09-18T12:00:00.000Z',finishedAt:'2026-09-18T12:01:00.000Z'});assert.equal(summary.status,'passed');assert.equal(summary.commit,'a'.repeat(40));assert.equal(summary.exitCode,0);});
test('playwright summary rejects malformed commit',()=>{assert.throws(()=>buildPlaywrightSummary({commit:'bad',exitCode:1,startedAt:'x',finishedAt:'y'}),/full git sha/);});
