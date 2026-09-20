import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('finance admin UI exposes operational local-first surfaces without raw JSON',async()=>{
  const [component,main,styles]=await Promise.all([
    readFile(new URL('../web/finance-admin.jsx',import.meta.url),'utf8').catch(()=>''),
    readFile(new URL('../web/main.jsx',import.meta.url),'utf8'),
    readFile(new URL('../web/styles.css',import.meta.url),'utf8')
  ]);
  const combined=[component,main,styles].join('\n');
  for(const id of ['finance-admin-workspace','finance-cash-summary','finance-titles','finance-forecast','finance-reconciliation','finance-import-statement','finance-import-invoice'])assert.match(combined,new RegExp(id),id);
  for(const text of ['Contas a pagar','Contas a receber','Previsto x realizado','Conciliação','Importar extrato','Ler XML/NF-e'])assert.match(combined,new RegExp(text),text);
  assert.doesNotMatch(combined,/action-json|JSON\.parse\(raw\)/);
  assert.match(main,/FinanceAdminWorkspace/);
  assert.match(styles,/finance-admin\.css/);
});

test('finance admin source keeps existing productive decision surface alongside administration',async()=>{
  const main=await readFile(new URL('../web/main.jsx',import.meta.url),'utf8');
  assert.match(main,/FinanceDecisionPanel/);
  assert.match(main,/FinanceAdminWorkspace/);
});
