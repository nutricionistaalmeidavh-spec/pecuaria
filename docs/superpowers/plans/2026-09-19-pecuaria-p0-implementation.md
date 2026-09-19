# ArtiSys Pecuária P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer o núcleo do ArtiSys Pecuária para garantir persistência consistente, permissões explícitas, auditoria real, operações multi-entidade atômicas e QA das 16 ações do contrato.

**Architecture:** Preservar `__artisys_records` como source of truth e adicionar garantias no domínio/repository sem duplicar escrita nas tabelas `cattle_*`. Operações compostas serão executadas dentro de uma primitiva transacional SQLite adicionada ao adapter `vertical-persistence`; segurança e auditoria continuam locais e acopladas ao mesmo persistence adapter. O contrato de apresentação permanece o ponto de entrada, mas delega regras críticas para serviços/use-cases testáveis.

**Tech Stack:** Node.js >=22, ESM, `node:sqlite`/`DatabaseSync`, React/Electron existentes, Node test runner, Playwright existente, Woodpecker existente.

**Spec:** `docs/superpowers/specs/2026-09-19-pecuaria-hardening-design.md`

## Global Constraints

- Core R$ 0, self-hosted/local e open source.
- Nenhum SaaS pago como dependência silenciosa.
- Não quebrar compatibilidade com o banco legado durante o hardening.
- Não promover para `main` antes da certificação real do release.
- Reaproveitar `utilidades` e `frontEnds` por contratos/adapters, sem copiar upstreams completos para o produto.
- Manter Electron endurecido com `contextIsolation`, `sandbox` e IPC fechado.
- `__artisys_records` continua sendo a única fonte operacional de verdade no P0.
- `migrations/001-initial.sql` permanece por compatibilidade; o P0 não cria escrita dupla nas tabelas `cattle_*`.

## Review Focus

1. Duas escritas concorrentes com a mesma tag de animal devem resultar em apenas uma criação válida e uma rejeição clara.
2. Uma venda que falha depois de criar a negociação não pode deixar trade, animal vendido ou lançamento financeiro parcial.
3. Um usuário sem `settings:restore` não pode restaurar backup mesmo autenticado.
4. Auditoria nunca pode persistir senha, token de sessão ou hash de token em `metadata`.
5. Reabrir o SQLite depois de uma transação falha deve manter os dados anteriores íntegros e sem resíduos parciais.

---

### Task 1: Transação e integridade na persistência local

**Files:**
- Modify: `shared/packages/vertical-persistence/src/index.js`
- Create: `tests/persistence-transaction.test.js`
- Modify: `docs/DATA_COMPATIBILITY.md`

**Interfaces:**
- Produces: `persistence.transaction(async tx => result)`.
- `tx` expõe as mesmas operações de registro (`putRecord`, `getRecord`, `listRecords`, `softDeleteRecord`, `recordHistory`) do adapter principal.
- Uma exceção dentro do callback faz `ROLLBACK`; sucesso faz `COMMIT`.

- [ ] **Step 1: Write the failing transaction tests**

Criar `tests/persistence-transaction.test.js` cobrindo commit, rollback e reabertura:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';

test('transaction commits all writes together', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pecuaria-tx-'));
  const dbPath = join(dir, 'db.sqlite');
  const db = await openProductPersistence({dbPath, productId: 'agro-pecuaria'});
  await db.transaction(async tx => {
    await tx.putRecord('a', '1', {ok: 1}, {expectedVersion: 0});
    await tx.putRecord('b', '1', {ok: 2}, {expectedVersion: 0});
  });
  assert.equal((await db.getRecord('a', '1')).payload.ok, 1);
  assert.equal((await db.getRecord('b', '1')).payload.ok, 2);
  await db.close();
  await rm(dir, {recursive: true, force: true});
});

