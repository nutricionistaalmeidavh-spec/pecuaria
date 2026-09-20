# ArtiSys Pecuária P1B — Pastagens e Escores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aprofundar pastagens com estado operacional, avaliações, escore corporal, planejamento de rotação, mapa esquemático local e indicadores planejado x realizado, reaproveitando a ocupação e os insights históricos existentes.

**Architecture:** `src/p1.js` continua contendo os registros simples/repositórios P1. Um novo `PastureManagementService` concentra validações e mutações de avaliação/rotação, enquanto `src/services/pasture-history.js` permanece responsável por indicadores históricos e passa a combinar as novas coleções. A UI continua em `pastures`; o escore corporal também aparece no Animal 360º e é acionável em `animals`.

**Tech Stack:** Node >=22, persistência SQLite existente, React 19, SVG/CSS local para mapa esquemático, Vite 7, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-pecuaria-p1-operational-depth-design.md`

## Global Constraints

- Nenhum mapa/tile/API remoto; o desenho é local e esquemático.
- Não transformar o módulo em SIG/GIS agrícola.
- Fotos são referências de arquivo local; não armazenar base64/binário em registros ou sync.
- Escore padrão 1–5, configurável; o produto registra observação e não emite diagnóstico clínico.
- Planejamento de rotação nunca substitui histórico real de `cattle.pasture-occupancy`.
- Ausência de dado observacional é `null`/“Sem dados”, não zero inventado.
- P1A é pré-requisito de branch; este bloco adiciona 3 ações e leva a superfície intermediária a **61 ações**.

## Review Focus

1. Escore, altura, massa de forragem e cobertura fora da faixa devem ser rejeitados antes da escrita.
2. Indicadores não podem transformar dado ausente em zero observado.
3. Plano e ocupação real devem permanecer entidades distintas e comparáveis.
4. Coordenadas/polígonos inválidos não podem quebrar renderização nem persistir `NaN/Infinity`.
5. Referências de foto devem permanecer caminhos/metadados locais e nunca entrar como conteúdo binário.

---

### Task 1: Expandir modelo P1 e coleções

**Files:**
- Modify: `src/p1.js`
- Create: `tests/pasture-domain-p1b.test.js`
- Modify: `tests/p1-market-depth.test.js`
- Modify: `tests/p1-depth.test.js`

**Interfaces:**

```js
createPasture({...existing,color,polygon,status,restTargetDays,occupancyTargetDays,targetHeightCm,notes})
createPastureAssessment({id,pastureId,occurredAt,score,scaleMin=1,scaleMax=5,heightCm,forageMassKgHa,groundCoverPct,notes,photoPaths})
createBodyCondition({id,animalId,occurredAt,score,scaleId='bovine-1-5',scaleMin=1,scaleMax=5,notes})
createPastureRotationPlan({id,pastureId,lotId,plannedEnterAt,plannedLeaveAt,status='planned',notes})
```

- [ ] Write RED tests for the three new constructors and enhanced pasture fields.
- [ ] Define local polygon as `[{x,y}, ...]` with finite numeric coordinates normalized to range 0..100. Require at least three points when polygon is supplied. This is intentionally schematic, not latitude/longitude GIS.
- [ ] Validate pasture operational status in `available|occupied|resting|unavailable`; preserve compatibility by mapping legacy `active` to `available` on read/render rather than rewriting old records automatically.
- [ ] Validate assessment score within supplied scale; `heightCm`, `forageMassKgHa` non-negative; `groundCoverPct` 0..100; `photoPaths` strings only.
- [ ] Validate body condition score against scale bounds and valid date.
- [ ] Validate rotation plan leave date > enter date and status in `planned|active|completed|cancelled`.
- [ ] Add repositories for `cattle.pasture-assessments`, `cattle.body-condition`, `cattle.pasture-rotation-plan` and expand `P1_COLLECTIONS` accordingly. Update tests that currently assert length 7 to the exact new length 10.
- [ ] Run `node --test tests/pasture-domain-p1b.test.js tests/p1-market-depth.test.js tests/p1-depth.test.js` and verify PASS.
- [ ] Commit: `feat: add pasture assessment and rotation domain records`.

---

### Task 2: Serviço de manejo e invariantes de ocupação/rotação

**Files:**
- Create: `src/services/pasture-management.js`
- Create: `tests/pasture-management.test.js`
- Modify: `src/services/pasture-history.js`

**Interfaces:**

```js
createPastureManagementService(persistence) -> {
  savePasture(input), recordAssessment(input), recordBodyCondition(input),
  saveRotationPlan(input), enterLot(input), leaveLot(input), snapshot(options)
}
```

- [ ] Write RED tests for save/assessment/body score/plan and a full enter→leave occupancy cycle.
- [ ] Add test and implementation invariant: one lot may have at most one simultaneous active `cattle.pasture-occupancy`. A second active entry for the same lot is rejected before writing.
- [ ] Add test that one pasture with an active occupancy reports `occupied`; after final exit it reports `resting` until the configured rest target is met, then `available`, unless manually `unavailable`.
- [ ] Implement mutating methods using the existing P1 repositories. For multi-record status/occupancy changes use `persistence.transaction`.
- [ ] Reuse `createPastureOccupancy`; do not create another occupancy ledger.
- [ ] Extend `createDeepPastureInsights` to read assessments/rotation plans. Add `latestAssessment`, score trend, height/forage values, planned-vs-actual timing and configured target comparisons.
- [ ] Change existing places that return `0` for truly absent measured data to `null` where zero would falsely imply a measurement. Keep mathematically observed zeroes when derived from real records.
- [ ] Run `node --test tests/pasture-management.test.js tests/depth-roadmap.test.js` and verify PASS.
- [ ] Commit: `feat: add pasture management service and richer insights`.

---

### Task 3: Presentation actions, forms and contracts

**Files:**
- Modify: `src/presentation.js`
- Modify: `web/action-config.js`
- Modify: `tests/product-actions.test.js`
- Modify: `tests/web-action-config.test.js`
- Modify: `qa/product-contract.json`
- Modify: `qa/api-contract.json`
- Modify: `qa/api-contract.baseline.json`

**Contract changes:**
- `animals.recordBodyCondition`
- `pastures.recordAssessment`
- `pastures.saveRotationPlan`

Intermediate total after P1B: **17 screens / 61 actions / 17 RPCs**.

- [ ] Update tests first to require the three actions and 61 action forms/scenarios. Run focused tests and verify RED.
- [ ] Instantiate `PastureManagementService` in `createCattlePresentation` and route existing `pastures.save/enterLot/leaveLot` through it so one service owns pasture invariants.
- [ ] Add audited actions `pastures.recordAssessment`, `pastures.saveRotationPlan`, `animals.recordBodyCondition`.
- [ ] Extend `animals.load({animalId})` to include body-condition entries in Animal 360º timeline/detail without changing top-level screen ids.
- [ ] Add typed forms with reference selectors (`pastureId`, `lotId`, `animalId`), numeric scale fields, assessment measurements and rotation dates.
- [ ] For polygon editing, keep the normal generic action form simple: polygon points are edited by the dedicated pasture UI and normalized to array input; do not expose raw JSON to users.
- [ ] Update contracts and recompute contract baseline from the canonical gate implementation.
- [ ] Run `node --test tests/product-actions.test.js tests/web-action-config.test.js tests/depth-ui-parity.test.js` and `npm run qa:contracts`.
- [ ] Commit: `feat: expose pasture assessments rotation and body score`.

---

### Task 4: UI de pastagens e mapa esquemático local

**Files:**
- Create: `web/pasture-management.jsx`
- Create: `web/pasture-management.css`
- Modify: `web/main.jsx`
- Modify: `web/styles.css`
- Create: `tests/pasture-management-ui.test.js`
- Create: `tests/e2e/p1b-pastures.spec.mjs`

**Required UI test ids:** `pasture-management`, `pasture-status-cards`, `pasture-local-map`, `pasture-assessments`, `pasture-rotation-plan`, `pasture-plan-vs-actual`.

- [ ] Write RED source tests for the required surfaces, status labels, “Sem dados” behavior and absence of remote map URLs/scripts.
- [ ] Build a local SVG schematic map. Normalize each pasture polygon to the shared 0..100 coordinate space; if a pasture has no polygon, render a deterministic fallback card/tile rather than invent geographic coordinates.
- [ ] Render state `available/occupied/resting/unavailable`, current lot, UA/ha, capacity usage, days occupied/resting and latest assessment.
- [ ] Add assessment/history panel with score, height, mass, coverage and local photo path chips. Do not try to upload/synchronize image binaries.
- [ ] Add rotation plan list/timeline and planned-vs-actual variance. Plans remain visible after completion/cancellation.
- [ ] Add body-condition history to Animal 360º using existing detail patterns.
- [ ] Import `pasture-management.css` through `web/styles.css`; maintain responsive layout and no horizontal carousel.
- [ ] Playwright: navigate pastures, assert map is SVG/local, open three new action dialogs, ensure reference fields are selects, and assert missing measured values render `Sem dados`.
- [ ] Run `node --test tests/pasture-management-ui.test.js`, `npm run build:web`, and `npx playwright test tests/e2e/p1b-pastures.spec.mjs`.
- [ ] Commit: `feat: add local pasture planning and assessment UI`.

---

### Task 5: Search, transfer and reporting parity

**Files:**
- Modify: `src/services/search.js`
- Modify: `src/services/transfer.js`
- Modify: `src/services/reporting-base.js`
- Modify: `src/services/reporting.js`
- Modify: `tests/product-services.test.js`
- Create: `tests/pasture-reporting-p1b.test.js`

- [ ] Add tests proving assessments/rotation/body-condition records are locally searchable where appropriate without exposing unsupported binary data.
- [ ] Add transfer allow-list support for the new business collections; validate records before append and preserve duplicate-id rejection.
- [ ] Extend pasture report data with latest assessment and planned-vs-actual fields while keeping old columns/consumers backward readable.
- [ ] Verify old pasture records lacking all new fields still load and report without migration/backfill.
- [ ] Run `node --test tests/product-services.test.js tests/pasture-reporting-p1b.test.js` and then `npm test`.
- [ ] Commit: `feat: integrate pasture depth with local services and reports`.

---

### Task 6: P1B gate

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] `npm run qa:contracts`
- [ ] `npm run qa:security`
- [ ] `npm run qa:product`
- [ ] `npm run qa:web`
- [ ] Confirm exact checkpoint surface: 17 screens, 61 actions, 17 RPCs.
- [ ] Confirm no remote-map, upload or cloud dependency appears in `package.json` or web code.
- [ ] Commit any evidence/doc-only corrections as `test: certify P1B pasture depth`.
