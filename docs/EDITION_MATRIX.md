# ArtiSys Pecuária — matriz de edições

## Regra comercial

| Edição | Preço de referência | Proposta |
|---|---:|---|
| Essencial | R$ 39 | substituir caderno/planilha no controle do rebanho |
| Gestão | R$ 120 | gestão produtiva integrada da propriedade |
| Pro | R$ 330 | operação profissional completa |

Os valores são de venda única. O core obrigatório continua local-first, sem infraestrutura paga ou serviço externo obrigatório.

## Regras de produto

- Um único repositório, um único banco e um único codebase.
- Nenhuma edição limita quantidade de animais artificialmente.
- Upgrade troca apenas o conjunto de features autorizado; dados e banco permanecem.
- Downgrade nunca apaga dados; apenas deixa a feature sem acesso.
- A UI não deve apresentar telas ou ações indisponíveis como se fossem funcionais.
- O backend sempre revalida a feature antes de RBAC e antes da operação de domínio.
- Busca global, alertas, referências e RPCs auxiliares respeitam a mesma matriz de edição; não podem servir como rota lateral para dados não licenciados.
- Licenças são verificáveis offline; serviços externos de licença/feature flag são opcionais.

## Features canônicas

### Essencial

- `dashboard.basic`
- `lots.basic`
- `animals.basic`
- `weights.basic`
- `sanitary.basic`
- `data.basic`
- `data.export`
- `settings.backup`

### Gestão

Inclui todas as features Essencial, mais:

- `animals.batch`
- `sanitary.batch`
- `reproduction.basic`
- `trades.basic`
- `finance.production`
- `reports.basic`
- `traceability.basic`
- `inventory.basic`
- `pastures.basic`
- `nutrition.basic`
- `tasks.basic`
- `data.import`
- `sales.simulation`

### Pro

Inclui todas as features Gestão, mais:

- `animals.body-condition`
- `finance.admin`
- `reproduction.pro`
- `pastures.advanced`
- `field.offline`
- `iot`
- `user.admin`
- `audit`

`pastures.advanced` também governa os mapas produtivos/offline e operações de geometria, evitando que o RPC separado de mapas contorne a edição.

## Superfície por tela/ação

| Tela / ação | Essencial | Gestão | Pro |
|---|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ |
| Lotes | ✓ | ✓ | ✓ |
| Animais: cadastro/movimentação/ciclo/nascimento | ✓ | ✓ | ✓ |
| Animais: operações coletivas | — | ✓ | ✓ |
| Animais: escore corporal | — | — | ✓ |
| Pesagens | ✓ | ✓ | ✓ |
| Sanidade individual/protocolos | ✓ | ✓ | ✓ |
| Sanidade coletiva | — | ✓ | ✓ |
| Reprodução operacional | — | ✓ | ✓ |
| Reprodução profissional | — | — | ✓ |
| Compras e vendas | — | ✓ | ✓ |
| Financeiro produtivo | — | ✓ | ✓ |
| Financeiro administrativo | — | — | ✓ |
| Relatórios zootécnicos | — | ✓ | ✓ |
| Rastreabilidade | — | ✓ | ✓ |
| Estoque e insumos | — | ✓ | ✓ |
| Pastagens básicas | — | ✓ | ✓ |
| Avaliação/rotação avançada de pastagens | — | — | ✓ |
| Mapas produtivos/offline | — | — | ✓ |
| Nutrição | — | ✓ | ✓ |
| Agenda de manejo | — | ✓ | ✓ |
| Campo offline | — | — | ✓ |
| Dados/cadastros | ✓ | ✓ | ✓ |
| Importação de dados | — | ✓ | ✓ |
| IoT/RFID/balanças | — | — | ✓ |
| Backup/restore | ✓ | ✓ | ✓ |
| Usuários/perfis | — | — | ✓ |
| Auditoria | — | — | ✓ |

## Enforcement transversal

A edição é aplicada não apenas à navegação, mas também a:

- `describe`, `load` e `action`;
- RPCs profissionais (`reproductionAdmin`, `userAdmin`, `fieldSync`, `audit`, `maps`);
- simulação comercial;
- busca global, inclusive coleções mistas como `cattle.events`;
- alertas com destino em telas licenciadas;
- referências auxiliares carregadas pelos formulários;
- inicialização automática de IoT.

RBAC continua sendo validado depois da licença/feature. Uma permissão de usuário nunca aumenta a edição comprada.

## Upgrades

- Essencial → Gestão: preserva o mesmo banco e libera as features Gestão.
- Gestão → Pro: preserva o mesmo banco e libera as features Pro.
- Essencial → Pro: preserva o mesmo banco e libera todas as features.

O licenciamento não deve exigir reinstalação nem migração destrutiva.