# Data compatibility — ArtiSys Pecuária

Preservar na futura extração:

- product id `agro-pecuaria`;
- targets `desktop` e `pwa`;
- `migrations/`, `seeds/`, `branding/` e persistence metadata da origem;
- collections de lotes, animais, eventos, protocolos, negociações, financeiro e documentos;
- formato de backup/recovery.

Nenhum schema legado é removido durante o hardening.

## Fonte operacional de verdade

Durante o P0, os registros vivos do produto são armazenados exclusivamente em `__artisys_records`.

As tabelas `cattle_*` legadas permanecem como estruturas de compatibilidade de migração. O produto não realiza dual-write nelas, evitando divergência entre duas representações do mesmo dado.

Constraints que atravessam collections — por exemplo unicidade da identificação do animal e referências para lote/protocolo — são aplicadas nos repositories/use-cases e fixadas por testes automatizados.

Operações multi-entidade críticas usam a transação do adapter local SQLite para garantir commit integral ou rollback integral.
