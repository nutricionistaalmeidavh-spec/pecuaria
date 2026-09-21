# ArtiSys Pecuária P1A — Financeiro Administrativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar contas, títulos, baixas, estornos, fluxo de caixa, conciliação CSV e leitura local de XML/NF-e ao financeiro existente, sem substituir o financeiro produtivo por lote e sem criar dependência online.

**Architecture:** `src/finance.js` e `src/services/finance-depth.js` continuam responsáveis pela economia produtiva. O novo `FinanceAdminService` usa coleções próprias (`cattle.finance-*`), deriva saldo/status em vez de aceitar esses campos do cliente e é chamado pelas ações da tela `finance`. Todas as mutações críticas passam por transação e auditoria. A UI continua na tela `finance` e usa ações tipadas de `ACTION_FORMS`.

**Tech Stack:** Node >=22, SQLite/persistência genérica existente, React 19, Vite 7, Electron 44, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-pecuaria-p1-operational-depth-design.md`

## Global Constraints

- Core obrigatório R$ 0/mês, local-first e sem SaaS obrigatório.
- Não alterar a semântica de `cattle.finance`; ela continua sendo o ledger econômico produtivo atual.
- Valores monetários persistidos são inteiros em centavos.
- `openAmountMinor`, status de título e saldo de conta são derivados, nunca campos livremente graváveis pela UI.
- Não existe `openingBalanceMinor` editável. Um saldo inicial real deve ser representado por ajuste conciliatório explícito e auditável.
- Baixas e estornos são imutáveis; correção ocorre por novo movimento inverso.
- CSV/XML são processados localmente. Nenhuma chamada SEFAZ, Open Finance ou Pluggy.
- As 17 telas e os 17 RPCs permanecem; este bloco adiciona 9 ações à tela `finance`.

## Review Focus

1. Retry com o mesmo `operationId` não pode duplicar baixa ou estorno.
2. Overpayment, baixa em título cancelado e segundo estorno da mesma baixa devem falhar sem escrita parcial.
3. Status, valor aberto e saldo devem sempre ser derivados do histórico líquido de movimentos.
4. CSV/XML inválido ou reimportado não pode criar dados parciais/duplicados.
5. RBAC deve impedir que `field-operator`/`viewer` executem mutações financeiras administrativas.

---

### Task 1: Modelo de domínio financeiro administrativo

**Files:**
- Create: `src/finance-admin.js`
- Create: `tests/finance-admin.test.js`
- Modify: `src/index.js`

**Interfaces:**

```js
createFinanceAccount({id,name,kind='cash',active=true})
createFinanceCategory({id,name,direction='both',active=true})
createFinancialTitle({id,direction,description,originalAmountMinor,issuedAt,dueAt,categoryId,accountId,partyId,lotId,tradeId,documentRef,notes,source='manual'})
createSettlement({id,operationId,titleId,amountMinor,occurredAt,accountId,method,notes,reversesSettlementId=null})
deriveTitleState(title,settlements)
buildCashProjection({titles,settlements,accounts,asOf})
```

- [ ] Write failing tests asserting positive safe-integer money, valid `payable|receivable`, valid dates, optional references normalized to `null`, and that callers cannot inject `openAmountMinor`, `status` or account balance.
- [ ] Add tests for `deriveTitleState`: no settlement => `open`, partial => `partial`, exact total => `settled`, cancelled title => `cancelled`, reversal reopens the correct amount.
- [ ] Add tests for projection with realized inflow/outflow and 7/30/90-day buckets; missing account must remain unallocated rather than disappear.
- [ ] Run `node --test tests/finance-admin.test.js` and verify RED because `src/finance-admin.js` does not exist.
- [ ] Implement the constructors as pure functions. Reject non-safe-integer money and non-positive settlement amount. Freeze returned records.
- [ ] Implement `deriveTitleState` by netting normal settlements against reversal records; never trust stored status/open amount.
- [ ] Implement `buildCashProjection` from settlements/reversals only. An account with no observed movement has derived balance 0 with an explicit `movementCount:0`; no editable opening balance exists.
- [ ] Export the new module from `src/index.js`.
- [ ] Run `node --test tests/finance-admin.test.js` and verify PASS.
- [ ] Commit: `feat: add administrative finance domain model`.

---

### Task 2: Serviço transacional, idempotência e coleções

**Files:**
- Create: `src/services/finance-admin.js`
- Create: `tests/finance-admin-service.test.js`
- Modify: `src/services/search.js`
- Modify: `src/services/transfer.js`

**Interfaces:**

```js
createFinanceAdminService(persistence,{audit}) -> {
  snapshot(options),
  saveAccount(input,context), saveCategory(input,context), saveTitle(input,context),
  cancelTitle(input,context), settleTitle(input,context), reverseSettlement(input,context),
  importStatement(input,context), reconcileStatement(input,context), importInvoiceXml(input,context)
}
```

**Collections:** `cattle.finance-accounts`, `cattle.finance-titles`, `cattle.finance-settlements`, `cattle.finance-categories`, `cattle.finance-reconciliations`, `cattle.finance-imports`.

- [ ] Write failing integration tests using the real persistence adapter for account/category/title creation, partial settlement, full settlement, reversal and cancellation.
- [ ] Add RED tests proving: overpayment leaves title/settlements unchanged; cancelled title rejects settlement; duplicate `operationId` returns/reuses the prior logical result without a second movement; a settlement cannot be reversed twice.
- [ ] Implement repositories through `createEntityRepository` inside the service; do not add a second database adapter.
- [ ] Implement settlement and reversal in `persistence.transaction(...)`. Re-read title and its settlements inside the transaction before validating the new movement.
- [ ] Store `operationId` on settlement records and reject/reuse an existing record before any new write.
- [ ] `snapshot()` must return records plus derived title state, balances by account, overdue/upcoming lists and projection buckets.
- [ ] Add the six new collections to local search/transfer allow-lists where those services intentionally expose business data. Preserve strict product/collection validation.
- [ ] Run `node --test tests/finance-admin-service.test.js tests/product-services.test.js` and verify PASS.
- [ ] Commit: `feat: add transactional finance administration service`.

---

### Task 3: Parsers locais de extrato e XML/NF-e

**Files:**
- Create: `src/services/finance-import.js`
- Create: `tests/finance-import.test.js`
- Modify: `src/services/finance-admin.js`

**Interfaces:**

```js
parseStatementCsv(text,{sourceName}) -> {fileId,rows:[{id,occurredAt,description,amountMinor}]}
parseInvoiceXml(xml,{sourceName}) -> {documentNumber,issuedAt,totalAmountMinor,partyDocument,partyName,suggestion}
```

- [ ] Write RED tests for comma- and semicolon-delimited CSV with headers `date,description,amount`, decimal comma/point, malformed money, missing columns and blank lines.
- [ ] Define stable statement row id as SHA-256 of `sourceName + normalized file text + row index + normalized row content`; reimporting identical input must produce the same ids.
- [ ] Write RED XML tests with a minimal valid NF-e fixture extracting number/date/total/issuer-recipient useful fields, plus malformed XML, missing total and XXE/DOCTYPE rejection.
- [ ] Implement CSV parsing without a network/package dependency. Reject ambiguous or malformed lines rather than guessing monetary values.
- [ ] Implement a narrow NF-e XML parser sufficient for known tags. Reject `<!DOCTYPE`/`<!ENTITY`; do not resolve external entities and do not transmit anything.
- [ ] `importStatement` persists import metadata and unseen normalized rows transactionally; repeated file/row ids are skipped, not duplicated.
- [ ] `reconcileStatement({rowId,settlementId})` links one imported row to one existing settlement exactly once. `reconcileStatement({rowId,mode:'adjustment',accountId,operationId})` creates, in one transaction, a synthetic title with `source:'reconciliation-adjustment'` and a matching settlement whose direction comes from the imported row sign; ids are deterministic from `rowId`. This is the only way to represent an opening/manual bank adjustment without editable account balance.
- [ ] `importInvoiceXml` returns a proposal only. It must not create `cattle.finance-titles`; title creation remains a separate explicit `saveTitle` action after user confirmation.
- [ ] Run `node --test tests/finance-import.test.js tests/finance-admin-service.test.js` and verify PASS.
- [ ] Commit: `feat: add local statement and invoice import parsers`.

---

### Task 4: Apresentação, ações tipadas e RBAC

**Files:**
- Modify: `src/presentation.js`
- Modify: `src/security.js`
- Modify: `web/action-config.js`
- Modify: `tests/security-audit.test.js`
- Modify: `tests/product-actions.test.js`
- Modify: `tests/web-action-config.test.js`
- Modify: `qa/product-contract.json`
- Modify: `qa/api-contract.json`
- Modify: `qa/api-contract.baseline.json`

**Contract changes:** `finance` gains `saveAccount`, `saveCategory`, `saveTitle`, `cancelTitle`, `settleTitle`, `reverseSettlement`, `importStatement`, `reconcileStatement`, `importInvoiceXml`. Intermediate total after P1A: **17 screens / 58 actions / 17 RPCs**.

- [ ] First update tests to expect the nine new finance actions and 58 total actions; add scenario inputs for every new action in `tests/product-actions.test.js`. Run the focused tests and verify RED.
- [ ] Instantiate `createFinanceAdminService` once in `createCattlePresentation`; `finance.load` returns existing productive `rows/metrics` plus `admin: await financeAdmin.snapshot()`.
- [ ] Wire all nine actions through the existing audited presentation path. Do not create a new RPC.
- [ ] Add permissions `finance:write` and `finance:settle`. Give both to `manager` and `finance`; keep `field-operator`/`viewer` without them. Configure `finance` screen write=`finance:write`; map `settleTitle`, `reverseSettlement`, `reconcileStatement` to `finance:settle`.
- [ ] Add security tests proving the finance role can create/settle, manager can create/settle, and field/viewer cannot mutate.
- [ ] Add explicit typed forms for all nine actions. File imports use file-selection handling in the UI layer; no JSON text editor.
- [ ] Update both contracts identically. Recompute `qa/api-contract.baseline.json` using `contractDigest(projectProductContract(productContract))`; never paste an estimated hash.
- [ ] Run `node --test tests/security-audit.test.js tests/product-actions.test.js tests/web-action-config.test.js` and `npm run qa:contracts`.
- [ ] Commit: `feat: expose administrative finance actions securely`.

---

### Task 5: Finance UI operacional

**Files:**
- Create: `web/finance-admin.jsx`
- Create: `web/finance-admin.css`
- Modify: `web/main.jsx`
- Modify: `web/styles.css`
- Create: `tests/finance-admin-ui.test.js`
- Create: `tests/e2e/p1a-finance-admin.spec.mjs`

**Required UI test ids:** `finance-admin-workspace`, `finance-cash-summary`, `finance-titles`, `finance-forecast`, `finance-reconciliation`, `finance-import-statement`, `finance-import-invoice`.

- [ ] Write source/UI tests first asserting all required surfaces, payable/receivable filters, overdue state, settlement/reversal controls and no raw JSON editor. Verify RED.
- [ ] Build `FinanceAdminWorkspace` from backend `data.admin`. Keep existing `FinanceDecisionPanel` visible so productive DRE/lot economics are not displaced.
- [ ] Render account balances, realized entry/exit, due/overdue totals and 7/30/90 forecast. Use `—/Sem dados` for absent forecast observations while account balance explicitly displays 0 when there are zero recorded movements.
- [ ] Implement title list with status/due/category/party/lot and action affordances for settle/cancel/reverse based on state.
- [ ] Implement CSV/XML file reads in the browser and send file text/content to the typed presentation actions; do not add browser network calls.
- [ ] Add responsive styles and import `finance-admin.css` from `web/styles.css`.
- [ ] Playwright: log in, navigate to finance, assert old productive panel + new workspace, open all nine action forms, ensure no JSON textarea, and verify file inputs are local.
- [ ] Run `node --test tests/finance-admin-ui.test.js`, `npm run build:web`, and `npx playwright test tests/e2e/p1a-finance-admin.spec.mjs`.
- [ ] Commit: `feat: add operational administrative finance UI`.

---

### Task 6: P1A gate

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] `npm run qa:contracts`
- [ ] `npm run qa:security`
- [ ] `npm run qa:product`
- [ ] `npm run qa:web`
- [ ] Confirm contracts report exactly 17 screens, 58 actions, 17 RPCs at this checkpoint.
- [ ] Confirm no dependency was added to `package.json` for banking/fiscal/cloud services.
- [ ] Commit any evidence-only/document adjustments as `test: certify P1A administrative finance`.
