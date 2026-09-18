# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Banco: `artisys-pecuaria.sqlite`
- Telas contratadas: **10**
- Ações contratadas: **16**
- Dependência paga obrigatória: **nenhuma**

## Fase 5

Implementada; homologação depende de execução fresca de `npm run phase5`.

## Fase 6

Implementada; cutover depende de banco legado e build Windows reais:

```powershell
$env:ARTISYS_LEGACY_DB="C:\caminho\artisys-pecuaria.sqlite"; npm run cutover:verify
```

Até o gate verde, o monorepo continua como rollback.
