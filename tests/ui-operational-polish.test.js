import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFunctionalPresentation} from '../shared/packages/ui-shell/src/functional.js';
import {createCattleShellModel} from '../src/ui.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('money fields are presented in reais while contracts keep integer minor units',async()=>{
  const components=await read('web/components.jsx');
  assert.match(components,/const isMoneyField=/);
  assert.match(components,/replace\(\/\\s\*\\\(centavos\\\)\/i,' \(R\$\)'\)/);
  assert.match(components,/Math\.round\(parsed\*100\)/);
  assert.match(components,/inputMode=\{isMoneyField\(f\)\?'decimal'/);
});

test('technical finance ids are hidden and generated inside the UI boundary by action key',async()=>{
  const components=await read('web/components.jsx');
  assert.match(components,/const technicalFieldsByAction=/);
  assert.match(components,/'finance\.saveTitle':new Set\(\['id'\]\)/);
  assert.match(components,/'finance\.settleTitle':new Set\(\['id','operationId'\]\)/);
  assert.match(components,/'finance\.reverseSettlement':new Set\(\['id','operationId'\]\)/);
  assert.match(components,/crypto\.randomUUID\(\)/);
  assert.match(components,/ActionDialog\(\{open,definition,actionKey/);
});

test('workspace action labels are localized and domain table adds local usability',async()=>{
  const presentation=createFunctionalPresentation({shell:{navigation:[{id:'x',label:'X'}]},screens:{x:{actions:{registerBirth(){},settleTitle(){},reconcileStatement(){}}}}});
  assert.equal(presentation.screen('x').actionDefinitions.registerBirth.label,'Registrar nascimento');
  assert.equal(presentation.screen('x').actionDefinitions.settleTitle.label,'Baixar título');
  assert.equal(presentation.screen('x').actionDefinitions.reconcileStatement.label,'Conciliar extrato');
  const components=await read('web/components.jsx');
  assert.match(components,/data-testid="domain-table-search"/);
  assert.match(components,/data-testid="domain-table-sort"/);
});

test('finance workspace exposes contextual title settlement reversal and reconciliation actions',async()=>{
  const source=await read('web/finance-admin.jsx');
  for(const testId of ['finance-context-settle','finance-context-cancel','finance-context-reverse','finance-context-reconcile'])assert.match(source,new RegExp(`data-testid="${testId}`));
  assert.match(source,/Valor \(R\$\)/);
  assert.ok(!source.includes('ID da operação'));
  assert.match(source,/crypto\.randomUUID\(\)/);
});

test('contextual finance mutations follow the same allowed action set as generic workspace actions',async()=>{
  const [finance,main]=await Promise.all([read('web/finance-admin.jsx'),read('web/main.jsx')]);
  assert.match(finance,/FinanceAdminWorkspace\(\{data,onRun,allowedActions/);
  assert.match(finance,/const can=action=>allowedActions\.includes\(action\)/);
  for(const action of ['settleTitle','cancelTitle','reverseSettlement','reconcileStatement'])assert.match(finance,new RegExp(`can\\('${action}'\\)`));
  assert.match(main,/allowedActions=\{meta\?\.access\?\.finance\?\.actions\?\?\[\]\}/);
  assert.match(main,/actionKey=\{action\?`\$\{screenId\}\.\$\{action\}`:null\}/);
});

test('navigation and workspace copy reflect the deeper product surface',async()=>{
  const navigation=createCattleShellModel().navigation;
  assert.equal(navigation.find(item=>item.id==='finance').label,'Financeiro');
  assert.equal(navigation.find(item=>item.id==='tasks').label,'Manejo & Campo');
  const components=await read('web/components.jsx');
  for(const id of ['traceability','inventory','pastures','nutrition','tasks'])assert.match(components,new RegExp(`${id}:'`));
});

test('product status reflects that P1 is already merged on main',async()=>{
  const status=await read('PRODUCT_STATUS.md');
  assert.ok(!status.includes('antes do merge em `main`'));
  assert.match(status,/integrados? (?:ao|no) `main`/i);
});
