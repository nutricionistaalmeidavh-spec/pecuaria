import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('desktop bridge exposes audit and decision intelligence RPCs end to end',async()=>{
  const [backend,main,preload]=await Promise.all([source('../runtime/backend.mjs'),source('../electron/main.mjs'),source('../electron/preload.cjs')]);
  for(const method of ['audit','insights','simulateSale']){
    assert.match(backend,new RegExp(`async ${method}|${method}:`),`backend must expose ${method}`);
    assert.match(main,new RegExp(`['"]${method}['"]`),`main IPC must expose ${method}`);
    assert.match(preload,new RegExp(`['"]${method}['"]`),`preload must expose ${method}`);
  }
});

test('action results are surfaced: reports and exports download, validation and IoT diagnostics remain visible',async()=>{
  const main=await source('../web/main.jsx');
  assert.match(main,/function downloadActionResult/);
  assert.match(main,/artisys-pecuaria-export/);
  assert.match(main,/new Blob\(\[result\.content\]/);
  assert.match(main,/validateImport/);
  assert.match(main,/testDevice/);
  assert.match(main,/data\?\.issued/);
  assert.match(main,/data\?\.protocols/);
});

test('logout revokes backend session instead of only clearing React state',async()=>{
  const main=await source('../web/main.jsx');
  assert.match(main,/await backend\.logout\(auth\)/);
});

test('search routes every persisted product domain to a usable workspace',async()=>{
  const main=await source('../web/main.jsx');
  for(const target of ['animals','lots','sanitary','reproduction','trades','finance','inventory','traceability','pastures','nutrition','tasks','data','iot'])assert.match(main,new RegExp(`navigate\\('${target}'`));
});

test('existing modules expose pasture, reproduction, sanitary, field, reporting, intelligence and commercial-finance depth',async()=>{
  const [main,depth]=await Promise.all([source('../web/main.jsx'),source('../web/depth-components.jsx')]);
  for(const id of ['pasture-decision','reproduction-decision','sanitary-analytics','field-mode','advanced-reports','productive-intelligence','commercial-simulator','finance-decision','commercial-summary','iot-details','audit-panel'])assert.match(`${main}\n${depth}`,new RegExp(`data-testid=["']${id}["']`),`${id} must be visible in UI`);
});

test('advanced document definitions are available to the existing PDF/CSV actions',async()=>{
  const documents=await source('../src/documents.js');
  for(const type of ['reproduction','commercial','nutrition','finance','performance'])assert.match(documents,new RegExp(`['"]${type}['"]`));
});
