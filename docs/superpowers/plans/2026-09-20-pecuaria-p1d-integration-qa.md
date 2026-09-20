# ArtiSys Pecuária P1D — Integração, Contratos e Certificação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar e certificar P1A/P1B/P1C como uma única entrega comercial, garantindo compatibilidade, cobertura backend→UI, contratos exatos, E2E e preservação do core local-first sem custo recorrente.

**Architecture:** Este bloco não cria um quarto subsistema. Ele fecha lacunas de integração entre financeiro, pastagens e campo, fortalece os gates existentes e atualiza a documentação. `qa/product-contract.json` permanece a fonte contratual da superfície; `qa-phase5` continua fail-closed; GitHub Actions é a evidência final antes de merge.

**Tech Stack:** Node >=22, Node test runner, Playwright, Vite, Electron, QA tooling existente, GitHub Actions existente.

**Spec:** `docs/superpowers/specs/2026-09-20-pecuaria-p1-operational-depth-design.md`

## Global Constraints

- Superfície final esperada: **17 telas / 62 ações / 17 RPCs**.
- Não adicionar dependência SaaS/cloud/map/banking/fiscal ao core.
- Não alterar banco legado por backfill destrutivo; novas coleções são aditivas.
- Nenhuma ação de usuário nova pode existir apenas no backend ou apenas na UI.
- Não relaxar segurança/QA para fazer a suíte passar.
- Merge em `main` somente após testes locais disponíveis + CI do PR verde.

## Review Focus

1. Contratos podem parecer corretos mas esconder ação não executada; toda ação precisa cenário funcional real.
2. Banco antigo deve abrir e telas novas devem tratar coleções ausentes como vazias.
3. Campo offline deve chamar as mesmas ações/RBAC/auditoria do desktop, sem caminho privilegiado.
4. Integração de novos dados não pode quebrar relatórios, busca, backup, import/export ou dashboards existentes.
5. Nenhum gate pode passar usando contagem ou snapshot desatualizado.

---

### Task 1: Registro funcional exato das 62 ações

**Files:**
- Modify: `tests/product-actions.test.js`
- Modify: `tests/web-action-config.test.js`
- Modify: `tests/p0-ui-contract-coverage.test.js`

- [ ] Make the registry in `tests/product-actions.test.js` exactly match `qa/product-contract.json`, with 62 executable scenarios and no `skip`/placeholder. Keep dependency-safe execution order.
- [ ] Include assertions specific to new actions: birth creates event+animal, settlement changes derived open balance, reversal reopens, assessment/rotation/body score persist, imports are idempotent.
- [ ] Update `tests/web-action-config.test.js` expected count from the P0 hardcoded 49 to final 62 and ensure all 62 actions have typed form definitions.
- [ ] Update P0 parity test terminology without weakening it: assert 17 screens, 62 actions, 17 RPCs and retain checks that required newer RPCs exist.
- [ ] Run `node --test tests/product-actions.test.js tests/web-action-config.test.js tests/p0-ui-contract-coverage.test.js`; expected PASS.
- [ ] Run `npm run qa:surface` and assert the existing fail-closed evidence already reports screen/action/RPC counts; do not alter `tooling/qa-phase5.mjs` unless this assertion itself fails for a concrete defect.
- [ ] Commit: `test: enforce exact P1 action registry`.

---

### Task 2: Compatibilidade de banco e dados antigos

**Files:**
- Create: `tests/p1-backward-compatibility.test.js`

- [ ] Create an old-shape fixture using only collections/fields that existed at P0: legacy pasture status `active`, current `cattle.finance`, animals without body-condition data, no finance-admin collections.
- [ ] Open it with current presentation/runtime and load `finance`, `pastures`, `animals`, `tasks` without migration/backfill.
- [ ] Assert finance admin snapshot returns empty collections with valid derived summary; old productive financial rows still appear.
- [ ] Assert legacy pasture renders/normalizes operationally without rewriting the stored record merely by loading it.
- [ ] Assert missing assessments/body scores/rotation data result in `null`/empty/“Sem dados” contracts rather than exception or false zero.
- [ ] Assert backup/restore of this upgraded database still works with existing backup integrity tests.
- [ ] Run `node --test tests/p1-backward-compatibility.test.js tests/backup-integrity.test.js` and `npm run compat:contract`.
- [ ] Treat any compatibility-gate failure as an implementation defect first; do not change `tooling/compatibility-check.mjs` merely to permit new collections.
- [ ] Commit: `test: prove P1 backward data compatibility`.

---

### Task 3: Segurança, auditoria e ausência de bypass offline

**Files:**
- Modify: `tests/security-audit.test.js`
- Create: `tests/p1-security-integration.test.js`

- [ ] Add role matrix tests for admin/manager/finance/field-operator/viewer across finance mutations, pasture writes, RFID bind and field quick operations.
- [ ] Prove `fieldSync.quick` authorizes the authenticated actor and destination action; a field operator may perform cattle/pasture/RFID-bind actions explicitly allowed by policy but cannot exploit field sync to invoke finance actions because arbitrary `{screenId,action}` is not accepted.
- [ ] Prove granular `iot:bind` does not permit device save/remove/start/stop or IoT admin screen access for field operator.
- [ ] Assert audit actor is the authenticated user for birth, body score, assessment, settlement, reversal and field-import-applied actions.
- [ ] Assert audit serialization contains no session token, pairing key, password, raw XML/CSV contents or IoT credentials.
- [ ] Run `node --test tests/security-audit.test.js tests/p1-security-integration.test.js` and `npm run qa:security`.
- [ ] Treat a security gate failure as product/test failure; do not modify `tooling/security-gate.mjs` to whitelist P1 behavior.
- [ ] Commit: `test: harden P1 security and audit integration`.

