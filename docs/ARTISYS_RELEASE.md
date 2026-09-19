# ArtiSys Release — Pecuária

## Caminho padrão

A release normal do ArtiSys Pecuária é certificada pelo GitHub Actions em `.github/workflows/release.yml`, usando runner `windows-latest`. O fluxo não depende do Woodpecker, de clone do `utilidades` no host nem de banco de cliente.

Ordem de certificação:

1. dependências e import boundary;
2. testes Node;
3. build web;
4. Playwright;
5. Fase 5 — 100% da superfície contratada;
6. API Contracts;
7. Security em modo release;
8. Product QA;
9. Fase 7 com fixture SQLite versionada no repositório;
10. build Windows;
11. `release-run.json` com SHA-256 do instalador;
12. Release Validator;
13. Fase 8;
14. validação de `latest.yml` e artefatos do updater.

O build usa `--publish never`: gerar e certificar nunca publica silenciosamente uma versão.

## Publicação e updater

Uma tag estável `vX.Y.Z` cujo valor coincida com `package.json` publica no GitHub Release apenas depois dos gates acima. A release inclui:

- `ArtiSys-Pecuaria-Setup-X.Y.Z.exe`;
- `latest.yml`;
- `.blockmap` quando gerado;
- `release-certification.json`;
- `release-validation.json`.

O aplicativo consulta GitHub Releases automaticamente, mas `autoDownload=false` e `autoInstallOnAppQuit=false`: o usuário precisa autorizar o download e depois escolher instalar/reiniciar.

## Fase 7

Sem `ARTISYS_LEGACY_DB`, a Fase 7 gera automaticamente um SQLite reproduzível a partir de `qa/fixtures/legacy-fixture.sql`, migra uma cópia sandbox, testa escrita/reabertura e backup/restore, comprova preservação das tabelas preexistentes e confirma que a fonte não foi alterada.

Quando futuramente existir banco real de cliente, `ARTISYS_LEGACY_DB` continua disponível como homologação adicional. Ele não é requisito para a release atual porque ainda não existe base de cliente anterior.

## Woodpecker

O Woodpecker permanece como caminho opcional e **somente manual**. `.woodpecker/artisys-release.yaml` não possui gatilho de `push`.

Dry-run opcional do fluxo antigo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\artisys-release.ps1 -DryRun
```
