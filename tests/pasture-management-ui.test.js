import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('pasture management UI exposes local schematic map, measured condition and rotation without cloud maps',async()=>{
  const ui=await source('web/pasture-management.jsx');
  assert.match(ui,/Mapa esquemático local/i);
  assert.match(ui,/operationalStatus/);
  assert.match(ui,/latestAssessment/);
  assert.match(ui,/rotationPlans/);
  assert.match(ui,/bodyCondition/);
  assert.match(ui,/<svg/i);
  assert.doesNotMatch(ui,/google\.maps|maps\.google|mapbox|leaflet/i);
});

test('main renders dedicated pasture management while preserving pasture decision analytics',async()=>{
  const main=await source('web/main.jsx');
  assert.match(main,/PastureManagementWorkspace/);
  assert.match(main,/screenId==='pastures'/);
  assert.match(main,/PastureDecisionPanel/);
});