---

### Task 4: E2E integrado de decisão e operação

**Files:**
- Create: `tests/e2e/p1-operational-depth.spec.mjs`
- Modify: `tests/e2e/full-surface.spec.mjs`
- Modify: `tests/e2e/p1-complete.spec.mjs`

**E2E journeys:**

1. Finance: create title -> partial settlement -> reversal -> verify reopened status/summary.
2. Pasture: create/update pasture -> assessment -> rotation plan -> verify local map/status/history.
3. Animal: register birth -> body score -> open Animal 360º and see timeline.
4. Field: open touch workspace -> representative quick operation -> queue/sync controls visible; no raw JSON.
5. Full surface: every contracted action button exists and opens a typed accessible dialog or dedicated UI.

- [ ] Write journey assertions against stable `data-testid`s, not CSS position/text alone.
- [ ] Preserve existing dashboard, reports, IoT and prior milestone E2E assertions while updating the old P1-complete expectations to the current final P1 surface.
- [ ] Ensure file import tests use in-memory Playwright files; no internet access and no real fiscal/bank endpoint.
- [ ] Add a mobile viewport test for field workspace ensuring controls do not require horizontal scrolling and core action targets are visible.
- [ ] Run `npm run build:web` then `npm run qa:web`; expected all Playwright specs PASS.
- [ ] Commit: `test: add integrated P1 operational E2E journeys`.

---

### Task 5: Contratos e baseline final

**Files:**
- Modify: `qa/product-contract.json`
- Modify: `qa/api-contract.json`
- Modify: `qa/api-contract.baseline.json`
- Modify: `tests/p2-gates.test.js`

**Final contract:**
- 17 screens.
- 62 presentation actions.
- 17 RPC methods.
- `animals`: previous 6 + `recordBodyCondition`, `registerBirth` = 8.
- `finance`: previous 2 + 9 admin actions = 11.
- `pastures`: previous 3 + `recordAssessment`, `saveRotationPlan` = 5.
- All other action lists unchanged from P0/P1A/P1B/P1C.

- [ ] Compare the two JSON contracts structurally and assert exact equality of projected content.
- [ ] Extend `tests/p2-gates.test.js` with the final projected contract digest/count expectations without weakening drift rejection tests.
- [ ] Generate the SHA-256 using `contractDigest(projectProductContract(product))` from `tooling/api-contract-gate.mjs`; write that exact digest to baseline.
- [ ] Run `npm run qa:contracts`; expected `[PASS] API contracts`.
- [ ] Run `npm run qa:surface`; verify evidence reports screens=17, actions=62, rpcMethods=17.
- [ ] Search tests/tooling/docs for stale hardcoded `49` action-count assertions and replace only where the value represents current surface, not historical documentation.
- [ ] Commit: `test: freeze final P1 product contract`.

---

### Task 6: Documentação comercial/técnica verdadeira

**Files:**
- Modify: `docs/FUNCTIONALITY_MATRIX.md`
- Modify: `PRODUCT_STATUS.md`

- [ ] Document finance admin: AP/AR, accounts, partial/full settlement, reversal, cash projection, manual CSV reconciliation and local XML suggestion; explicitly state no transmission fiscal/bank API.
- [ ] Document pasture depth: local schematic map, assessments, body score, rotation planned-vs-actual and derived metrics.
- [ ] Document expanded offline field operations and Animal 360º offline, including encrypted file sync/conflict handling.
- [ ] Preserve product-position limits: beef/general cattle management; do not claim full accounting ERP, full dairy, specialist feedlot/genetics/IATF/FIV/TE or complete official fiscal/SISBOV integration.
- [ ] Update source-of-truth counts to 17 screens / 62 actions / 17 RPCs.
- [ ] Verify documentation contains no claim of mandatory cloud, subscription or external paid dependency.
- [ ] Commit: `docs: document P1 operational depth`.

---

### Task 7: Full verification before PR

Run from a clean dependency state matching CI where possible:

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] `npm run qa:contracts`
- [ ] `npm run qa:security`
- [ ] `npm run qa:product`
- [ ] `npm run qa:web`
- [ ] `npm run compat:contract`
- [ ] Run the exact focused commands used by `.github/workflows/iot-p0.yml` and `.github/workflows/iot-p1.yml` to ensure field RFID work did not regress optional hardware.
- [ ] Inspect `package.json` diff and assert no mandatory remote-service dependency was added.
- [ ] Inspect `git diff main...HEAD` for unrelated changes and generated secrets/artifacts.

Expected result: all commands PASS with exact final contract 17/62/17.

- [ ] Commit only necessary verification/document corrections: `test: certify P1 operational depth`.

---

### Task 8: Review, PR, CI and merge

- [ ] Use `superpowers:requesting-code-review` against the complete branch diff, focusing on transactionality, idempotency, offline conflict protection, RBAC and contract parity.
- [ ] Address valid findings with targeted tests first, then implementation fixes; rerun affected focused tests and final gates.
- [ ] Open PR from `p1-operational-depth` to `main` describing P1A/P1B/P1C, final surface counts and local-first/no-recurring-cost invariant.
- [ ] Inspect actual GitHub Actions results. For any failure, inspect the concrete job logs and fix the underlying defect; never infer success from local checks alone.
- [ ] Require the hardening/QA workflow and IoT P0/P1 workflows relevant to the branch to complete successfully.
- [ ] Merge only when PR is mergeable and all relevant verification is green.
- [ ] After merge, fetch `main` commit and associated workflow runs; report the concrete merged SHA and CI evidence.
