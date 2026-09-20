import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('Electron desktop bridge exposes search, alerts and references end to end',async()=>{
  const [main,preload]=await Promise.all([
    source('../electron/main.mjs'),
    source('../electron/preload.cjs')
  ]);
  for(const method of ['search','alerts','references']){
    assert.match(main,new RegExp(`['"]${method}['"]`),`main IPC must expose ${method}`);
    assert.match(preload,new RegExp(`['"]${method}['"]`),`preload bridge must expose ${method}`);
  }
});

test('reference catalog returned to UI includes commercial and sanitary parties',async()=>{
  const backend=await source('../runtime/backend.mjs');
  assert.match(backend,/parties\s*:\s*unwrap\(data\.parties/);
});

test('lot result UI lets user choose a lot and loads finance with lot context',async()=>{
  const main=await source('../web/main.jsx');
  assert.match(main,/data-testid="finance-lot-selector"/);
  assert.match(main,/value=\{financeLotId\}/);
  assert.match(main,/lotId\s*:\s*financeLotId/);
});
