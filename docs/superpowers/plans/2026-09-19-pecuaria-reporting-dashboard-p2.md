# Pecuaria Reporting, Dashboard and P2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a lacuna P1 de reporting/dashboard com adapters locais e, em seguida, homologar os gates P2 de Product QA, Security, API Contracts e Release Validator sem criar dependência SaaS obrigatória nem alterar o contrato de 10 telas/16 ações.

**Architecture:** O produto continua local-first e mantém `__artisys_records` como fonte operacional de verdade. Reporting e dashboard serão adapters de produto sobre os contratos já existentes no RepoUteis: o produto define KPIs/relatórios pecuários e usa primitivas compartilhadas sem copiar upstream inteiro. O P2 será composto por gates fail-closed que produzem evidências por commit e só permitem certificação quando QA, security, contratos, banco legado e instalador pertencem ao mesmo commit.

**Tech Stack:** Node >=22, React 19, Vite 7, Electron 44, node:sqlite, Node test runner, Playwright, PowerShell/Windows, GitHub Actions e Woodpecker manual.

**Spec:** `docs/superpowers/specs/2026-09-19-pecuaria-hardening-design.md`

## Global Constraints

- Core R$ 0, self-hosted/local e open source.
- Nenhum SaaS pago como dependência silenciosa.
- Não criar segunda fonte de verdade nem dual-write.
- Não alterar os ids das 10 telas e 16 ações contratadas.
- Backend/RPC continua autoritativo; UI não recebe regras críticas de negócio.
- Reaproveitar RepoUteis por contratos/adapters, sem copiar upstreams completos.
- Woodpecker permanece `manual`; não reintroduzir gatilho automático em `push`.
- Release real deve ser fail-closed e amarrada ao mesmo commit.

## Review Focus

1. KPIs e relatórios devem derivar somente de dados persistidos atuais e não manter cache autoritativo paralelo.
2. CSV deve preservar escaping de vírgula, aspas e quebra de linha sem expor campos sensíveis.
3. Product QA deve bloquear runner ausente e achado HIGH/CRITICAL, nunca converter falha em aviso.
4. Evidência de outro commit deve invalidar certificação mesmo quando o conteúdo parece válido.
5. Security/release tooling pode depender de Docker/Windows no CI, mas nunca pode virar dependência de runtime do produto.

---

### Task 1: Adapter de reporting pecuário

**Files:**
- Create: `src/services/reporting.js`
- Modify: `src/presentation.js`
- Test: `tests/reporting-dashboard.test.js`

**Interfaces:**
- Consumes: persistence atual, repositories pecuários e primitives equivalentes a `filterRows`, `groupBy`, `aggregate`, `toCsv` do `artisys-reporting`.
- Produces: `reporting.build(type, options)` e `reporting.csv(type, options)` expostos em `presentation.services.reporting`.

- [ ] **Step 1: Write failing tests** cobrindo `animal-history`, `lot-kpis` e `sanitary`, CSV com escaping e rejeição de tipo desconhecido.
- [ ] **Step 2: Run** `node --test tests/reporting-dashboard.test.js` e confirmar RED por módulo ausente.
- [ ] **Step 3: Implement** helpers locais compatíveis com o contrato RepoUteis, sem dependência npm nova e sem persistir resultados de relatório.
- [ ] **Step 4: Implement report definitions**: histórico por animal, KPIs por lote (quantidade, peso médio quando disponível, custo/receita agregados) e agenda sanitária.
- [ ] **Step 5: Expose service** em `presentation.services.reporting` sem adicionar nova ação RPC contratada.
- [ ] **Step 6: Run** teste alvo + `npm test` e confirmar GREEN.
- [ ] **Step 7: Commit** `feat: add local cattle reporting adapter`.

### Task 2: Adapter de dashboard pecuário

**Files:**
- Create: `src/services/dashboard.js`
- Modify: `src/presentation.js`
- Modify: `web/main.jsx`
- Test: `tests/reporting-dashboard.test.js`

**Interfaces:**
- Consumes: repositories, `reporting` e `alerts` existentes.
- Produces: `dashboard.snapshot()` com `{kpis, alerts, layout}`; layout é validado com regras compatíveis com `artisys-dashboard` e não é fonte de dados.

