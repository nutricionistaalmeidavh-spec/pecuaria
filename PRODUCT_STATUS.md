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

O P1 foi concluído na branch `hardening/pecuaria-p0-p2` e verificado no commit `54576fdaccc5be1e4fa7f98f328201b3cc9d7555` pelo workflow `Pecuaria P0-P1 Hardening` (run `35469526384`).

Evidência do mesmo commit:

- import boundary: **passed** (`53` arquivos/imports verificados);
- suíte Node: **52/52 testes passando**;
- build web Vite: **passed**;
- Playwright Chromium: **2/2 testes E2E passando**;
- UI surface: **10/10 telas**;
- functional actions: **16/16 ações contratadas executadas**;
- RBAC: **passed**;
- backup/restore: **passed**;
- artefato QA anexado pelo Actions: `pecuaria-p1-qa`.

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
   - nenhuma nova tela/ação contratada e nenhuma dependência SaaS obrigatória.

## Fases 5–6

A Fase 5 local possui execução fresca automatizada com Node + Browser E2E. O build/certificação final do instalador Windows continua sendo um gate de release separado.

## Fase 7

`npm run phase7` valida o banco legado somente através de cópia sandbox: migrations, reabertura, escrita sentinela, backup/restore, preservação de tabelas preexistentes e hash inalterado do original. WAL ativo bloqueia o ensaio.

## Fase 8

`npm run phase8:certify` falha se qualquer evidência for ausente, reprovada ou pertencer a outro commit. O instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ser atual, maior que 1 MiB e recebe SHA-256 na certificação.

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run release:certify
```

Evidências finais de release: `phase5-summary.json`, `phase7-summary.json`, `playwright-summary.json` e `release-certification.json` em `qa-artifacts/`.

**Estado:** P0 e P1 implementados e verificados. A integração do código em `main` foi autorizada separadamente da certificação de release. P2 e a homologação final Windows/banco legado real/instalador permanecem pendentes; merge em `main` não equivale à certificação final de distribuição. Monorepo preservado como rollback.
