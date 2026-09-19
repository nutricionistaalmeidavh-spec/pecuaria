# ArtiSys Pecuária P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o hardening P0 em uma experiência operacional utilizável no dia a dia, com formulários reais, backup verificável e serviços locais reutilizáveis de consulta/alerta/importação/exportação.

**Architecture:** O backend/RPC e as regras de domínio endurecidas no P0 permanecem como única fonte de comportamento. A UI React ganha configuração de formulários por ação e componentes próprios inspirados nos padrões `desktop-admin`, `tables-kit`, `dialogs-kit`, `navigation-kit` e `feedback-kit` do repositório `frontEnds`; regras de negócio não entram no React. Backup e serviços P1 são adapters locais sobre a persistência atual e não introduzem SaaS obrigatório.

**Tech Stack:** React 19, Vite 7, Electron 44, Node >=22, `node:sqlite`, Web Crypto/Node crypto, Node test runner, Playwright existente.

**Spec:** `docs/superpowers/specs/2026-09-19-pecuaria-hardening-design.md`

## Global Constraints

- Core R$ 0, self-hosted/local e open source.
- Nenhum SaaS pago como dependência silenciosa.
- Não quebrar compatibilidade com o banco legado durante o hardening.
- Não promover para `main` antes da certificação real do release.
- Reaproveitar `utilidades` e `frontEnds` por contratos/adapters, sem copiar upstreams completos para o produto.
- Manter Electron endurecido com `contextIsolation`, `sandbox` e IPC fechado.
- O backend/RPC continua autoritativo; validação crítica não depende do frontend.

## Review Focus

1. Formulários não podem depender de edição de JSON pelo usuário normal.
2. Valores numéricos e listas devem chegar ao backend com tipos corretos, não como strings arbitrárias.
3. Backup corrompido deve ser rejeitado antes de substituir o banco ativo.
4. Retention nunca pode apagar o backup que acabou de ser criado nem um backup explicitamente protegido.
5. Serviços de busca/importação/exportação devem respeitar collections do produto e não criar uma segunda fonte de verdade.

---

### Task 1: Frontend operacional e action forms tipados

**Files:**
- Create: `web/action-config.js`
- Create: `web/components.jsx`
- Modify: `web/main.jsx`
- Modify: `web/styles.css`
- Create: `tests/web-action-config.test.js`
- Modify: `e2e/full-surface.spec.mjs`

**Interfaces:**
- Produces `ACTION_FORMS[screenId][action]` com `title`, `fields`, `defaults` e `normalize(values)`.
- Produces `ActionDialog`, `DataTable`, `StatusBanner`, `DesktopShell` em `web/components.jsx`.
- Não altera os ids RPC das 10 telas ou 16 ações.

- [ ] Write `tests/web-action-config.test.js` asserting that every contracted action has a form definition except actions that can run without fields, that no normal form exposes a JSON textarea, and normalizers convert numeric/list inputs.
- [ ] Run `node --test tests/web-action-config.test.js` and verify RED.
- [ ] Add `web/action-config.js` covering all 16 actions. Use explicit fields such as `id`, `name`, `farmUnitId`, `tag`, `lotId`, `weightKg`, `animalIds`, `totalAmountMinor`, dates and backup id. Convert number fields with `Number()` and comma/newline list fields into arrays.
- [ ] Add small React components inspired by `frontEnds`: responsive shell, navigation, table, modal/dialog, feedback banner and empty state. Keep plain CSS rather than introducing Tailwind.
- [ ] Replace `web/main.jsx` generic JSON workflow with the configured dialog forms. Keep login/bootstrap, navigation and backend RPC unchanged. Internal developer JSON may only exist behind an explicit development-only flag; it must not render in normal builds.
- [ ] Update `web/styles.css` with desktop-admin layout, responsive navigation, cards, tables, dialog, inputs, errors/success and mobile handling.
- [ ] Update `e2e/full-surface.spec.mjs` to assert that every action button opens an accessible dialog/form and that `textarea[data-testid="action-json"]` does not exist.
- [ ] Run `npm test && npm run build:web` and Windows Playwright when available.
- [ ] Commit `feat: replace raw JSON UI with operational forms`.

---

### Task 2: Backup verificável e retention local

**Files:**
- Create: `src/backup.js`
- Modify: `runtime/host.mjs`
- Create: `tests/backup-integrity.test.js`

**Interfaces:**
- Produces `createBackupManager({dbPath,backupDir,closeDatabase,reopenDatabase,retention})`.
- `createBackup()` returns `{id,createdAt,path,size,sha256,verified}`.
- `listBackups()` returns metadata and integrity state.
- `restoreBackup(id)` validates hash and SQLite openability before replacing the live DB and always creates a safety backup first.

- [ ] Write failing tests for SHA-256 metadata, corrupt backup rejection, safety backup and retention.
- [ ] Implement hashing and metadata sidecar `<id>.json` next to `<id>.sqlite`.
- [ ] On create, close/checkpoint database through host lifecycle, copy DB, hash it, reopen a temporary SQLite handle to prove it is readable, write metadata, then reopen live persistence.
- [ ] On restore, compare current file hash with sidecar, open backup read-only/sandbox to verify schema/product marker, create safety backup, replace live DB, reopen persistence.
- [ ] Implement configurable retention count default 20, never deleting `safety-*` automatically.
- [ ] Keep the public `recovery.createBackup/listBackups/restoreBackup` interface compatible so RPC does not change.
- [ ] Run `node --test tests/backup-integrity.test.js tests/host.test.js`.
- [ ] Commit `feat: verify backups with sha256 and retention`.

---

### Task 3: Serviços reutilizáveis locais do RepoUteis

**Files:**
- Create: `src/services/search.js`
- Create: `src/services/alerts.js`
- Create: `src/services/transfer.js`
- Modify: `src/presentation.js`
- Create: `tests/product-services.test.js`

**Interfaces:**
- `search.query({term,collections,limit})` retorna resultados locais com `collection,id,label,payload`.
- `alerts.list()` deriva alertas operacionais de dados existentes; nenhuma daemonização é necessária.
- `transfer.exportCollection(collection)` retorna JSON versionado.
- `transfer.importCollection(document,{mode:'validate'|'append'})` valida antes de gravar e nunca substitui registros existentes silenciosamente.

- [ ] Write failing tests for local search, sanitary due alert derivation, JSON export and validate/append import with duplicate-id rejection.
- [ ] Implement search as a read-only scan over collections relevantes do produto, with normalized text matching and limit.
- [ ] Implement alerts as pure derivation from current records: overdue/upcoming sanitary events, animals without recent weight when data permits, and backup age when recovery metadata is supplied.
- [ ] Implement versioned transfer document `{format:'artisys-pecuaria-export',version:1,collection,records}` with strict product/collection validation.
- [ ] Expose services via `presentation.services` for future UI consumption; do not add new contracted screens/actions in P1.
- [ ] Run `node --test tests/product-services.test.js` plus full suite.
- [ ] Commit `feat: add local search alerts and data transfer services`.

---

## P1 Verification

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:surface`
- [ ] Confirm normal UI contains no raw JSON action textarea.
- [ ] Confirm 10 screens and 16 action IDs are unchanged.
- [ ] Confirm corrupt backup cannot replace live DB.
- [ ] Confirm no mandatory network/SaaS dependency was added.
- [ ] Keep `main` untouched until P2/final certification.