- [ ] **Step 1: Extend failing tests** para snapshot com total de animais ativos, lotes, peso médio conhecido, receita/custo, alertas e ids de widgets únicos.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement** layout estático validado e KPIs derivados em tempo de leitura; não gravar cache de KPI.
- [ ] **Step 4: Expose** `presentation.services.dashboard`.
- [ ] **Step 5: Update Overview UI** para consumir snapshot quando disponível, mantendo fallback atual e sem criar 11ª tela.
- [ ] **Step 6: Run** `npm test`, `npm run build:web`, `npm run qa:web` e `npm run qa:surface`.
- [ ] **Step 7: Commit** `feat: add cattle dashboard snapshot adapter`.

### Task 3: Product QA gate P2

**Files:**
- Create: `tooling/product-qa-gate.mjs`
- Create: `tests/product-qa-gate.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/p0-hardening.yml`

**Interfaces:**
- Consumes: resultados dos gates locais `qa`, `security`, `api-contracts`.
- Produces: `qa-artifacts/product-qa-summary.json` com `commit`, `status`, `results`, `blockedFindings`.

- [ ] **Step 1: Write failing tests** para runner ausente, check reprovado, HIGH/CRITICAL bloqueante, commit inválido e cenário PASS.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement** comportamento compatível com `artisys-product-qa`: checks default `qa/security/api-contracts`, status final `pass|blocked`, fail-closed.
- [ ] **Step 4: Add scripts** `qa:product` e `qa:p2` sem alterar runtime.
- [ ] **Step 5: Integrate CI** após unit/build/E2E, preservando artifact upload.
- [ ] **Step 6: Run** suíte completa e confirmar GREEN.
- [ ] **Step 7: Commit** `feat: add fail-closed product QA gate`.

### Task 4: API contract baseline gate

**Files:**
- Create: `qa/api-contract.json`
- Create: `qa/api-contract.baseline.json`
- Create: `tooling/api-contract-gate.mjs`
- Create: `tests/api-contract-gate.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `qa/product-contract.json`, presentation navigation/action metadata e canonical JSON digest.
- Produces: verificação determinística de drift sem atualizar baseline automaticamente.

- [ ] **Step 1: Write failing tests** para order-insensitive object digest, mudança real de ação/tela, baseline inválida e contrato estável.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement** canonicalização/digest SHA-256 compatíveis com `artisys-api-contracts` e geração explícita separada do check.
- [ ] **Step 4: Pin baseline** das 10 telas/16 ações atuais em arquivo versionado.
- [ ] **Step 5: Add** `qa:contracts` ao `qa:p2` antes de Product QA.
- [ ] **Step 6: Run** testes + `npm run qa:contracts`.
- [ ] **Step 7: Commit** `feat: pin product API contract baseline`.

### Task 5: Security gate adapter

**Files:**
- Create: `tooling/security-gate.mjs`
- Create: `tests/security-gate.test.js`
- Modify: `.github/workflows/p0-hardening.yml`
- Modify: `scripts/artisys-release.ps1`
- Modify: `package.json`

**Interfaces:**
- Consumes: saída resumida do scanner externo; nunca publica relatório bruto.
- Produces: `qa-artifacts/security-summary.json` com apenas contagens/status e `commit`.

- [ ] **Step 1: Write failing tests** para ferramenta ausente, JSON inválido, secret, HIGH/CRITICAL/UNKNOWN, MEDIUM em release, Semgrep ERROR/WARNING e PASS.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement** política fail-closed equivalente ao `artisys-security 0.2.0`, separando modo `commit` de `release`.
- [ ] **Step 4: Wire GitHub CI** para baseline segura que não publica findings sensíveis; se scanner externo não estiver disponível, o gate deve ficar explicitamente `blocked`, não `pass` sintético.
- [ ] **Step 5: Wire Woodpecker release** para chamar o security gate em modo `release` antes do build/certify, mantendo trigger somente manual.
- [ ] **Step 6: Run** testes locais/CI compatíveis e confirmar comportamento fail-closed.
- [ ] **Step 7: Commit** `feat: add P2 security release gate`.

### Task 6: Release Validator adapter e evidência por commit

**Files:**
- Create: `tooling/release-validator-gate.mjs`
- Create: `tests/release-validator-gate.test.js`
- Modify: `tooling/certify-release.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: installer real, phase5, phase7, playwright, product-qa, security e api-contract evidence.
- Produces: `qa-artifacts/release-validation.json` e certificação final somente quando todos os SHAs coincidem.

