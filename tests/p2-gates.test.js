import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contractDigest,projectProductContract,validateContractSnapshot} from '../tooling/api-contract-gate.mjs';
import {evaluateSecurity,npmAuditInvocation} from '../tooling/security-gate.mjs';
import {evaluateProductQa} from '../tooling/product-qa-gate.mjs';
import {validateReleaseEvidence} from '../tooling/release-validator-gate.mjs';

const commit='a'.repeat(40);

test('API contract digest ignores object key order but detects real contract drift',()=>{
  const a={productId:'agro-pecuaria',actions:{lots:['save','remove']},screens:['overview','lots']};
  const b={screens:['overview','lots'],actions:{lots:['save','remove']},productId:'agro-pecuaria'};
  assert.equal(canonicalJson(a),canonicalJson(b));
  assert.equal(contractDigest(a),contractDigest(b));
  const baseline={schemaVersion:1,sha256:contractDigest(a)};
  assert.equal(validateContractSnapshot({declared:a,current:b,baseline}),true);
  assert.throws(()=>validateContractSnapshot({declared:a,current:{...b,screens:['overview']},baseline}),/drift/i);
  assert.throws(()=>validateContractSnapshot({declared:a,current:b,baseline:{schemaVersion:1,sha256:'bad'}}),/baseline/i);
});

test('final P1 contract projection is frozen at 17/62/17',async()=>{
  const [product,declared,baseline]=await Promise.all([
    readFile(new URL('../qa/product-contract.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../qa/api-contract.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../qa/api-contract.baseline.json',import.meta.url),'utf8').then(JSON.parse)
  ]);
  const current=projectProductContract(product);
  assert.equal(current.screens.length,17);
  assert.equal(Object.values(current.actions).flat().length,62);
  assert.equal(current.rpcMethods.length,17);
  assert.deepEqual(declared,current);
  assert.equal(contractDigest(current),baseline.sha256);
  assert.equal(validateContractSnapshot({declared,current,baseline}),true);
});

test('security gate uses cmd.exe for npm audit on Windows instead of spawning npm.cmd directly',()=>{
  const invocation=npmAuditInvocation('win32',{ComSpec:'C:\\Windows\\System32\\cmd.exe'});
  assert.equal(invocation.command,'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(invocation.args,['/d','/s','/c','npm audit --omit=dev --json']);
  assert.equal(npmAuditInvocation('linux',{}).command,'npm');
  assert.deepEqual(npmAuditInvocation('linux',{}).args,['audit','--omit=dev','--json']);
});

test('security gate is fail-closed for high critical unknown and release medium findings',()=>{
  const clean={metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0}}};
  assert.equal(evaluateSecurity({mode:'commit',audit:clean,secretFindings:[],semgrep:{errors:[],results:[]}}).status,'passed');
  assert.equal(evaluateSecurity({mode:'commit',audit:{metadata:{vulnerabilities:{high:1,total:1}}},secretFindings:[],semgrep:{errors:[],results:[]}}).status,'blocked');
  assert.equal(evaluateSecurity({mode:'commit',audit:clean,secretFindings:[{path:'x'}],semgrep:{errors:[],results:[]}}).status,'blocked');
  assert.equal(evaluateSecurity({mode:'commit',audit:clean,secretFindings:[],semgrep:{errors:[{message:'scanner failed'}],results:[]}}).status,'blocked');
  assert.equal(evaluateSecurity({mode:'release',audit:{metadata:{vulnerabilities:{moderate:1,total:1}}},secretFindings:[],semgrep:{errors:[],results:[]}}).status,'blocked');
  assert.equal(evaluateSecurity({mode:'commit',audit:{metadata:{vulnerabilities:{total:1}}},secretFindings:[],semgrep:{errors:[],results:[]}}).status,'blocked');
});

test('Product QA blocks missing, stale or failed required evidence and high findings',()=>{
  const passed=name=>({name,status:'passed',commit,blockedFindings:[]});
  const evidence={phase5:passed('phase5'),playwright:passed('playwright'),contracts:passed('contracts'),security:passed('security')};
  assert.equal(evaluateProductQa({commit,evidence}).status,'passed');
  assert.equal(evaluateProductQa({commit,evidence:{...evidence,security:{...passed('security'),status:'blocked'}}}).status,'blocked');
  assert.equal(evaluateProductQa({commit,evidence:{...evidence,contracts:{...passed('contracts'),commit:'b'.repeat(40)}}}).status,'blocked');
  assert.equal(evaluateProductQa({commit,evidence:{...evidence,security:{...passed('security'),blockedFindings:[{severity:'HIGH'}]}}}).status,'blocked');
  assert.equal(evaluateProductQa({commit,evidence:{phase5:evidence.phase5}}).status,'blocked');
});

test('release validator binds installer and every required evidence item to the same commit',()=>{
  const evidence=Object.fromEntries(['phase5','phase7','playwright','productQa','security','contracts'].map(name=>[name,{status:'passed',commit}]));
  const installer={name:'ArtiSys-Pecuaria-Setup-1.0.0.exe',size:2_000_000,sha256:'c'.repeat(64),mtimeMs:2000};
  const run={status:'passed',commit,startedAt:new Date(1000).toISOString(),installer:{name:installer.name,sha256:installer.sha256}};
  assert.equal(validateReleaseEvidence({commit,evidence,installer,run}).status,'passed');
  assert.throws(()=>validateReleaseEvidence({commit,evidence:{...evidence,phase7:{status:'passed',commit:'b'.repeat(40)}},installer,run}),/stale/i);
  assert.throws(()=>validateReleaseEvidence({commit,evidence,installer:{...installer,sha256:'d'.repeat(64)},run}),/hash/i);
  assert.throws(()=>validateReleaseEvidence({commit,evidence,installer:null,run}),/installer/i);
  assert.throws(()=>validateReleaseEvidence({commit,evidence:{...evidence,security:{status:'blocked',commit}},installer,run}),/security/i);
});
