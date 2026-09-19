import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('GitHub release workflow certifies and publishes Windows updater assets',async()=>{
  const workflow=await read('.github/workflows/release.yml');
  for(const token of [
    'windows-latest',
    'npm run qa:web',
    'npm run qa:surface',
    'npm run qa:contracts',
    'npm run qa:security:release',
    'npm run qa:product',
    'npm run phase7',
    'npm run build:win',
    'npm run qa:release-run',
    'npm run qa:release-validator',
    'npm run phase8:certify',
    'softprops/action-gh-release'
  ]) assert.match(workflow,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),token);
  assert.match(workflow,/release\/latest\.yml/);
  assert.match(workflow,/ArtiSys-Pecuaria-Setup-\*/);
  assert.match(workflow,/tags:\s*[\s\S]*v\*/);
});

test('release run evidence can be produced natively without Woodpecker or a customer database',async()=>{
  const source=await read('tooling/release-run.mjs');
  assert.match(source,/github-actions/);
  assert.match(source,/release-run\.json/);
  assert.match(source,/ArtiSys-Pecuaria-Setup-/);
  assert.doesNotMatch(source,/ARTISYS_UTILIDADES_PATH/);
  assert.doesNotMatch(source,/ARTISYS_LEGACY_DB/);
});

test('package uses a stable public release version compatible with normal updater channel',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
  assert.equal(pkg.scripts['qa:release-run'],'node tooling/release-run.mjs');
  assert.deepEqual(pkg.build.publish,[{provider:'github',owner:'nutricionistaalmeidavh-spec',repo:'pecuaria',releaseType:'release'}]);
});