- [ ] **Step 1: Write failing tests** para artifact ausente, hash alterado, evidência stale, required phase fail e cenário PASS.
- [ ] **Step 2: Run** teste alvo e confirmar RED.
- [ ] **Step 3: Implement** perfil e runner locais compatíveis com `artisys-release-validator`, incluindo SHA-256 do instalador e lista de `failedRequired`.
- [ ] **Step 4: Extend certification** para exigir `product-qa-summary.json`, `security-summary.json`, `api-contract-summary.json` e `release-validation.json` no mesmo commit.
- [ ] **Step 5: Run** testes de certificação existentes + novos.
- [ ] **Step 6: Commit** `feat: bind P2 release validation evidence to commit`.

### Task 7: Final P2 CI gate sem release automático

**Files:**
- Modify: `.github/workflows/p0-hardening.yml`
- Modify: `.woodpecker/artisys-release.yaml`
- Modify: `scripts/artisys-release.ps1`
- Modify: `PRODUCT_STATUS.md`

**Interfaces:**
- GitHub Actions valida o máximo possível em Linux e publica evidências não sensíveis.
- Woodpecker permanece exclusivamente manual e executa o caminho Windows/release real.

- [ ] **Step 1: Add tests/static assertions** garantindo que Woodpecker contenha somente `event: [manual]` e que nenhum script publique automaticamente.
- [ ] **Step 2: Compose GitHub gate order**: imports -> tests -> build -> browser E2E -> phase5 -> contracts -> security(commit) -> product QA -> evidence upload.
- [ ] **Step 3: Compose Woodpecker order**: security(release) -> phase5 Windows -> phase6/build installer -> phase7 real DB -> release-validator -> phase8 certify.
- [ ] **Step 4: Run full GitHub gate** no mesmo commit e anexar evidências.
- [ ] **Step 5: Update status** distinguindo “P2 code/gates verified” de “real Windows release certified”.
- [ ] **Step 6: Commit** `ci: enforce P2 release gates`.

### Task 8: Certificação real Windows/banco legado

**Files:**
- No product code expected unless a real defect is found.
- Evidence: `qa-artifacts/phase5-summary.json`, `phase7-summary.json`, `playwright-summary.json`, `product-qa-summary.json`, `security-summary.json`, `api-contract-summary.json`, `release-validation.json`, `release-certification.json`.

**Interfaces:**
- Consumes: um `artisys-pecuaria.sqlite` legado real e o runner Windows do Woodpecker.
- Produces: instalador `ArtiSys-Pecuaria-Setup-*.exe` com SHA-256 e certificação `passed` do mesmo commit.

- [ ] **Step 1: Run manual Woodpecker** no commit P2 candidato; não habilitar push trigger.
- [ ] **Step 2: Provide** `ARTISYS_LEGACY_DB` apontando para cópia/origem real conforme fluxo phase7; o script trabalha apenas sobre sandbox.
- [ ] **Step 3: Verify** phase5 Windows, build NSIS, phase7, security release e validator.
- [ ] **Step 4: Run** `npm run phase8:certify` e exigir todos os artifacts no mesmo commit.
- [ ] **Step 5: If failure occurs**, corrigir em branch, repetir todos os gates e invalidar evidência anterior.
- [ ] **Step 6: Only after PASS**, marcar `PRODUCT_STATUS.md` como release certificada e mergear o candidato.

## Final Verification

- [ ] `npm run check:imports`
- [ ] `npm test`
- [ ] `npm run build:web`
- [ ] `npm run qa:web`
- [ ] `npm run qa:surface`
- [ ] `npm run qa:contracts`
- [ ] `npm run qa:product`
- [ ] Woodpecker continua manual-only.
- [ ] 10 telas e 16 ações continuam inalteradas.
- [ ] Nenhuma dependência paga/rede foi adicionada ao runtime.
- [ ] Nenhum gate aceita evidência de commit diferente.
- [ ] Certificação real só é declarada após runner Windows + banco legado + instalador reais.
