# ArtiSys Pecuária — Fases 5–10 das edições

## Objetivo

Concluir a transformação do mesmo produto em três edições comerciais — Essencial, Gestão e Pro — sem forks de código, sem bancos separados e sem dependência obrigatória de SaaS.

## Fase 5 — UX por edição

- Essencial deve parecer um produto menor e focado, não uma versão Pro cheia de bloqueios.
- Gestão apresenta somente módulos e profundidade intermediária licenciados.
- Pro mantém a superfície completa.
- Menus e painéis indisponíveis ficam ocultos por padrão; cadeados são exceção, não navegação principal.
- A edição atual deve ficar visível em Configurações/identidade do produto.
- Painéis Pro embutidos em telas compartilhadas só executam/carregam quando a feature correspondente existir.

Critério de aceite: uma edição menor não dispara RPC Pro em segundo plano nem apresenta subseções profissionais vazias/erro de licença.

## Fase 6 — Continuidade de dados em upgrade/downgrade

- Mesmo SQLite e mesmas migrations para todas as edições.
- Upgrade altera somente entitlement/licença.
- Downgrade não apaga registros de features superiores.
- Reabrir o mesmo dataDir com outra edição deve preservar cadastros, histórico e versões.

Critério de aceite: Essencial → Gestão → Pro → Essencial no mesmo banco preserva registros e schema.

## Fase 7 — QA por edição

- Contratos explícitos para Essential/Management/Pro.
- Validar telas, ações, RPCs, busca, alertas, mapas, backup/restore e dados mistos.
- Validar licença adulterada, expirada, outro produto e device incompatível.
- Gate automatizado deve falhar se a matriz comercial e a superfície executável divergirem.

Critério de aceite: `qa:editions` gera evidência JSON e termina verde para as três edições.

## Fase 8 — Distribuição com um codebase

- Estratégia principal: um instalador Windows x64 e uma versão do aplicativo.
- Edição é determinada pelo entitlement/licença, não por código compilado diferente.
- É permitido publicar três páginas/produtos comerciais apontando para o mesmo instalador.
- Nenhum build Essencial/Gestão pode conter fork de fonte.

Critério de aceite: manifesto de distribuição declara um único artefato e os três SKUs compatíveis.

## Fase 9 — Catálogo comercial e upgrades

SKUs de venda única:

- `PEC-ESSENTIAL`: R$ 39
- `PEC-MANAGEMENT`: R$ 120
- `PEC-PRO`: R$ 330

Upgrades pagam apenas a diferença de preço vigente:

- Essencial → Gestão: R$ 81
- Gestão → Pro: R$ 210
- Essencial → Pro: R$ 291

O contrato de checkout deve ser independente do provedor. Mercado Livre, Shopee, Gumroad ou checkout próprio podem consumir os mesmos SKUs; nenhum provedor pago é dependência do core.

Critério de aceite: catálogo e cálculo de upgrade são determinísticos e testados.

## Fase 10 — Telemetria local opcional

- Desativada por padrão.
- Armazenamento somente local no core.
- Sem endpoint remoto obrigatório.
- Pode registrar versão, edição, conjunto de features, erros técnicos, estado de migrations e último backup, além dos eventos de UI já existentes.
- Deve filtrar dados sensíveis e permitir exportar/limpar localmente.

Critério de aceite: com telemetria desligada nenhum evento é persistido; quando ativada, contexto técnico seguro acompanha os eventos e continua sem envio de rede.

## Decisões invariantes

- Um repositório, um banco, um codebase.
- Core obrigatório R$ 0 de infraestrutura: local/self-hosted/open source.
- Serviço pago somente como integração opcional e explícita.
- Licença/feature limita produto antes de RBAC; RBAC nunca amplia a edição.
- Upgrade não exige reinstalação nem migração destrutiva.
