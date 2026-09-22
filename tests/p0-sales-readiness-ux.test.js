import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('P0 sales UX is exposed across the critical operational workspaces',async()=>{
  const [main,p0]=await Promise.all([
    source('web/main.jsx'),
    source('web/p0-ux.jsx')
  ]);
  const combined=`${main}\n${p0}`;

  for(const id of ['sanitary-tabs','trade-live-summary','settings-tabs','finance-admin-tabs','pasture-tabs','reproduction-tabs','animal-operations','animal-selection-count','weight-anomaly','field-action-groups','field-sync-status']){
    assert.match(combined,new RegExp(`(?:data-testid|testId)=["']${id}["']`),id);
  }
  for(const component of ['AnimalOperationsBar','P0CorralFlow','FieldP0CommandBar','SectionJumpNav','TradeLiveSummary','SettingsBackupPanel'])assert.match(main,new RegExp(component),component);
  assert.match(p0,/Registrar e próximo/,'pesagens deve priorizar operação contínua');
  assert.match(p0,/Brinco, RFID ou identificação/,'pesagem deve aceitar identificação operacional');
  assert.match(p0,/Peso fora do padrão esperado/,'pesagem deve exigir confirmação de anomalia');
  assert.match(p0,/Mover em lote/,'animais deve expor manejo coletivo contextual');
  assert.match(main,/TradeLiveSummary/,'simulação comercial deve expor resumo antes da persistência');
});
