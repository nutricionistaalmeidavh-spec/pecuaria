# ArtiSys Release — Pecuária

Este produto usa `artisys-release` + `artisys-ci-reporter` do `utilidades`, pinado por `.artisys/utilidades.lock` no commit `a444031860d5b8c91adc5628759bc67c0c29d557`.

No host Windows/Woodpecker configure `ARTISYS_UTILIDADES_PATH` para o clone compartilhado e `GITHUB_REPORT_TOKEN` como segredo do host. O workflow exige `windows/amd64`, backend `local`, eventos `push`/`manual` e chama somente `scripts/artisys-release.ps1`.

Ordem: `deps → test → build → installer → qa → evidence`. O evidence exige F5 + Playwright do mesmo commit e instalador >1 MiB.

F7 continua manual com `ARTISYS_LEGACY_DB` real. F8 exige F5/F7/Playwright + `release-run.json` do mesmo commit, mesmo pin de `utilidades` e mesmo hash do instalador.

Dry-run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\artisys-release.ps1 -DryRun`.

A ativação do repo na UI do Woodpecker/webhook é operacional e externa; não habilite PR/fork não confiável no agente local.
