import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('cattle map preserves spatial layers and operational detail',async()=>{
  const ui=await source('web/maps/cattle-map.jsx');
  for(const text of ['Piquetes','Lotes','Infraestrutura','Ocorrências','Sensores'])assert.match(ui,new RegExp(text));
  for(const token of ['currentLotName','animalUnits','data-testid="cattle-map"','map-accessible-list'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('offline map UX exposes install verify remove refresh and desktop-only state',async()=>{
  const ui=await source('web/maps/offline-maps.jsx');
  for(const text of ['Baixar mapa desta fazenda','Verificar integridade','Remover','Atualizar catálogo','Somente no desktop Windows'])assert.match(ui,new RegExp(text));
  assert.match(ui,/data-testid="offline-maps-workspace"/);
});

test('typed editor exposes pasture geometry, GeoJSON and cattle infrastructure without generic JSON action',async()=>{
  const ui=await source('web/maps/map-editor.jsx');
  for(const text of ['GeoJSON','Bebedouro','Cocho','Curral','Porteira','Saleiro','Balança','Sensor','Ocorrência','Área calculada'])assert.match(ui,new RegExp(text));
  assert.match(ui,/data-testid="cattle-map-editor"/);
  assert.doesNotMatch(ui,/action-json/);
});
