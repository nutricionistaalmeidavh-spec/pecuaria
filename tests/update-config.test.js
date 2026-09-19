import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('desktop updater is configured for GitHub Releases without silent download or install',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const main=await read('electron/main.mjs');
  const preload=await read('electron/preload.cjs');
  const updater=await read('electron/updater.mjs');
  assert.match(pkg.dependencies?.['electron-updater']??'',/^\^?6\./);
  assert.deepEqual(pkg.build?.publish,[{provider:'github',owner:'nutricionistaalmeidavh-spec',repo:'pecuaria',releaseType:'release'}]);
  assert.match(main,/createUpdateController/);
  assert.match(updater,/autoDownload\s*=\s*false/);
  assert.match(updater,/autoInstallOnAppQuit\s*=\s*false/);
  assert.match(preload,/updates/);
  assert.match(preload,/check/);
  assert.match(preload,/download/);
  assert.match(preload,/install/);
});

test('update controller source requires explicit user actions for download and install',async()=>{
  const source=await read('electron/updater.mjs');
  assert.match(source,/checkForUpdates/);
  assert.match(source,/downloadUpdate/);
  assert.match(source,/quitAndInstall/);
  assert.doesNotMatch(source,/autoDownload\s*=\s*true/);
  assert.doesNotMatch(source,/autoInstallOnAppQuit\s*=\s*true/);
});