test('transaction rolls every write back on failure and survives reopen', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pecuaria-tx-'));
  const dbPath = join(dir, 'db.sqlite');
  let db = await openProductPersistence({dbPath, productId: 'agro-pecuaria'});
  await assert.rejects(() => db.transaction(async tx => {
    await tx.putRecord('a', '1', {ok: 1}, {expectedVersion: 0});
    throw new Error('forced');
  }), /forced/);
  assert.equal(await db.getRecord('a', '1'), null);
  await db.close();
  db = await openProductPersistence({dbPath, productId: 'agro-pecuaria'});
  assert.equal(await db.getRecord('a', '1'), null);
  await db.close();
  await rm(dir, {recursive: true, force: true});
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/persistence-transaction.test.js
```

Expected: FAIL porque `transaction` ainda não existe.

- [ ] **Step 3: Add the transaction primitive without duplicating storage**

Em `openProductPersistence`, separar as operações que usam `db` em um objeto interno reutilizável e expor:

```js
async transaction(work) {
  if (typeof work !== 'function') throw new TypeError('Transaction work must be a function.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await work(api);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
```

Bloquear transação aninhada de forma explícita com erro `Nested transactions are not supported.` para evitar comportamento indefinido.

- [ ] **Step 4: Document the source of truth**

Atualizar `docs/DATA_COMPATIBILITY.md` com:

```md
## Operational source of truth

During P0 hardening, live product records are stored exclusively in `__artisys_records`.
Legacy `cattle_*` tables are migration-compatibility structures and are not dual-written.
Domain constraints for generic collections are enforced in repositories/use-cases and pinned by tests.
```

- [ ] **Step 5: Run tests**

```bash
node --test tests/persistence-transaction.test.js tests/sqlite-snapshot.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/packages/vertical-persistence/src/index.js tests/persistence-transaction.test.js docs/DATA_COMPATIBILITY.md
git commit -m "feat: add atomic persistence transactions"
```

---

### Task 2: Invariantes de domínio e referências pecuárias

**Files:**
- Modify: `src/catalog.js`
- Modify: `src/presentation.js`
- Create: `src/invariants.js`
- Create: `tests/cattle-invariants.test.js`

**Interfaces:**
- Produces: `createCattleInvariantService({persistence, repos})`.
- Produces methods: `assertUniqueAnimalTag({tag, excludeId})`, `assertLotExists(lotId)`, `assertAnimalExists(animalId)`, `assertProtocolExists(protocolId)`.
- `createCattleRepositories(persistence)` keeps the current repository names, but `animals.save` rejects duplicate tags and missing lot references.

- [ ] **Step 1: Write failing invariant tests**

Cobrir no mínimo:

```js
test('animals reject duplicate tags', async () => {
  const {persistence, repos, cleanup} = await fixture();
  await repos.animals.save({id:'a1',tag:'BR-001',farmUnitId:'f1',lotId:null,status:'active',weights:[],milkRecords:[],metadata:{}}, {expectedVersion:0});
  await assert.rejects(
    () => repos.animals.save({id:'a2',tag:'BR-001',farmUnitId:'f1',lotId:null,status:'active',weights:[],milkRecords:[],metadata:{}}, {expectedVersion:0}),
    /Animal tag already exists/
  );
  await cleanup();
});

test('animal lot reference must exist', async () => {
  const {repos, cleanup} = await fixture();
  await assert.rejects(
    () => repos.animals.save({id:'a1',tag:'BR-002',farmUnitId:'f1',lotId:'missing',status:'active',weights:[],milkRecords:[],metadata:{}}, {expectedVersion:0}),
    /Lot not found/
  );
  await cleanup();
});
```

Adicionar um caso que atualiza o próprio animal mantendo a mesma tag e deve passar.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
node --test tests/cattle-invariants.test.js
```

Expected: FAIL porque os invariants ainda não existem.

- [ ] **Step 3: Implement `src/invariants.js`**

Estrutura mínima:

```js
export function createCattleInvariantService({persistence, repos}) {
  return Object.freeze({
    async assertUniqueAnimalTag({tag, excludeId = null}) {
      const normalized = String(tag ?? '').trim().toLowerCase();
      const duplicate = (await repos.animals.list()).find(
        row => row.id !== excludeId && String(row.payload.tag).trim().toLowerCase() === normalized
      );
      if (duplicate) throw new Error(`Animal tag already exists: ${tag}.`);
    },
    async assertLotExists(lotId) {
      if (lotId == null) return;
      if (!await repos.lots.get(lotId)) throw new Error(`Lot not found: ${lotId}.`);
    },
    async assertAnimalExists(animalId) {
      const row = await repos.animals.get(animalId);
      if (!row) throw new Error(`Animal not found: ${animalId}.`);
      return row;
    },
    async assertProtocolExists(protocolId) {
      const row = await repos.sanitaryProtocols.get(protocolId);
      if (!row) throw new Error(`Sanitary protocol not found: ${protocolId}.`);
      return row;
    }
  });
}
```

- [ ] **Step 4: Wrap only the cattle repositories that need cross-record validation**

Em `src/catalog.js`, manter `createEntityRepository` como base e envolver `animals.save` para chamar `assertUniqueAnimalTag` e `assertLotExists` antes da escrita. Não mudar collections nem ids.

- [ ] **Step 5: Validate cross-record actions in presentation**

Antes de `animals.move`, verificar lote destino; antes de `sanitary.record`, verificar animal e protocolo quando informado; antes de `reproduction.record`, verificar animal e `relatedAnimalId` quando existir.

- [ ] **Step 6: Run focused and domain tests**

```bash
node --test tests/cattle-invariants.test.js tests/domain.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/catalog.js src/invariants.js src/presentation.js tests/cattle-invariants.test.js
git commit -m "feat: enforce cattle domain invariants"
```

---

### Task 3: RBAC explícito e auditoria local real

**Files:**
- Modify: `src/security.js`
- Modify: `shared/packages/product-security/src/index.js`
- Create: `src/audit.js`
- Modify: `src/presentation.js`
- Create: `tests/security-audit.test.js`

**Interfaces:**
- Produces: `createAuditService(persistence, {productId:'agro-pecuaria'})` com `append(event)` e `list({limit, action, entity})`.
- `security.listAudit(args)` autoriza `audit:read` e retorna registros.
- Presentation actions recebem auditoria por wrapper local sem alterar os ids do contrato de QA.

- [ ] **Step 1: Write failing RBAC tests**

Testar explicitamente:

```js
assert.equal(PRESENTATION_ACCESS.screens.settings.actions.backup, 'settings:backup');
assert.equal(PRESENTATION_ACCESS.screens.settings.actions.restore, 'settings:restore');
assert.ok(SECURITY_POLICY.manager.includes('settings:backup'));
assert.ok(!SECURITY_POLICY.manager.includes('settings:restore'));
```

Criar sessão de `viewer` e confirmar `FORBIDDEN` para `settings:backup`; criar `manager` e confirmar backup permitido mas restore negado; admin permitido.

- [ ] **Step 2: Write failing audit tests**

Testar que autenticação, revogação e uma mutação pecuária geram eventos. Também inserir metadata com campos `password`, `token`, `tokenHash` e confirmar que `append()` remove esses campos recursivamente antes de persistir.

- [ ] **Step 3: Run and verify failures**

```bash
node --test tests/security-audit.test.js
```

Expected: FAIL por permissões ausentes e `listAudit()` vazio.

- [ ] **Step 4: Harden `src/security.js`**

Definir:

```js
export const SECURITY_POLICY = Object.freeze({
  admin: ['*'],
  manager: ['cattle:read','cattle:write','finance:read','reports:read','audit:read','session:revoke','settings:read','settings:backup'],
  'field-operator': ['cattle:read','cattle:write','reports:read','session:revoke'],
  finance: ['cattle:read','finance:read','reports:read','session:revoke'],
  viewer: ['cattle:read','reports:read','session:revoke']
});

export const PRESENTATION_ACCESS = Object.freeze({
  defaultRead:'cattle:read',
  defaultWrite:'cattle:write',
  screens:Object.freeze({
    finance:{read:'finance:read'},
    reports:{read:'reports:read',write:'reports:read'},
    settings:{
      read:'settings:read',
      write:'settings:write',
      actions:{backup:'settings:backup',restore:'settings:restore'}
    }
  })
});
```

Admin continua coberto por `*`; restore permanece exclusivo de admin porque nenhum outro papel recebe `settings:restore`.

- [ ] **Step 5: Implement local audit adapter**

`src/audit.js` usa a collection `audit:agro-pecuaria` e gera ids com `crypto.randomUUID()`. Event shape:

```js
{
  id,
  actorId,
  action,
  entity,
  entityId,
  occurredAt,
  metadata
}
```

Adicionar sanitização recursiva para chaves `password`, `token`, `tokenHash`, `passwordHash`, `passwordSalt`.

- [ ] **Step 6: Integrate audit into product security**

Em `createProductSecurity`, aceitar `audit` opcional. Após bootstrap/authenticate/revoke, chamar `audit.append(...)`. Trocar `listAudit(){return[]}` por método autorizado que exige sessão/token e `audit:read`.

- [ ] **Step 7: Audit presentation mutations**

Em `src/presentation.js`, criar helper:

```js
const audited = (action, entity, fn) => async input => {
  const result = await fn(input);
  await audit.append({actorId: input?.actorId ?? 'system', action, entity, entityId: result?.id ?? input?.id ?? null, metadata:{}});
  return result;
};
```

Não persistir credenciais no evento. Para ações chamadas via sessão, usar o usuário autorizado fornecido pelo host/presentation em vez de confiar em `input.actorId` quando esse contexto estiver disponível.

- [ ] **Step 8: Run tests**

```bash
node --test tests/security-audit.test.js tests/host.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/security.js src/audit.js src/presentation.js shared/packages/product-security/src/index.js tests/security-audit.test.js
git commit -m "feat: enforce settings RBAC and durable audit"
```

---

### Task 4: Use-case transacional de venda

**Files:**
- Create: `src/use-cases/sell-animals.js`
- Modify: `src/presentation.js`
- Create: `tests/sell-animals.test.js`

**Interfaces:**
- Produces: `createSellAnimalsUseCase({persistence,repos,finance,audit})`.
- Produces callable `sellAnimals(input)` returning `{trade, animals, financeEntry}`.
- `trades.create` continua existindo para compatibilidade, mas uma venda com `type:'sale'` e `animalIds.length>0` delega ao use-case atômico; compras continuam no caminho simples atual.

- [ ] **Step 1: Write the successful-sale test**

Preparar lote + dois animais ativos, executar venda e afirmar:

```js
assert.equal(result.trade.payload.type, 'sale');
assert.equal((await repos.animals.get('a1')).payload.status, 'sold');
assert.equal((await repos.animals.get('a2')).payload.status, 'sold');
assert.equal((await finance.list()).length, 1);
```

- [ ] **Step 2: Write the rollback test**

Injetar falha de auditoria depois das escritas de trade/animais/financeiro e afirmar que, depois da exceção:

```js
assert.equal(await repos.trades.get('sale-1'), null);
assert.equal((await repos.animals.get('a1')).payload.status, 'active');
assert.equal((await finance.list()).length, 0);
```

Fechar e reabrir o banco e repetir as asserções.

- [ ] **Step 3: Run and verify failure**

```bash
node --test tests/sell-animals.test.js
```

Expected: FAIL porque o use-case ainda não existe.

- [ ] **Step 4: Implement the use-case**

Estrutura:

```js
export function createSellAnimalsUseCase({persistence, repos, finance, audit}) {
  return async function sellAnimals(input) {
    const trade = createCattleTrade(input);
    if (trade.type !== 'sale' || trade.animalIds.length === 0) throw new Error('Sale requires animals.');

    return persistence.transaction(async tx => {
      const txRepos = createCattleRepositories(tx);
      const txFinance = createEntityRepository(tx, {collection:'cattle.finance'});
      const animals = [];
      for (const animalId of trade.animalIds) {
        const current = await txRepos.animals.get(animalId);
        if (!current) throw new Error(`Animal not found: ${animalId}.`);
        if (current.payload.status !== 'active') throw new Error(`Animal is not active: ${animalId}.`);
        animals.push(current);
      }
      const savedTrade = await txRepos.trades.save(trade, {expectedVersion:0});
      const sold = [];
      for (const current of animals) {
        sold.push(await txRepos.animals.save(
          recordAnimalLifecycle(current.payload, {type:'sale', occurredAt:trade.occurredAt, metadata:{tradeId:trade.id}}),
          {expectedVersion:current.version}
        ));
      }
      const financeEntry = await txFinance.save(createCattleTradeEntry(trade, {id:`finance-${trade.id}`}), {expectedVersion:0});
      await audit.append({actorId:input.actorId ?? 'system', action:'cattle.trade.sale', entity:'trade', entityId:trade.id, metadata:{animalIds:trade.animalIds}}, {persistence:tx});
      return {trade:savedTrade, animals:sold, financeEntry};
    });
  };
}
```

O audit adapter deve aceitar persistence transacional quando chamado pelo use-case para não escapar do rollback.

- [ ] **Step 5: Wire the presentation action**

`trades.actions.create`:

```js
create: input => input?.type === 'sale' && input?.animalIds?.length
  ? sellAnimals(input)
  : repos.trades.save(createCattleTrade(input), {expectedVersion:0})
```

- [ ] **Step 6: Run focused tests**

```bash
node --test tests/sell-animals.test.js tests/domain.test.js tests/cattle-invariants.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/use-cases/sell-animals.js src/presentation.js tests/sell-animals.test.js
git commit -m "feat: make cattle sales atomic"
```

---

### Task 5: QA executável das 16 ações contratadas

**Files:**
- Create: `tests/product-actions.test.js`
- Modify: `tooling/qa-phase5.mjs`
- Modify: `PRODUCT_STATUS.md`

**Interfaces:**
- `qa/product-contract.json` continua sendo a fonte do inventário de telas/ações.
- Novo teste deve falhar se uma ação declarada no contrato não tiver cenário executado.
- Produces evidence object with `screensCovered`, `actionsCovered`, `negativeCasesCovered`.

- [ ] **Step 1: Build a scenario registry that names every contracted action**

Em `tests/product-actions.test.js` carregar `qa/product-contract.json` e definir cenário por chave `screen.action`:

```js
const scenarios = {
  'lots.save': async ctx => {},
  'lots.remove': async ctx => {},
  'animals.save': async ctx => {},
  'animals.move': async ctx => {},
  'animals.lifecycle': async ctx => {},
  'weights.record': async ctx => {},
  'sanitary.saveProtocol': async ctx => {},
  'sanitary.record': async ctx => {},
  'reproduction.record': async ctx => {},
  'trades.create': async ctx => {},
  'finance.addCost': async ctx => {},
  'finance.fromTrade': async ctx => {},
  'reports.csv': async ctx => {},
  'reports.issue': async ctx => {},
  'settings.backup': async ctx => {},
  'settings.restore': async ctx => {}
};
```

Cada cenário deve realmente chamar a action da apresentação/host com dados válidos; não basta verificar que a função existe.

- [ ] **Step 2: Add contract completeness assertion**

```js
const expected = Object.entries(contract.actions).flatMap(([screen, actions]) => actions.map(action => `${screen}.${action}`)).sort();
assert.deepEqual(Object.keys(scenarios).sort(), expected);
assert.equal(expected.length, 16);
```

- [ ] **Step 3: Add negative cases**

No mesmo arquivo cobrir pelo menos:

- tag duplicada;
- lote inexistente em movimentação;
- peso não positivo;
- data de peso regressiva;
- protocolo/animal inexistente em sanidade;
- animal já vendido;
- version conflict;
- restore sem permissão.

- [ ] **Step 4: Run and verify any missing/incorrect action fails**

```bash
node --test tests/product-actions.test.js
```

Expected before final wiring: FAIL em qualquer action ainda não operacional no harness de teste.

- [ ] **Step 5: Extend `tooling/qa-phase5.mjs` evidence**

Além de surface/screenshots, registrar explicitamente:

```js
{
  screensCovered: 10,
  actionsCovered: 16,
  negativeCasesCovered: true
}
```

O script deve marcar fase como falha se `actionsCovered !== 16`.

- [ ] **Step 6: Update product status**

Em `PRODUCT_STATUS.md`, substituir qualquer linguagem que implique “100% funcional” apenas por navegação de telas por uma distinção explícita:

```md
- UI surface coverage: 10/10 screens
- Functional action coverage: 16/16 contracted actions
- Negative-domain coverage: required P0 cases passing
```

- [ ] **Step 7: Run full non-Playwright validation**

```bash
npm run check:imports
npm test
npm run build:web
npm run qa:surface
```

Expected: PASS.

- [ ] **Step 8: Run Phase 5 including Playwright on the Windows runner/local environment**

```powershell
npm run phase5
```

Expected: PASS with evidence tied to the same commit.

- [ ] **Step 9: Commit**

```bash
git add tests/product-actions.test.js tooling/qa-phase5.mjs PRODUCT_STATUS.md
git commit -m "test: cover all pecuaria contracted actions"
```

---

## Final P0 Verification

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] `npm run phase5` on Windows/Woodpecker runtime
- [ ] Confirm transaction rollback after DB reopen
- [ ] Confirm duplicate tag and invalid references are rejected
- [ ] Confirm manager backup / manager restore denied / admin restore allowed
- [ ] Confirm audit records exist and contain no credentials
- [ ] Confirm sale creates trade + lifecycle + finance atomically
- [ ] Confirm exact action coverage is `16/16`
- [ ] Do not merge/promote to `main` yet; P1/P2 and real release certification remain separate plans.
