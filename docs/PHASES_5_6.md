# Migração standalone — Fases 5 e 6

## Fase 5 — Homologação de robustez independente

`npm run phase5` valida fronteira standalone, testes Node, build web, autenticação, 100% das telas e ações declaradas em `qa/product-contract.json`, contrato RBAC, backup/restauração, reabertura do SQLite e navegação completa pelo Playwright. O resumo fica em `qa-artifacts/phase5-summary.json`.

Contrato atual: **11 telas e 25 ações**, incluindo a superfície IoT opcional.

## Fase 6 — Compatibilidade e build técnico

`npm run compat:contract` valida `productId`, `artisys-pecuaria.sqlite`, namespace de migration, propriedade do banco e migrations obrigatórias.

`npm run phase6` valida contrato e gera o build Windows. A certificação atual não depende de banco legado de cliente: a Fase 7 usa fixture versionada e reproduzível do próprio repositório.

Quando futuramente houver uma instalação anterior, a compatibilidade com banco externo continua disponível como prova adicional:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"
npm run compat:legacy
```

O banco externo é tratado como fonte de leitura/cópia; a atualização ocorre em sandbox.
