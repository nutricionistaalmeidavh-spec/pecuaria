# IoT P1 Local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar integração IoT local utilizável pelo cliente com Serial/USB, MQTT, HTTP, RFID, balança e simulador, sem custo recorrente para a ArtiSys.

**Architecture:** O domínio pecuário continua independente de hardware. `src/iot` contém contratos, persistência, perfis e orquestração; drivers Node ficam em `runtime/iot` e são injetados no serviço. A tela IoT usa o mesmo backend autenticado do produto e o fluxo RFID→animal→balança registra peso pelo domínio existente.

**Tech Stack:** Node 22, Electron 44, SQLite/persistência vertical existente, React 19, `serialport` 13, `mqtt` 5, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-iot-p1-design.md`

## Global Constraints

- Nenhum servidor ou SaaS ArtiSys obrigatório.
- Nenhuma API paga.
- Hardware e broker pertencem ao cliente.
- O sistema principal deve continuar funcional sem nenhum dispositivo configurado.
- Protocolos proprietários exigem adapter específico e não são anunciados como compatibilidade universal.
- Alterações devem permanecer na branch `feature/iot-local-p1` até verificação completa.

## Review Focus

- Porta serial ausente/ocupada deve retornar erro controlado sem derrubar o app.
- MQTT indisponível deve manter dispositivo desconectado e permitir retry.
- RFID desconhecido não pode gerar pesagem em animal errado.
- Peso instável não pode ser gravado automaticamente.
- Duas estações simultâneas não podem compartilhar o animal corrente.

---

### Task 1: Rebase lógico do P0 sobre o hardening atual

**Files:** P0 `src/iot/**`, `tests/iot-core.test.js`, `docs/IOT_P0.md`, workflow IoT.

- [ ] Incorporar os arquivos P0 na branch P1 sem sobrescrever mudanças do hardening.
- [ ] Rodar `node --test tests/iot-core.test.js` e confirmar 9/9.
- [ ] Rodar `npm test`, `npm run check:imports` e `npm run build:web`.

### Task 2: Registry persistente, perfis e configuração

**Files:**
- Create: `src/iot/profiles.js`
- Create: `src/iot/persistent-registry.js`
- Create: `tests/iot-p1-registry.test.js`

**Produces:** `createPersistentDeviceRegistry`, `IOT_PROFILES`, validação de configs e bindings RFID.

- [ ] Escrever testes RED para persistência, validação por transporte e segredo redigido.
- [ ] Implementar registry sobre `iot.devices` e `iot.rfid-bindings`.
- [ ] Verificar testes GREEN.

### Task 3: Drivers locais e Device Manager

**Files:**
- Create: `runtime/iot/node-drivers.mjs`
- Create: `src/iot/device-manager.js`
- Modify: `package.json`
- Create: `tests/iot-p1-manager.test.js`

**Produces:** drivers Serial/MQTT/HTTP injetáveis, listagem de portas, test/start/stop, simulador.

- [ ] Escrever testes RED para lifecycle, isolamento por dispositivo e falhas controladas.
- [ ] Implementar manager sem importar drivers Node no bundle web.
- [ ] Adicionar `serialport` e `mqtt` como dependências locais open-source.
- [ ] Verificar GREEN e importabilidade das dependências.

### Task 4: RFID → animal → pesagem por estação

**Files:**
- Create: `src/iot/cattle-bridge.js`
- Create: `tests/iot-p1-cattle-bridge.test.js`

**Produces:** `createCattleIoTBridge` com contexto por `stationId`, janela de correlação e gravação apenas de peso estável.

- [ ] RED: RFID vinculado seleciona animal na estação.
- [ ] RED: RFID desconhecido não seleciona animal.
- [ ] RED: peso instável não grava.
- [ ] RED: peso estável grava no animal correto e mantém estações isoladas.
- [ ] Implementar usando repositories/domínio existentes e auditoria.
- [ ] GREEN.

### Task 5: Serviço IoT e tela configurável

**Files:**
- Create: `src/iot/service.js`
- Modify: `runtime/host.mjs`
- Modify: `src/presentation.js`
- Modify: `src/ui.js`
- Modify: `src/security.js`
- Modify: `web/action-config.js`
- Modify: `web/main.jsx`
- Create: `tests/iot-p1-presentation.test.js`

**Produces:** tela `iot`, ações `saveDevice`, `removeDevice`, `testDevice`, `startDevice`, `stopDevice`, `bindRfid`, `unbindRfid`, `simulateRfid`, `simulateWeight`.

- [ ] RED para navegação, permissões e ações.
- [ ] Implementar serviço e integração do host.
- [ ] Implementar formulários operacionais sem JSON cru.
- [ ] GREEN e build web.

### Task 6: CI, documentação e verificação final

**Files:**
- Create: `.github/workflows/iot-p1.yml`
- Create: `docs/IOT_P1.md`

- [ ] CI executa testes P0/P1, suíte completa, import boundary e build web.
- [ ] Documentar configuração Serial, MQTT, HTTP, simulador e limites de compatibilidade.
- [ ] Rodar CI completo e registrar qualquer falha externa ao P1.
- [ ] Comparar branch com hardening e confirmar que mudanças são restritas ao escopo IoT e pontos explícitos de integração.
