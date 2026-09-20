import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('finance UI labels live-weight arroba explicitly',async()=>{
  const source=await readFile(new URL('../web/components.jsx',import.meta.url),'utf8');
  assert.match(source,/Custo\/@ peso vivo/);
});

test('reproduction UI receives and renders derived management metrics',async()=>{
  const [main,components]=await Promise.all([
    readFile(new URL('../web/main.jsx',import.meta.url),'utf8'),
    readFile(new URL('../web/components.jsx',import.meta.url),'utf8')
  ]);
  assert.match(main,/ReproductionSummary records=\{rows\} metrics=\{data\?\.metrics\}/);
  assert.match(components,/Taxa de serviço/);
  assert.match(components,/Taxa de concepção/);
  assert.match(components,/Taxa de prenhez/);
  assert.match(components,/Perda gestacional/);
});

test('trade workspace exposes calculated carcass settlement instead of hiding it in metadata',async()=>{
  const source=await readFile(new URL('../web/components.jsx',import.meta.url),'utf8');
  assert.match(source,/metadata\?\.settlement/);
  assert.match(source,/carcassArrobas/);
  assert.match(source,/carcassYieldPct/);
  assert.match(source,/grossMinor/);
  assert.match(source,/netMinor/);
});
