# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **16**
- Dependência paga obrigatória: **nenhuma**

## Hardening P0

O núcleo P0 foi endurecido na branch `hardening/pecuaria-p0-p2` sem dual-write nas tabelas legadas e sem alterar `main`.

Verificação automatizada concluída no commit `ebb01c8034508158bbd9856686a885d97a4699ce`:

- suíte Node: **40/40 testes passando**;
- import boundary: **passed**;
- build web: **passed**;
- UI surface coverage: **10/10 telas**;
- functional action coverage: **16/16 ações contratadas executadas**;
- negative-domain coverage: **passed** para os casos obrigatórios do P0;
- RBAC de Settings/Backup/Restore: **passed**;
- auditoria local persistente e sanitização de credenciais: **passed**;
- venda atômica com rollback induzido e reabertura do SQLite: **passed**;
- backup/restore e persistência após reinício: **passed**.

A evidência `phase5-summary.json` foi produzida e anexada pelo workflow `Pecuaria P0 Hardening` no mesmo commit verificado.

## Fases 5–6

A Fase 5 de superfície/ações locais já possui execução fresca automatizada no hardening P0. A homologação completa de release ainda exige o fluxo Windows/Playwright previsto pelo `npm run phase5` e os gates subsequentes.

## Fase 7

`npm run phase7` valida o banco legado somente através de cópia sandbox: migrations, reabertura, escrita sentinela, backup/restore, preservação de tabelas preexistentes e hash inalterado do original. WAL ativo bloqueia o ensaio.

## Fase 8

`npm run phase8:certify` falha se qualquer evidência for ausente, reprovada ou pertencer a outro commit. O instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ser atual, maior que 1 MiB e recebe SHA-256 na certificação.

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run release:certify
```

Evidências finais de release: `phase5-summary.json`, `phase7-summary.json`, `playwright-summary.json` e `release-certification.json` em `qa-artifacts/`.

**Estado:** P0 de hardening verificado. P1/P2 e a homologação final Windows/instalador permanecem separados; promoção para `main` continua bloqueada até certificação real `passed` vinculada ao mesmo commit. Monorepo preservado como rollback.
