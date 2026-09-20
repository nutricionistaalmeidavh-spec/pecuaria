# ArtiSys Pecuária P1C — Campo Offline Completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir o modo campo offline existente para reprodução, nascimento, desmame, baixa, RFID, rastreabilidade, manejo coletivo, pastagens, escores e consulta Animal 360º, preservando a sincronização AES-GCM e a idempotência já existentes.

**Architecture:** O fluxo continua `FieldMobileWorkspace -> backend.fieldSync('quick') -> normalizeFieldQuick -> presentation.action`. Não haverá segundo banco, segundo protocolo ou comando arbitrário. O snapshot da base é ampliado com as coleções necessárias; operações locais continuam na fila com `operation.id` e são confirmadas por receipts. `animals.registerBirth` é a única nova ação deste bloco e é transacional.

**Tech Stack:** Web Crypto AES-GCM, Node >=22, SQLite/persistência atual, React 19/PWA existente, Vite 7, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-pecuaria-p1-operational-depth-design.md`

## Global Constraints

- Nenhuma dependência de internet para registrar ou consultar os fluxos deste bloco.
- Não transportar senha/token de sessão dentro do pacote offline.
- Não colocar fotos/binários no bundle; somente metadados/caminhos já permitidos.
- `operation.id` continua a chave de idempotência e `RECEIPTS` a prova de aplicação remota.
- Snapshot recebido nunca sobrescreve entidade tocada por operação local pendente/conflitada.
- P1A e P1B já devem estar na mesma branch antes da execução deste plano.
- A superfície final passa a **17 telas / 62 ações / 17 RPCs**; não criar RPC novo para quick operations.
- `FIELD_SYNC_VERSION` permanece 1 porque a expansão é aditiva e o envelope/estrutura criptografada existente continua compatível; isso é protegido por teste de pacote legado.

## Review Focus

1. Reimportar o mesmo bundle nunca pode duplicar peso, evento, nascimento, baixa, avaliação ou movimentação.
2. `registerBirth` deve criar animal e evento de nascimento na mesma transação ou não criar nada.
3. Bundle adulterado, expirado ou com chave errada deve falhar antes de qualquer escrita.
4. Snapshot não pode apagar/retroceder dados locais associados a operações ainda pendentes.
5. Quick kind desconhecido deve falhar fechado; nunca aceitar `{screenId,action}` arbitrário vindo do arquivo.

---

### Task 1: Nascimento transacional como ação contratada

**Files:**
- Create: `src/birth.js`
- Create: `tests/birth-transaction.test.js`
- Modify: `src/index.js`
- Modify: `src/presentation.js`

**Interfaces:**

```js
createBirthRecords({id,tag,farmUnitId,birthDate,sex,damId,sireId,lotId,breedId,categoryId,rfid,notes})
// -> {
//   animal,
//   birthEvent:{id:`${id}:birth`,kind:'birth',type:'birth',animalId:id,relatedAnimalId:damId,occurredAt:birthDate,metadata:{sireId,notes}}
// }
```

- [ ] Write RED unit tests validating required `id/tag/farmUnitId/birthDate/sex`, optional parents/lot/RFID and the exact deterministic event id `${id}:birth`.
- [ ] Write RED integration test against real persistence: valid birth saves calf + `kind:'birth'` event; invalid dam/sire/lot or duplicate animal id leaves neither side partially written.
- [ ] Implement pure `createBirthRecords`; use `createAnimal` for the calf and build the exact dedicated birth event above. Do not overload `recordReproductionEvent` or invent another birth representation.
- [ ] Add `animals.registerBirth` in presentation. Validate referenced dam/sire/lot before writes and wrap both writes in `persistence.transaction`.
- [ ] Audit once with action `cattle.animal.birth.register` and entityId equal to calf id; do not leak full notes/identifiers into audit metadata.
- [ ] Extend Animal 360º timeline rendering so `kind:'birth'` is presented as nascimento instead of falling through to reprodução.
- [ ] Run `node --test tests/birth-transaction.test.js` and verify PASS.
- [ ] Commit: `feat: add atomic animal birth registration`.

---

### Task 2: Normalização explícita de todos os quick kinds

**Files:**
- Modify: `src/field-sync.js`
- Create: `tests/field-quick-contract-p1c.test.js`

**Interface change:** export a testable pure function `normalizeFieldQuick(kind,input,operationId)` and keep the service calling that same function.

**Exact mappings:**

```text
reproduction.record      -> reproduction.record
animal.birth             -> animals.registerBirth
animal.weaning           -> reproduction.record(type=weaning)
animal.death             -> animals.lifecycle(type=death)
rfid.bind                -> iot.bindRfid
traceability.save        -> traceability.save
animal.batchMove         -> animals.batchMove
animal.batchLifecycle    -> animals.batchLifecycle
sanitary.batchRecord     -> sanitary.batchRecord
reproduction.batchRecord -> reproduction.batchRecord
pasture.enterLot         -> pastures.enterLot
pasture.leaveLot         -> pastures.leaveLot
animal.bodyScore         -> animals.recordBodyCondition
pasture.score            -> pastures.recordAssessment
```

- [ ] Write a table-driven RED test covering every existing quick kind plus all 14 new mappings and exact normalized inputs.
- [ ] Add negative cases: empty ids, non-positive weight, invalid date, empty batch, invalid score payload and unknown kind.
- [ ] Refactor current internal `normalizeQuick` into exported `normalizeFieldQuick` without changing existing semantics for task/weight/move/sanitary.
- [ ] Ensure generated event ids use `operationId` deterministically where an id was omitted. Never use `Date.now()` for a remote-replayed operation id.
- [ ] Update `touchesSnapshot` for every affected collection/entity. Batch operations must protect every referenced animal plus any shared inventory/pasture record they mutate.
- [ ] Run `node --test tests/field-quick-contract-p1c.test.js tests/field-mobile-offline.test.js` and verify PASS.
- [ ] Commit: `feat: expand deterministic field quick command contract`.

---

### Task 3: Snapshot offline ampliado e conflito fail-closed

**Files:**
- Modify: `src/field-sync.js`
- Modify: `tests/field-mobile-offline.test.js`
- Create: `tests/field-sync-conflicts-p1c.test.js`

**Snapshot collections:** `cattle.tasks`, `cattle.animals`, `cattle.lots`, `cattle.sanitary-protocols`, `cattle.inventory`, `cattle.events`, `cattle.traceability`, `cattle.pastures`, `cattle.pasture-occupancy`, `cattle.breeding-seasons`, `cattle.reproduction-genetics`, `cattle.reproduction-dose-stock`, `cattle.body-condition`, `cattle.pasture-assessments`, `cattle.pasture-rotation-plan`.

- [ ] Write RED test proving a base export contains all collections after decryption/import into a paired field fixture, while the public bundle still exposes only ciphertext/metadata.
- [ ] Add a backward-compatibility fixture representing a valid version-1 bundle whose snapshot contains only the original five collections; current import must still accept it.
- [ ] Add conflict test: field has pending local body score/animal operation, base snapshot contains older same-entity data, import skips the touched entity and preserves pending local state.
- [ ] Add expired-bundle test using a validly encrypted fixture with past `expiresAt`; rejection occurs before `applySnapshot/applyOperations` writes anything.
- [ ] Add wrong-pairing/tamper test and assert collection record counts are unchanged after rejection.
- [ ] Expand `SNAPSHOT_COLLECTIONS`; keep field role as the only role applying snapshot and keep `FIELD_SYNC_VERSION=1`.
- [ ] Make snapshot application compare permitted collection names strictly and skip malformed sections/records without accepting an arbitrary collection injection.
- [ ] Run `node --test tests/field-mobile-offline.test.js tests/field-sync-conflicts-p1c.test.js`.
- [ ] Commit: `feat: expand secure field snapshot and conflict protection`.

---

### Task 4: Integração end-to-end dos quick operations e permissão RFID

**Files:**
- Create: `tests/field-operations-p1c.test.js`
- Modify: `src/security.js`
- Modify: `tests/security-audit.test.js`

- [ ] Build base/field fixtures like `tests/field-mobile-offline.test.js` with animals, lots, protocols, inventory, pasture, traceability, reproduction and IoT simulator state.
- [ ] For each new quick kind: configure pair, import base snapshot, execute quick on field, export bundle, import on base, assert the canonical business record changed exactly once.
- [ ] Replay the same field bundle and assert `applied=0`, operations become `skipped`, and record/event counts do not grow.
- [ ] Test `animal.birth` rollback by making its destination invalid on base; receipt must become conflict and neither calf nor event may exist.
- [ ] Test batch move/sanitary/reproduction with deterministic result ids. Replay must not duplicate child events or inventory consumption.
- [ ] Add granular permission `iot:bind`. Map `iot.bindRfid` and `iot.unbindRfid` to `iot:bind`; grant it to `manager` and `field-operator`. Do not grant `iot:write` or `iot:read` to `field-operator`, so device administration remains unavailable while curral RFID association works.
- [ ] Add security tests proving field operator can call only RFID bind/unbind through destination actions and cannot save/remove/start/stop IoT devices.
- [ ] Test RFID binding through `iot.bindRfid` and traceability through existing presentation actions; do not bypass RBAC/action audit.
- [ ] Verify returned field state pending/acknowledged/conflicts accurately follows receipts.
- [ ] Run `node --test tests/field-operations-p1c.test.js tests/security-audit.test.js` and existing field/IoT tests.
- [ ] Commit: `test: cover complete offline field operation round trips`.

---

### Task 5: Animal 360º offline e referências de campo

**Files:**
- Modify: `runtime/backend.mjs`
- Modify: `web/main.jsx`
- Modify: `web/field-mobile.jsx`
- Modify: `web/field-mobile.css`
- Create: `tests/field-animal360-p1c.test.js`

**Required UI test ids:** `field-operation-switcher`, `field-quick-reproduction`, `field-quick-birth`, `field-quick-lifecycle`, `field-quick-rfid`, `field-quick-traceability`, `field-quick-batch`, `field-quick-pasture`, `field-quick-scores`, `field-animal360`.

- [ ] Write RED source/UI tests for all sections and for offline Animal 360º fields: identity, lot, recent weight, body score, sanitary/reproduction/birth history, traceability and pending task.
- [ ] Expand backend `references` response with the local collections needed by field forms and offline Animal 360º. Do not add a network request or new RPC.
- [ ] Refactor `FieldMobileWorkspace` from all-cards-at-once into a touch-first operation selector with one focused panel at a time; preserve current task/weight/move/sanitary features.
- [ ] Add dedicated quick forms for reproduction, birth, lifecycle, RFID, traceability, batch, pasture and scores. Reuse large controls and existing `quick()` call.
- [ ] Build Animal 360º from the local reference/snapshot payload only. No fetch-on-open and no JSON editing.
- [ ] Ensure birth form uses explicit required/optional fields from spec and body/pasture score forms default to 1–5 scale.
- [ ] Keep buttons/selects usable at <=720px, no horizontal carousel and no hover-only control.
- [ ] Run `node --test tests/field-animal360-p1c.test.js tests/field-mobile-offline.test.js` and `npm run build:web`.
- [ ] Commit: `feat: expand touch first field workspace and offline animal 360`.

---

### Task 6: Contratos, forms e E2E final do campo

**Files:**
- Modify: `web/action-config.js`
- Modify: `tests/product-actions.test.js`
- Modify: `tests/web-action-config.test.js`
- Modify: `qa/product-contract.json`
- Modify: `qa/api-contract.json`
- Modify: `qa/api-contract.baseline.json`
- Create: `tests/e2e/p1c-field-offline.spec.mjs`

- [ ] Add typed operational form for `animals.registerBirth` and its executable product-action scenario. Update expected total to **62**.
- [ ] Keep quick kinds out of the top-level action contract unless they map to a presentation action; the contract counts actions, not aliases in field sync.
- [ ] Update product/API contract with only `animals.registerBirth`; RPC list remains exactly 17.
- [ ] Recompute baseline SHA from canonical contract tooling, not manually.
- [ ] E2E: log in, navigate tasks/field workspace, assert operation selector and Animal 360º, exercise representative birth/reproduction/pasture/score/RFID forms, and ensure no raw JSON control.
- [ ] Run `node --test tests/product-actions.test.js tests/web-action-config.test.js`, `npm run qa:contracts`, and `npx playwright test tests/e2e/p1c-field-offline.spec.mjs`.
- [ ] Commit: `feat: contract and verify complete offline field surface`.

---

### Task 7: P1C gate

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] `npm run qa:contracts`
- [ ] `npm run qa:security`
- [ ] `npm run qa:product`
- [ ] `npm run qa:web`
- [ ] Confirm exact surface: 17 screens, 62 actions, 17 RPCs.
- [ ] Confirm existing IoT P0/P1 tests still pass after granular `iot:bind` permission.
- [ ] Confirm the field bundle contains no session token/password and no binary photo payload.
- [ ] Commit evidence/doc-only corrections as `test: certify P1C complete field offline workflow`.
