# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas contratadas: **10**
- Ações contratadas: **16**
- Dependência paga obrigatória: **nenhuma**

## Fases 5–6

Implementadas em código; homologação depende de execução fresca.

## Fase 7

`npm run phase7` valida o banco legado somente através de cópia sandbox: migrations, reabertura, escrita sentinela, backup/restore, preservação de tabelas preexistentes e hash inalterado do original. WAL ativo bloqueia o ensaio.

## Fase 8

`npm run phase8:certify` falha se qualquer evidência for ausente, reprovada ou pertencer a outro commit. O instalador `ArtiSys-Pecuaria-Setup-*.exe` precisa ser atual, maior que 1 MiB e recebe SHA-256 na certificação.

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run release:certify
```

Evidências: `phase5-summary.json`, `phase7-summary.json`, `playwright-summary.json` e `release-certification.json` em `qa-artifacts/`.

**Estado:** Fases 0–8 implementadas; homologação e promoção para `main` permanecem bloqueadas até certificação real `passed`. Monorepo preservado como rollback.
