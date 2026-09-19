# ArtiSys Pecuária Fases 7 e 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar cutover não destrutivo de `artisys-pecuaria.sqlite` e certificação fail-closed do release standalone.

**Architecture:** F7 trabalha somente sobre cópia sandbox do banco legado e prova preservação de dados/hash do original. F8 exige evidências frescas de F5, F7 e Playwright no mesmo commit e um instalador Windows válido antes de emitir certificação.

**Tech Stack:** Node.js 22, `node:sqlite`, Electron, Vite, Playwright, electron-builder/NSIS.

**Spec:** `docs/superpowers/specs/2026-09-18-phases-7-8-design.md`

## Global Constraints

- `productId=agro-pecuaria`.
- banco `artisys-pecuaria.sqlite`.
- migration `agro-pecuaria/001-initial.sql`.
- original legado nunca recebe escrita.
- evidências devem pertencer ao commit atual.
- core obrigatório R$0/self-hosted/open source.
- monorepo permanece rollback/reference.

---

### Task 1: Helper de evidências e SHA do commit

**Files:** Create `tooling/evidence.mjs`; modify `tooling/qa-phase5.mjs`; test `tests/evidence.test.js`.

**Interfaces:** `currentCommit(): Promise<string>` e `writeEvidence(path,payload): Promise<object>`.

- [ ] Write `tests/evidence.test.js` asserting `currentCommit()` matches `/^[0-9a-f]{40}$/`.
- [ ] Run `node --test tests/evidence.test.js`; expect FAIL because module is missing.
- [ ] Implement `currentCommit` with `execFile('git',['rev-parse','HEAD'])` and atomic JSON evidence writing with temporary file + rename.
- [ ] Add `commit` to both success and failure Phase 5 summaries.
- [ ] Run `node --test tests/evidence.test.js && npm run phase5`; expect PASS and commit in summary.
- [ ] Commit with `git commit -m "test: bind qa evidence to current commit"`.

### Task 2: Deterministic SQLite snapshot

**Files:** Create `tooling/sqlite-snapshot.mjs`; test `tests/sqlite-snapshot.test.js`.

**Interfaces:** `snapshotSqlite(path)` and `assertLegacyTablesPreserved(before,after,ignoredTables)`.

- [ ] Create a temporary SQLite database with a `customer_data` table and two rows; write a failing test that snapshots it, adds an unrelated table, and expects the original table digest unchanged.
- [ ] Run `node --test tests/sqlite-snapshot.test.js`; expect RED.
- [ ] Implement snapshot using `DatabaseSync`, `sqlite_master`, `PRAGMA table_info`, deterministic value encoding including binary-to-hex, row counts and SHA-256 per table.
- [ ] Implement preservation assertion for every table existing before upgrade; internal migration metadata may be ignored only when explicitly listed.
- [ ] Run the snapshot test; expect PASS.
- [ ] Commit with `git commit -m "test: add deterministic legacy database snapshot"`.

### Task 3: Fase 7 cutover rehearsal

**Files:** Create `tooling/phase7-cutover.mjs`; test `tests/phase7-cutover.test.js`; modify `runtime/host.mjs` if needed to expose `schemaState`.

**Interfaces:** consumes `ARTISYS_LEGACY_DB`; produces `qa-artifacts/phase7-summary.json`.

- [ ] Write a failing test that runs without `ARTISYS_LEGACY_DB` and requires nonzero exit plus `ARTISYS_LEGACY_DB is required`.
- [ ] Write a failing test using a temporary compatible `artisys-pecuaria.sqlite`, hashing before and after and expecting unchanged original.
- [ ] Run `node --test tests/phase7-cutover.test.js`; expect RED.
- [ ] Implement: validate source → hash original → snapshot original → copy into temp directory → open `createStandaloneHost` on temp copy → require `agro-pecuaria/001-initial.sql` in `schemaState().migrations` → backup → write `qa.cutover/sentinel` → close/reopen → verify sentinel → restore backup → verify sentinel absent → compare legacy tables → hash original again → write evidence with current commit.
- [ ] If host persistence lacks `schemaState`, expose a direct proxy to the underlying persistence method without changing storage semantics.
- [ ] Run test GREEN and confirm original hash stays unchanged.
- [ ] Commit with `git commit -m "test: add non destructive pecuaria cutover rehearsal"`.

### Task 4: Playwright evidence wrapper

**Files:** Create `tooling/qa-web.mjs`; modify `package.json`; test `tests/qa-web-evidence.test.js`.

**Interfaces:** produces `qa-artifacts/playwright-summary.json` with commit and exit code.

- [ ] Write failing test for summary builder requiring `commit`, `status` and `exitCode`.
- [ ] Run RED.
- [ ] Implement wrapper that invokes `npm run qa:web:raw` through `process.execPath` + `process.env.npm_execpath`, inherits stdio and always persists evidence.
- [ ] Change scripts to `qa:web:raw="playwright test"` and `qa:web="node tooling/qa-web.mjs"`.
- [ ] Run unit test and `npm run qa:web`; expect summary with current commit.
- [ ] Commit with `git commit -m "test: persist playwright release evidence"`.

### Task 5: Fase 8 release certification

**Files:** Create `tooling/certify-release.mjs`; test `tests/certify-release.test.js`; modify `package.json`.

**Interfaces:** reads F5/F7/Playwright evidence and `release/ArtiSys-Pecuaria-Setup-*.exe`; writes `qa-artifacts/release-certification.json`.

- [ ] Write stale-evidence test: F5 commit differs from HEAD and certification must fail.
- [ ] Write missing-installer test: all evidence passes but no EXE exists and certification must fail.
- [ ] Run tests RED.
- [ ] Implement certifier: all statuses must equal `passed`; all evidence commits must equal HEAD; installer must match `ArtiSys-Pecuaria-Setup-*.exe`, be newer than certification run and exceed 1 MiB; record SHA-256 and file size.
- [ ] Add scripts: `phase7=node tooling/phase7-cutover.mjs`, `phase8:certify=node tooling/certify-release.mjs`, `release:certify=npm run phase5 && npm run phase7 && npm run qa:web && npm run check && npm run build:win && npm run phase8:certify`.
- [ ] Run `node --test tests/certify-release.test.js`; expect PASS.
- [ ] Commit with `git commit -m "feat: add fail closed pecuaria release certification"`.

### Task 6: Release docs and fresh verification

**Files:** Create `docs/PHASES_7_8.md`; modify `PRODUCT_STATUS.md`, `.woodpecker/verify.yml`.

- [ ] Keep CI non-destructive: install dependencies, `npm run check`, `npm run phase5`, `npm run qa:web`; do not run F7 without real legacy DB.
- [ ] Document Windows command: `$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run release:certify`.
- [ ] Run fresh sequence: `npm install --no-audit --no-fund`; `npx playwright install chromium`; `npm run check`; `npm run phase5`; set `ARTISYS_LEGACY_DB`; `npm run phase7`; `npm run qa:web`; `npm run build:win`; `npm run phase8:certify`.
- [ ] Require every command exit 0 and `release-certification.json.status=passed` before marking product homologado.
- [ ] Verify monorepo legacy code still exists and was not modified by this plan.
- [ ] Commit docs with `git commit -m "docs: record pecuaria certification gate"`.
