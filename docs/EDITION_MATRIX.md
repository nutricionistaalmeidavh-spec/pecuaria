# ArtiSys Pecuária — matriz de edições

## Regra comercial

| Edição | SKU | Preço de referência | Proposta |
|---|---|---:|---|
| Essencial | `PEC-ESSENTIAL` | R$ 39 | substituir caderno/planilha no controle do rebanho |
| Gestão | `PEC-MANAGEMENT` | R$ 120 | gestão produtiva integrada da propriedade |
| Pro | `PEC-PRO` | R$ 330 | operação profissional completa |

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

## UX por edição

- Essencial mantém somente a navegação e ações essenciais e oculta áreas profissionais embutidas.
- Gestão acrescenta fluxos produtivos, mas não monta Financeiro administrativo, mapas avançados, Campo Offline, usuários ou auditoria Pro.
- Pro mantém toda a profundidade.
- Configurações exibe a edição ativa e, no desktop, permite colar um novo token de licença assinado para upgrade.
- O cliente evita solicitar RPCs de estado Pro quando a feature não está presente; o backend continua rejeitando qualquer tentativa direta.

## Upgrades e valores

O valor do upgrade é a diferença entre os preços vigentes:

| Upgrade | Valor |
|---|---:|
| Essencial → Gestão | R$ 81 |
| Gestão → Pro | R$ 210 |
| Essencial → Pro | R$ 291 |

Todos preservam o mesmo banco e executável. Após instalar um token de licença válido, basta reiniciar o aplicativo para aplicar a nova edição. Downgrade não remove dados de módulos superiores.

## Distribuição

A estratégia oficial é `single-installer`:

- um único artefato Windows x64 NSIS: `ArtiSys-Pecuaria-Setup-<versão>.exe`;
- os três SKUs comerciais apontam para esse mesmo instalador;
- a edição é determinada pelo entitlement/licença, não por um fork de código;
- checkout é provider-agnostic: Mercado Livre, Shopee, Gumroad ou integração própria são opcionais e não alteram o core;
- a chave privada de assinatura nunca é distribuída com o aplicativo.

O utilitário `npm run license:cli -- keygen` gera localmente o par Ed25519 e `npm run license:cli -- issue ...` emite tokens por edição. A chave privada deve ser mantida fora do repositório e do instalador.

## Telemetria local opcional

- desativada por padrão;
- armazenamento somente no `localStorage` do produto;
- sem endpoint remoto ou SaaS obrigatório;
- exportação e limpeza manuais;
- registra somente contexto técnico permitido: versão, edição, features, migrations, último backup, tipo do evento e erros sanitizados;
- chaves sensíveis como senha, token, segredo, credencial, e-mail, telefone, nome, payload e documento são filtradas.

O licenciamento, a telemetria e os upgrades não exigem reinstalação nem migração destrutiva.
