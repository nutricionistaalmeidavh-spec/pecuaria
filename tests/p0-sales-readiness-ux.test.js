import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('P0 sales UX is exposed across the critical operational workspaces',async()=>{
  const [main,components,finance,pastures,management,field]=await Promise.all([
    source('web/main.jsx'),
    source('web/components.jsx'),
    source('web/finance-admin.jsx'),
    source('web/pasture-management.jsx'),
    source('web/pro-management.jsx'),
    source('web/field-mobile.jsx')
  ]);

  assert.match(main,/data-testid="sanitary-tabs"/,'sanidade deve separar protocolos e aplicações');
  assert.match(main,/data-testid="trade-live-summary"/,'comercial deve expor resumo de fechamento em tempo real');
  assert.match(main,/data-testid="settings-tabs"/,'configurações deve ter subáreas persistentes');

  assert.match(components,/data-testid="animal-operations"/,'animais deve ter hierarquia operacional dedicada');
  assert.match(components,/data-testid="animal-selection-count"/,'animais deve expor seleção múltipla explícita');
  assert.match(components,/data-testid="weight-anomaly"/,'pesagens deve alertar valores improváveis');
  assert.match(components,/Registrar e próximo/,'pesagens deve priorizar operação contínua');

  assert.match(finance,/data-testid="finance-admin-tabs"/,'financeiro deve separar rotina administrativa em subáreas');
  assert.match(pastures,/data-testid="pasture-tabs"/,'pastagens deve reduzir a página longa com subáreas');
  assert.match(management,/data-testid="reproduction-tabs"/,'reprodução deve separar serviços, genética/doses e estações');
  assert.match(management,/data-testid="settings-admin-tabs"/,'administração deve separar usuários e permissões');
  assert.match(field,/data-testid="field-action-groups"/,'manejo/campo deve agrupar ações rápidas por intenção');
  assert.match(field,/data-testid="field-sync-status"/,'manejo/campo deve tornar sincronização e pendências proeminentes');
});
