# Migração standalone — Fases 5 e 6

## Fase 5 — Homologação de robustez independente

`npm run phase5` valida fronteira standalone, testes Node, build web, autenticação, 100% das telas e ações declaradas em `qa/product-contract.json`, contrato RBAC, backup/restauração, reabertura do SQLite e navegação completa pelo Playwright. O resumo fica em `qa-artifacts/phase5-summary.json`.

Contrato atual: 10 telas e 16 ações de Pecuária.

## Fase 6 — Compatibilidade e cutover técnico

`npm run compat:contract` valida `productId`, `artisys-pecuaria.sqlite`, namespace de migration, propriedade do banco e migrations obrigatórias.

Para prova com banco existente:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run compat:legacy
```

O banco original é apenas copiado; a atualização ocorre numa sandbox temporária. `npm run phase6` valida contrato e build Windows. `npm run cutover:verify` exige Fase 5 + banco legado + instalador.

O monorepo permanece rollback/reference até homologação real.
