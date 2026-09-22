import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('P1 standardizes daily tables, statuses, detail drawer and contextual empty states',async()=>{
  const components=await source('../web/components.jsx');
  assert.match(components,/data-testid="status-filter"/);
  assert.match(components,/data-testid="record-detail-drawer"/);
  assert.match(components,/status-chip/);
  assert.match(components,/emptyStateByScreen/);
});

test('P1 exposes the six daily-efficiency workspaces without changing product actions',async()=>{
  const main=await source('../web/main.jsx');
  for(const component of ['P1ReportBuilder','P1TraceabilityPanel','P1InventoryPanel','P1NutritionPanel','P1DataTransferPanel','P1IoTDevicesPanel']){
    assert.match(main,new RegExp(component),`${component} must be wired in main.jsx`);
  }
  assert.match(main,/\.\/p1\.css/);
});

test('P1 components cover report preview/history, compliance, stock, nutrition, import wizard and device status',async()=>{
  const p1=await source('../web/p1-ux.jsx');
  for(const marker of ['p1-report-builder','report-preview','report-history','p1-traceability','traceability-filter','p1-inventory','inventory-alerts','p1-nutrition','nutrition-autonomy','p1-data-transfer','import-wizard','p1-iot-devices','iot-device-status']){
    assert.match(p1,new RegExp(marker),`${marker} must exist in P1 UX`);
  }
  assert.match(p1,/localStorage/);
  assert.match(p1,/SISBOV\/GTA/);
  assert.match(p1,/Simulador|simulador/);
});
