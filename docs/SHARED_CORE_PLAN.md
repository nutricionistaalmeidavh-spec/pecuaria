# Shared core boundary — Pecuária

A extração deste produto não poderá manter imports por caminho para `SistemasNichadosAgroFrota` nem copiar regras de negócio de outro vertical.

Core compartilhado identificado:

- `ui-shell`
- `vertical-persistence`
- `product-documents`
- `product-security`
- `domain-agro-core` permanece rastreado até a poda definitiva de dependências
- módulos obrigatórios listados em `DEPENDENCY_INVENTORY.md`

O padrão do piloto `SistemaLavoura` será reutilizado: produto isolado, core versionado/pinado, proveniência explícita e nenhuma dependência paga obrigatória.
