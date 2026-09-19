# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas contratadas atuais: **11**
- Ações contratadas atuais: **25**
- Dependência paga obrigatória: **nenhuma**

## P0/P1 — núcleo e operação

O produto mantém o núcleo local-first com:

- persistência transacional;
- invariantes pecuárias;
- RBAC e auditoria persistente;
- venda atômica com rollback;
- formulários operacionais tipados;
- backup verificável com SHA-256 e safety backup;
- busca, alertas e importação/exportação locais.

## IoT opcional — preservado

A integração P0/P1 de IoT permanece incorporada e opcional, sem custo recorrente obrigatório:

- tela `iot` / **Dispositivos e IoT**;
- RFID/EID e balança;
- conectores serial, MQTT e HTTP;
- registry persistente e secret store local;
- simuladores para validação sem hardware;
- ausência de hardware ou integração não impede o uso normal do sistema.

O contrato atual contém **11 telas e 25 ações**, incluindo as 9 ações IoT.

## Reporting e dashboard

O hardening adiciona serviços locais reutilizáveis sem remover a superfície IoT:

- histórico por animal;
- KPIs por lote;
- relatório sanitário;
- CSV com escaping seguro;
- dashboard derivado da fonte de verdade persistida;
- preservação dos KPIs existentes de sanidade e negociações;
- novos KPIs financeiros de custos e receitas;
- nenhuma cache paralela de escrita.

## Atualização de versão via GitHub Releases

O desktop está preparado para atualização não silenciosa:

- checagem automática somente no executável empacotado;
- `autoDownload = false`;
- `autoInstallOnAppQuit = false`;
- sem downgrade automático;
- sem prerelease para o canal normal;
- aviso de versão disponível;
- **Baixar atualização** exige ação do usuário;
- **Instalar e reiniciar** exige nova ação explícita;
- **Verificar atualizações** disponível em Configurações;
- falha de internet não bloqueia o funcionamento local;
- nenhum `GH_TOKEN` é embutido no cliente.

O canal é GitHub Releases. O build Windows usa `--publish never`; build, certificação e publicação continuam separados.

## P2 — gates de produto e release

### API Contracts

- contrato versionado em `qa/api-contract.json`;
- baseline SHA-256 em `qa/api-contract.baseline.json`;
- drift do contrato atual de 11 telas/25 ações bloqueia o gate.

### Security Gate

- `npm audit --omit=dev --json`;
- scanner de segredos em arquivos versionados;
- suporte a evidência Semgrep;
- `HIGH`, `CRITICAL` e severidade desconhecida bloqueiam commit;
- release também bloqueia findings médios/moderados.

### Product QA

Exige no mesmo commit:

- Fase 5;
- Playwright;
- API Contracts;
- Security.

Evidência ausente, stale ou reprovada bloqueia o produto.

### Release Validator

Exige no mesmo commit:

- Fase 5;
- Fase 7;
- Playwright;
- Product QA;
- Security;
- API Contracts;
- instalador Windows real maior que 1 MiB;
- nome, timestamp e SHA-256 compatíveis com `release-run.json`.

## Fase 7 — banco legado real

`npm run phase7` opera somente sobre cópia sandbox do banco informado por `ARTISYS_LEGACY_DB`. O original precisa permanecer byte a byte inalterado. WAL ativo bloqueia o ensaio.

Sem banco real indicado, a certificação final falha explicitamente.

## Fase 8 — distribuição certificada

A Fase 8 exige todas as evidências do mesmo commit:

- `phase5-summary.json`;
- `playwright-summary.json`;
- `api-contract-summary.json`;
- `security-summary.json`;
- `product-qa-summary.json`;
- `phase7-summary.json`;
- `release-validation.json`;
- `release-certification.json`.

## Woodpecker

O Woodpecker permanece **somente manual**:

```yaml
when:
  - event: [manual]
```

O wrapper Windows executa os gates P2, Fase 7, Release Validator e Fase 8 antes de considerar a distribuição aprovada.

**Estado:** P0/P1 e IoT P0/P1 estão preservados. Reporting/dashboard, updater e gates P2 estão implementados sobre a linha atual do produto. A linha de integração parte da `main` com IoT já incorporado, evitando regressão do trabalho paralelo. A certificação de distribuição continua exigindo uma execução manual no Windows com banco legado real e instalador gerado no mesmo commit; merge de código não equivale à certificação da distribuição.
