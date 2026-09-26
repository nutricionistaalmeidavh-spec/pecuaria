# Pecuaria Editions and Offline Licensing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as Fases 0–4 de edições comerciais, feature flags, enforcement backend e licenciamento offline no mesmo codebase do ArtiSys Pecuária.

**Architecture:** Um contexto único de acesso resolve presets de edição ou features assinadas em licença Ed25519. Presentation filtra superfície visual/ações e o backend revalida feature antes de RBAC. O default sem licença permanece Pro para compatibilidade.

**Tech Stack:** Node.js 22 ESM, node:test, node:crypto Ed25519, runtime Electron/browser local-first.

**Spec:** `docs/superpowers/specs/2026-09-26-pecuaria-editions-licensing-design.md`

## Global Constraints

- Core obrigatório sem infraestrutura paga ou serviço remoto obrigatório.
- Um único repositório, banco e codebase.
- Nenhum limite artificial por quantidade de animais.
- Chave privada de licença nunca é empacotada no cliente.
- Ausência de licença com `licenseRequired=false` mantém Pro por compatibilidade.
- Token fornecido e inválido falha fechado.
- Downgrade não apaga dados.

## Review Focus

- Feature conhecida ausente da licença deve negar com `FEATURE_NOT_LICENSED`.
- Feature desconhecida deve permanecer desabilitada por default.
- Token de outro produto deve ser rejeitado.
- Token vinculado a outro device deve ser rejeitado quando deviceId for informado.
- Tela mista (Financeiro/Pastagens/Animais) não pode expor ações Pro em edição Gestão.

---

### Task 1: Contratos reutilizáveis de flags e licença

**Files:**
- Create: `shared/packages/feature-flags/src/index.js`
- Create: `shared/packages/licensing/src/index.js`
- Test: `tests/editions-licensing.test.js`

**Interfaces:**
- Produces: `resolveFeatureFlag`, `isFeatureEnabled`, `mergeFeatureFlags`, `createLicensePayload`, `signLicense`, `verifyLicense`, `isLicensedFeatureEnabled`.

- [ ] Escrever testes que importam os contratos ainda inexistentes.
- [ ] Rodar `npm test` e confirmar falha por módulo ausente.
- [ ] Implementar os contratos mínimos compatíveis com `utilidades`.
- [ ] Rodar `npm test` e confirmar verde para os contratos.

### Task 2: Catálogo e matriz executável de edições

**Files:**
- Create: `src/editions.js`
- Modify: `src/ui.js`
- Test: `tests/editions-licensing.test.js`

**Interfaces:**
- Produces: `createEditionAccess`, `editionFeatures`, `featureForScreen`, `featureForAction`, `featureForRpc`, `filterScreensForEdition`.

- [ ] Testar cumulatividade Essencial/Gestão/Pro e flags desconhecidas desligadas.
- [ ] Testar navegação Essencial e ações mistas Gestão/Pro.
- [ ] Implementar catálogo e filtros.
- [ ] Rodar suíte.

### Task 3: Integrar edition access na presentation e backend

**Files:**
- Modify: `src/presentation.js`
- Modify: `runtime/backend.mjs`
- Test: `tests/edition-backend.test.js`

**Interfaces:**
- Consumes: `createEditionAccess`.
- Produces: `presentation.services.editionAccess`; backend com `FEATURE_NOT_LICENSED`.

- [ ] Testar `describe()` filtrado.
- [ ] Testar action/load indisponível negado antes da operação.
- [ ] Testar `reproductionAdmin`, `userAdmin`, `fieldSync` e `audit` em edição sem feature.
- [ ] Implementar guards e metadados de edição.
- [ ] Rodar suíte.

### Task 4: Resolver licença no runtime/host

**Files:**
- Create: `runtime/license.mjs`
- Modify: `runtime/host.mjs`
- Test: `tests/editions-licensing.test.js`

**Interfaces:**
- Produces: `resolveProductAccess({edition,licenseToken,licensePublicKey,licenseRequired,deviceId,now})`.

- [ ] Testar licença válida assinada com chave efêmera.
- [ ] Testar assinatura/produto/device/expiração inválidos.
- [ ] Testar default Pro sem licença e modo obrigatório sem token.
- [ ] Implementar resolução e injeção no host.
- [ ] Rodar suíte completa.

### Task 5: Gate final e PR

**Files:**
- Verify only.

- [ ] Rodar `npm test`.
- [ ] Rodar `npm run check:imports`.
- [ ] Rodar `npm run build:web`.
- [ ] Rodar gates existentes via workflow de PR.
- [ ] Inspecionar diff e abrir PR contra `main`.