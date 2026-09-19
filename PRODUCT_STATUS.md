# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **16**
- Dependência paga obrigatória: **nenhuma**

## Hardening P0

O P0 endureceu o núcleo local-first sem criar dual-write nas tabelas legadas:

- transações atômicas na persistência;
- invariantes pecuárias e unicidade concorrente de identificação animal;
- RBAC explícito de Settings/Backup/Restore;
- auditoria persistente com sanitização de credenciais e ator derivado da sessão;
- venda atômica (`trade + lifecycle + financeiro + audit`) com rollback;
- QA funcional das 16 ações contratadas.

## Hardening P1 — verificado

O P1 foi verificado pelo workflow GitHub com:

- suíte Node;
- build web Vite;
- Playwright Chromium;
- UI surface: **10/10 telas**;
- functional actions: **16/16 ações contratadas**;
- RBAC;
- backup/restore.

### Entregas do P1

1. **Frontend operacional**
   - editor JSON removido do fluxo normal;
   - formulários tipados para as 16 ações;
   - normalização de números, listas e datas antes do RPC;
   - shell desktop responsivo, tabelas, diálogos e feedback operacional;
   - Browser E2E percorre as 10 telas e abre os formulários das ações.

2. **Backup verificável**
   - SHA-256 e metadata sidecar por backup;
   - `PRAGMA integrity_check` e validação do `product_id`;
   - backup corrompido rejeitado antes de tocar no banco ativo;
   - safety backup obrigatório antes de restore;
   - retention local configurável, preservando safety/protected backups.

3. **Serviços locais reutilizáveis**
   - busca local limitada às collections de negócio da Pecuária;
   - alertas derivados para sanidade, pesagem e idade do backup;
   - exportação JSON versionada;
   - importação `validate`/`append` com rejeição de IDs duplicados e sem overwrite silencioso;
   - nenhuma dependência SaaS obrigatória.

## Complemento P1 — reporting e dashboard

O desenho original foi completado sem criar novas telas contratadas:

- reporting local para histórico animal, KPIs por lote e sanidade;
- CSV com escaping seguro;
- dashboard derivado dos dados persistidos, sem cache de escrita paralelo;
- KPIs de lotes, animais ativos, peso médio, custos e receitas;
- alertas locais reaproveitados no overview.

## Atualização de versão via GitHub Releases

O desktop está preparado para atualização via GitHub Releases com consentimento explícito:

- checagem automática somente no aplicativo empacotado;
- `autoDownload = false`;
- `autoInstallOnAppQuit = false`;
- sem downgrade automático;
- sem prerelease para o canal normal;
- aviso de nova versão no app;
- botão **Baixar atualização**;
- botão **Instalar e reiniciar** somente após o download;
- botão **Verificar atualizações** em Configurações;
- falha de rede não impede o uso local/offline;
- nenhum `GH_TOKEN` é embutido no executável.

O canal de distribuição é `GitHub Releases`; o build Windows continua usando `--publish never`, portanto publicar uma release é uma decisão separada do build/certificação.

## Hardening P2 — gates implementados

O P2 adiciona gates fail-closed antes da distribuição:

1. **API Contracts**
   - contrato versionado em `qa/api-contract.json`;
   - baseline SHA-256 em `qa/api-contract.baseline.json`;
   - drift entre contrato declarado, contrato atual e baseline bloqueia o gate.

2. **Security Gate**
   - `npm audit --omit=dev --json`;
   - scanner local de segredos em arquivos versionados;
   - suporte a evidência Semgrep quando fornecida;
   - `HIGH`, `CRITICAL` e severidade desconhecida bloqueiam commits;
   - release também bloqueia findings médios/moderados.

3. **Product QA**
   - exige Fase 5, Playwright, contratos e security no mesmo commit;
   - evidência ausente, stale ou reprovada bloqueia o produto.

4. **Release Validator**
   - exige Fase 5, Fase 7, Playwright, Product QA, Security e Contracts no mesmo commit;
   - exige instalador Windows real maior que 1 MiB;
   - confere nome, timestamp e SHA-256 contra `release-run.json`.

5. **Fase 8 ampliada**
   - a certificação final agora também exige `product-qa-summary.json`, `security-summary.json`, `api-contract-summary.json` e `release-validation.json`.

## Fases 5–6

A Fase 5 possui execução automatizada com Node + Browser E2E. O build/certificação final do instalador Windows permanece um gate de release separado.

## Fase 7 — banco legado real

`npm run phase7` valida o banco legado somente através de cópia sandbox: migrations, reabertura, escrita sentinela, backup/restore, preservação de tabelas preexistentes e hash inalterado do original. WAL ativo bloqueia o ensaio.

O fluxo manual de release exige `ARTISYS_LEGACY_DB`; sem um banco real indicado, a certificação final falha de forma explícita.

## Fase 8 — distribuição certificada

`npm run phase8:certify` falha se qualquer evidência for ausente, reprovada ou pertencer a outro commit. O instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ser atual, maior que 1 MiB e recebe SHA-256 na certificação.

Evidências finais em `qa-artifacts/`:

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

**Estado:** P0/P1 estão integrados ao produto. Reporting/dashboard, updater e gates P2 foram implementados. A promoção para distribuição continua condicionada a uma execução manual no Windows com banco legado real e instalador gerado no mesmo commit; merge de código não equivale, por si só, à certificação da distribuição.
