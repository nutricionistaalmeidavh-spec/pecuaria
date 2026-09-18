import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvidence,selectInstaller} from '../tooling/certify-release.mjs';

test('certification rejects stale evidence',()=>{const head='a'.repeat(40);assert.throws(()=>validateEvidence(head,{phase5:{status:'passed',commit:'b'.repeat(40)},phase7:{status:'passed',commit:head},playwright:{status:'passed',commit:head}}),/stale/);});
test('certification rejects missing installer',()=>{assert.throws(()=>selectInstaller([],Date.now()),/installer not found/i);});
test('certification rejects installer older than evidence',()=>{assert.throws(()=>selectInstaller([{name:'x.exe',size:2*1024*1024,mtimeMs:100}],200),/older than current QA evidence/);});
