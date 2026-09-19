# Pecuaria Git Auto Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o ArtiSys Pecuária detecte automaticamente novas versões publicadas no GitHub Releases e conduza download/instalação apenas com consentimento explícito do usuário.

**Architecture:** O app continuará local-first. `electron-updater` roda somente no main process e usa GitHub Releases/`latest.yml`; o preload expõe IPC mínimo para consultar, baixar e instalar. A renderer apenas apresenta estado e botões. O updater entra no P2 antes da certificação Windows, pois altera o pacote e o contrato de release.

**Tech Stack:** Electron 44, electron-builder 26.x, electron-updater compatível com builder 26, NSIS, React 19, Node >=22, GitHub Releases, GitHub Actions, Woodpecker manual.

**Spec:** `docs/superpowers/specs/2026-09-19-pecuaria-git-auto-update-design.md`

## Global Constraints

- Nenhuma atualização silenciosa.
- Nenhum download sem clique explícito em `Baixar atualização`.
- Nenhuma instalação sem clique explícito em `Instalar e reiniciar`.
- `allowDowngrade = false` e prerelease fora do canal estável por padrão.
- Erro de rede/update nunca bloqueia o uso offline do produto.
- Nunca embutir `GH_TOKEN` no cliente final.
- GitHub Releases é canal de binários/manifestos; não consumir código bruto da branch.
- Destino do provider deve ser explícito no build, nunca inferido de `.git/config`.
- Woodpecker permanece `manual`; não reintroduzir gatilho de `push`.
- 10 telas e 16 ações contratadas permanecem inalteradas.
- A certificação P2 continua fail-closed e amarrada ao mesmo commit.

## Review Focus

1. Uma checagem automática no startup não pode baixar nada por si só.
2. Um update já baixado não pode instalar automaticamente ao fechar o aplicativo.
3. Release draft, prerelease ou versão igual/inferior não pode ser tratada como atualização estável.
4. Payload do IPC não pode aceitar URL, caminho, token ou comando arbitrário da renderer.
5. Se o GitHub estiver indisponível, a tela principal e os dados locais continuam funcionando normalmente.

---

### Task 1: Contrato de versão e publicação GitHub

**Files:**
- Modify: `package.json`
- Create: `tooling/version-release-gate.mjs`
- Create: `tests/version-release-gate.test.js`
- Modify: `.github/workflows/p0-hardening.yml`
- Modify: `scripts/artisys-release.ps1`

**Interfaces:**
- Consumes: `package.json.version`, tag/ref opcional e metadata do release.
- Produces: verificação `assertReleaseVersion({packageVersion, tag, previousVersion})` e configuração explícita `build.publish` para GitHub.

- [ ] **Step 1: Write failing tests** cobrindo tag diferente de `v${packageVersion}`, SemVer inválido, versão igual/anterior à anterior estável e cenário válido.
- [ ] **Step 2: Run** `node --test tests/version-release-gate.test.js` e confirmar RED.
- [ ] **Step 3: Implement** validação SemVer sem aceitar downgrade ou prerelease no canal estável.
- [ ] **Step 4: Add explicit publish config** em `package.json` com `provider: github`, `owner: nutricionistaalmeidavh-spec` e `repo: pecuaria`; manter NSIS.
- [ ] **Step 5: Add runtime dependency** `electron-updater` em versão compatível com electron-builder 26.x; não atualizar builder como efeito colateral desta task.
- [ ] **Step 6: Wire gate** no caminho de release para falhar antes do build quando tag/versão forem inconsistentes.
- [ ] **Step 7: Run** teste alvo, `npm test` e `npm run build:web`.
- [ ] **Step 8: Commit** `feat: define GitHub release update channel`.

### Task 2: Updater isolado no Electron main process

**Files:**
- Create: `electron/updater.mjs`
- Modify: `electron/main.mjs`
- Create: `tests/updater-service.test.js`

**Interfaces:**
- Produces: `createUpdaterService({updater, currentVersion, isPackaged})`.
- Methods: `getState()`, `check()`, `download()`, `install()` e `subscribe(listener)`.
- State shape: `{status,currentVersion,availableVersion,progress,error,releaseNotes}`.

- [ ] **Step 1: Write failing tests** para startup check sem download, update disponível, download só após chamada explícita, install só após estado `downloaded`, downgrade ignorado e erro de rede convertido para estado `error` sem throw fatal.
- [ ] **Step 2: Run** `node --test tests/updater-service.test.js` e confirmar RED.
- [ ] **Step 3: Implement adapter** sobre `electron-updater` com `autoDownload = false`, `allowDowngrade = false`, prerelease desabilitada e instalação automática ao sair explicitamente desabilitada usando a API compatível com a versão adotada.
- [ ] **Step 4: Normalize updater events** `checking-for-update`, `update-available`, `update-not-available`, `download-progress`, `update-downloaded`, `error` sem expor stack, URL ou headers à renderer.
- [ ] **Step 5: Disable updater in dev** por padrão quando `app.isPackaged` for falso; testes usam updater fake injetado.
- [ ] **Step 6: Initialize after window ready** sem atrasar `createStandaloneHost` nem bloquear abertura da aplicação.
- [ ] **Step 7: Run** teste alvo + `npm test`.
- [ ] **Step 8: Commit** `feat: add explicit-consent desktop updater service`.

### Task 3: IPC fechado e preload seguro

**Files:**
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Create: `tests/updater-ipc.test.js`

