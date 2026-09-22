import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('P2 keeps profile preferences and telemetry local-only',async()=>{
  const runtime=await source('../web/p2-runtime.js');
  assert.match(runtime,/artisys-pecuaria:p2:prefs/);
  assert.match(runtime,/localStorage/);
  assert.match(runtime,/telemetry/);
  assert.match(runtime,/enabled/);
  assert.doesNotMatch(runtime,/fetch\s*\(/);
  assert.doesNotMatch(runtime,/WebSocket|XMLHttpRequest|sendBeacon/);
});

test('P2 exposes dashboard and field favorites plus adaptive density',async()=>{
  const p2=await source('../web/p2-ux.jsx');
  const dashboard=await source('../web/dashboard.jsx');
  const p0=await source('../web/p0-ux.jsx');
  assert.match(p2,/dashboard-favorites/);
  assert.match(p2,/density-control/);
  assert.match(dashboard,/P2DashboardControls/);
  assert.match(p0,/field-favorites/);
  assert.match(p0,/P2FieldFavorites/);
});

test('P2 standardizes intent microcopy and keyboard accessibility',async()=>{
  const components=await source('../web/components.jsx');
  assert.match(components,/skip-link/);
  assert.match(components,/main-content/);
  assert.match(components,/intentLabel/);
  assert.match(components,/Novo lote/);
  assert.match(components,/Novo insumo/);
  assert.match(components,/Registrar pesagem/);
  assert.match(components,/Escape/);
  assert.match(components,/recordLocalTelemetry/);
});

test('P2 design tokens cover controls tables alerts empty states confirmation and focus',async()=>{
  const css=await source('../web/p2.css');
  for(const token of ['--p2-control-height','--p2-focus-ring','--p2-radius','--p2-touch-target','--p2-danger','--p2-warning'])assert.match(css,new RegExp(token));
  for(const selector of [':focus-visible','.domain-table','.status','.empty.contextual','.dialog','prefers-reduced-motion'])assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
