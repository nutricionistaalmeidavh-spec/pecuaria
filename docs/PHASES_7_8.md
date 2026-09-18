# Fases 7 e 8 — ArtiSys Pecuária

## Fase 7

O gate usa `ARTISYS_LEGACY_DB` somente como fonte de leitura. Ele rejeita WAL ativo, registra SHA-256 e snapshot lógico do original, copia para sandbox como `artisys-pecuaria.sqlite`, abre o runtime standalone, exige `agro-pecuaria/001-initial.sql`, testa escrita/reabertura e backup/restore e compara todas as tabelas preexistentes. O hash final do original deve permanecer idêntico.

Evidência: `qa-artifacts/phase7-summary.json`.

## Fase 8

A certificação é fail-closed: F5, F7 e Playwright precisam estar `passed` e vinculados ao HEAD atual; o instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ter mais de 1 MiB e ser mais novo que as evidências da rodada. Seu SHA-256 é gravado em `qa-artifacts/release-certification.json`.

## Windows

```powershell
npm install --no-audit --no-fund
npx playwright install chromium
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"
npm run release:certify
```

Não remover o produto do monorepo antes de `release-certification.json` registrar `status: passed`.