**Interfaces:**
- Renderer receives only:
  - `artisys.updates.getState()`
  - `artisys.updates.check()`
  - `artisys.updates.download()`
  - `artisys.updates.install()`
  - `artisys.updates.onState(callback)`

- [ ] **Step 1: Write failing tests** provando ausência de `setFeedURL`, URL arbitrária, path arbitrário ou token no contrato exposto.
- [ ] **Step 2: Run** `node --test tests/updater-ipc.test.js` e confirmar RED.
- [ ] **Step 3: Register fixed IPC handlers** `artisys:updates:get-state`, `check`, `download`, `install`; nenhum payload de destino é aceito.
- [ ] **Step 4: Add event bridge** com unsubscribe seguro; renderer recebe cópia serializável do estado.
- [ ] **Step 5: Freeze exposed API** no preload como já ocorre com o restante do contrato Electron.
- [ ] **Step 6: Run** teste alvo + suíte completa.
- [ ] **Step 7: Commit** `feat: expose constrained updater IPC`.

### Task 4: UX não silenciosa

**Files:**
- Modify: `web/main.jsx`
- Modify: `web/components.jsx`
- Modify: `web/styles.css`
- Create: `tests/update-ui-contract.test.js`
- Modify: `tests/e2e/full-surface.spec.mjs`

**Interfaces:**
- Consumes: `window.artisys.updates` somente quando disponível em Electron.
- Produces: aviso global de nova versão e controle `Verificar atualizações` dentro da tela Configurações existente.

- [ ] **Step 1: Write failing contract tests** exigindo ações `Depois`, `Baixar atualização` e `Instalar e reiniciar`, e proibindo chamadas automáticas de `download()`/`install()` durante render/mount.
- [ ] **Step 2: Run** testes e confirmar RED.
- [ ] **Step 3: Add updater state hook** com fallback `unsupported` em browser/preview para não quebrar Playwright web.
- [ ] **Step 4: Show unobtrusive notification/dialog** somente quando `status === 'available'`; exibir versão atual/nova e release notes sanitizadas.
- [ ] **Step 5: Wire explicit buttons**: `Depois` fecha aviso; `Baixar atualização` chama `download()`; somente `downloaded` habilita `Instalar e reiniciar`.
- [ ] **Step 6: Add manual check** em Configurações sem criar nova tela/ação contratada.
- [ ] **Step 7: Add progress/error states** sem bloquear navegação ou dados locais.
- [ ] **Step 8: Run** `npm test`, `npm run build:web`, `npm run qa:web`, `npm run qa:surface`.
- [ ] **Step 9: Commit** `feat: add consent-driven update UI`.

### Task 5: Release artifacts e certificação do updater

**Files:**
- Create: `tooling/update-release-gate.mjs`
- Create: `tests/update-release-gate.test.js`
- Modify: `tooling/release-validator-gate.mjs` quando criado pelo P2 principal
- Modify: `tooling/certify-release.mjs`
- Modify: `scripts/artisys-release.ps1`
- Modify: `PRODUCT_STATUS.md`

**Interfaces:**
- Consumes: `.exe`, `latest.yml`, package version, commit SHA e evidências P2.
- Produces: `qa-artifacts/update-release-summary.json` com `{commit,version,status,installerSha256,manifestPresent,consentPolicy}`.

- [ ] **Step 1: Write failing tests** para `latest.yml` ausente, versão divergente, manifesto apontando artefato incorreto, commit stale e política de consentimento não comprovada.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement gate** que exige `.exe` e `latest.yml` do mesmo build e versão; manter SHA-256 da certificação existente.
- [ ] **Step 4: Extend P2 release validator** para exigir `update-release-summary.json` no mesmo commit.
- [ ] **Step 5: Extend Windows release flow** para gerar metadata do updater junto do NSIS; publicação no GitHub Release acontece somente após todos os gates passarem e nunca por simples push.
- [ ] **Step 6: Verify manual Woodpecker trigger** permanece `event: [manual]`.
- [ ] **Step 7: Run full candidate flow** em Windows; instalar uma versão N e publicar release de teste N+1 em canal controlado/release de homologação para provar detecção, download por clique e install por clique.
- [ ] **Step 8: Record evidence** e atualizar `PRODUCT_STATUS.md` somente depois de PASS real.
- [ ] **Step 9: Commit** `feat: certify GitHub auto update release flow`.

## Integration Order with Main P2 Plan

Executar este subplano **depois dos adapters Reporting/Dashboard e antes da certificação real Windows** do plano `2026-09-19-pecuaria-reporting-dashboard-p2.md`.

Ordem consolidada:

1. Reporting.
2. Dashboard.
3. Product QA/API Contracts/Security.
4. GitHub auto-update não silencioso (este plano).
5. Release Validator/P2 gate final.
6. Banco legado real + NSIS + `latest.yml`.
7. Certificação final e publicação manual da release.

## Final Verification

- [ ] Startup check não dispara download.
- [ ] Download só ocorre após `Baixar atualização`.
- [ ] Fechar o app após download não instala automaticamente.
- [ ] Install só ocorre após `Instalar e reiniciar`.
- [ ] GitHub indisponível não impede abrir/usar o sistema.
- [ ] `allowDowngrade` permanece false.
- [ ] Prerelease não aparece no canal estável.
- [ ] `package.json.version`, tag, `.exe` e `latest.yml` representam a mesma versão.
- [ ] Nenhum token GitHub está embutido no cliente.
- [ ] Woodpecker continua manual-only.
- [ ] Evidência do updater pertence ao mesmo commit do restante do P2.
