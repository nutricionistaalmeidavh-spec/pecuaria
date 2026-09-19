import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('P2 GitHub gate runs contracts security and product QA after functional evidence',async()=>{
  const workflow=await read('.github/workflows/p0-hardening.yml');
  const phase5=workflow.indexOf('npm run qa:surface');
  const contracts=workflow.indexOf('npm run qa:contracts');
  const security=workflow.indexOf('npm run qa:security');
  const product=workflow.indexOf('npm run qa:product');
  assert.ok(phase5>=0&&contracts>phase5&&security>contracts&&product>security);
});

test('Woodpecker remains manual-only and release wrapper runs P2 certification stages',async()=>{
  const woodpecker=await read('.woodpecker/artisys-release.yaml');
  const wrapper=await read('scripts/artisys-release.ps1');
  assert.match(woodpecker,/event:\s*\[manual\]/);
  assert.doesNotMatch(woodpecker,/event:\s*\[[^\]]*push/);
  for(const command of ['qa:security:release','qa:product','phase7','qa:release-validator','phase8:certify'])assert.match(wrapper,new RegExp(command.replaceAll(':','\\:')));
});

test('phase8 certification requires every P2 evidence file from the same commit',async()=>{
  const source=await read('tooling/certify-release.mjs');
  for(const file of ['product-qa-summary.json','security-summary.json','api-contract-summary.json','release-validation.json'])assert.match(source,new RegExp(file.replaceAll('.','\\.')));
});
