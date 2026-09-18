# ArtiSys Pecuária — Fases 7 e 8

## Objetivo

Fechar a migração standalone com ensaio de cutover sobre uma cópia do banco legado real e certificação de release baseada em evidências do commit atual.

## Fase 7 — Ensaio de cutover

Entrada obrigatória: `ARTISYS_LEGACY_DB` para um arquivo existente `artisys-pecuaria.sqlite`.

O ensaio deve: calcular SHA-256 do original; copiar para sandbox; tirar snapshot lógico das tabelas antigas; abrir a cópia com `createStandaloneHost`; aplicar/validar `agro-pecuaria/001-initial.sql`; confirmar `productId=agro-pecuaria`; criar backup; gravar e reabrir um sentinel em `qa.cutover`; restaurar o backup; garantir preservação de todos os dados preexistentes; recalcular o hash do original e exigir igualdade; gravar `qa-artifacts/phase7-summary.json` com commit Git e resultado.

O banco original nunca é aberto em escrita.

## Fase 8 — Certificação

A certificação exige no mesmo commit:
- `phase5-summary.json` passado;
- `phase7-summary.json` passado;
- `playwright-summary.json` passado;
- `npm run check` verde;
- instalador `release/ArtiSys-Pecuaria-Setup-*.exe` maior que 1 MiB;
- hash SHA-256 do instalador registrado em `qa-artifacts/release-certification.json`.

Ordem: F5 → F7 → Playwright → check → build Windows → certificador.

## Contrato funcional

Telas: `overview`, `lots`, `animals`, `weights`, `sanitary`, `reproduction`, `trades`, `finance`, `reports`, `settings`.

Ações: `lots/save`, `lots/remove`, `animals/save`, `animals/move`, `animals/lifecycle`, `weights/record`, `sanitary/saveProtocol`, `sanitary/record`, `reproduction/record`, `trades/create`, `finance/addCost`, `finance/fromTrade`, `reports/csv`, `reports/issue`, `settings/backup`, `settings/restore`.

## Restrições

`productId=agro-pecuaria`; banco `artisys-pecuaria.sqlite`; core obrigatório R$0/self-hosted/open source; monorepo preservado como rollback; nenhuma promoção automática para `main`.