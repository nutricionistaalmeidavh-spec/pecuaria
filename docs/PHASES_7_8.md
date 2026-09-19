# Fases 7 e 8 — ArtiSys Pecuária

## Fase 7 — ensaio automático de dados

`npm run phase7` não exige banco de cliente. Por padrão ele cria um SQLite reproduzível a partir de `qa/fixtures/legacy-fixture.sql` e usa somente uma cópia sandbox.

O gate:

- registra SHA-256 e snapshot lógico da fonte;
- abre a sandbox como `artisys-pecuaria.sqlite`;
- exige `agro-pecuaria/001-initial.sql`;
- testa escrita e reabertura;
- testa backup/restore;
- verifica preservação das tabelas preexistentes;
- exige que o hash da fonte permaneça idêntico.

Evidência: `qa-artifacts/phase7-summary.json` com `sourceKind: fixture` no fluxo normal.

### Banco externo opcional

Quando existir uma instalação anterior real, é possível executar a mesma prova contra esse banco sem modificar o original:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"
npm run phase7
```

Nesse caso a evidência registra `sourceKind: external`. WAL ativo continua bloqueando o ensaio para evitar snapshot inconsistente.

## Fase 8 — certificação da distribuição

A certificação é fail-closed. No mesmo commit precisam estar `passed`:

- Fase 5;
- Playwright;
- API Contracts;
- Security release;
- Product QA;
- Fase 7;
- Release Validator.

O instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ter mais de 1 MiB e corresponder por nome e SHA-256 ao `release-run.json`. O resultado final é `qa-artifacts/release-certification.json`.

## GitHub Actions / Windows

`.github/workflows/release.yml` executa automaticamente toda a cadeia em `windows-latest`, gera o instalador e `latest.yml`, valida os artefatos e anexa as evidências. Em tags `vX.Y.Z`, após certificação, publica os arquivos no GitHub Release usado pelo updater.
