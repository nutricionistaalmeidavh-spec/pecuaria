# Functionality matrix — ArtiSys Pecuária

> Fonte de verdade funcional: `src/ui.js`, `src/presentation.js`, `runtime/backend.mjs` e `qa/product-contract.json`.
> Atualizado em 2026-09-20 para refletir a superfície atual da versão 1.0.1, incluindo profundidade de mercado, administração local e campo offline.

| Tela | Funcionalidades expostas |
|---|---|
| Dashboard (`overview`) | KPIs, alertas, desempenho de peso/GMD, resumo reprodutivo, indicadores reprodutivos derivados, sanidade, distribuição por lote, financeiro e atividade recente |
| Lotes (`lots`) | `save`, `remove` |
| Animais (`animals`) | `save`, `recordMilk`, `move`, `lifecycle`, `batchMove`, `batchLifecycle`; ficha Animal 360º |
| Pesagens (`weights`) | `record`; histórico, inteligência produtiva e fluxo de curral |
| Sanidade (`sanitary`) | `saveProtocol`, `record`, `batchRecord`; aplicação com produto/dose/unidade, lote/partida, princípio ativo, próxima dose, carência, baixa transacional de estoque, movimento de insumo e custo por lote; alerta de carência e bloqueio de venda durante carência ativa |
| Reprodução (`reproduction`) | `record`, `batchRecord`; serviço, diagnóstico, perda gestacional, parto e desmame; taxas de serviço, concepção, prenhez, perda gestacional, parto e desmame; painel profissional com genética, doses, estação de monta e eficiência |
| Compras e Vendas (`trades`) | `create`; venda com caso de uso atômico e fechamento por peso vivo/carcaça, rendimento, preço/@ de carcaça, bruto, descontos, frete, comissão e líquido; simulador sem persistência |
| Resultado por Lote (`finance`) | `addCost`, `fromTrade`; métricas econômicas por lote, custo/kg ganho, margem, custo/@ peso vivo, DRE produtiva, apropriação e comparativos |
| Relatórios Zootécnicos (`reports`) | `csv`, `pdf`, `issue`; relatórios operacionais e aprofundados |
| Rastreabilidade (`traceability`) | `save`, `remove`; identificação oficial e documentos |
| Estoque e Insumos (`inventory`) | `save`, `adjust`; movimentações, mínimo, lote/partida, validade e custo; recebe baixas transacionais de nutrição e sanidade |
| Pastagens e Áreas (`pastures`) | `save`, `enterLot`, `leaveLot`; histórico de ocupação, UA/ha, capacidade, descanso, kg/ha e @/ha |
| Nutrição (`nutrition`) | `save`, `consume`; consumo por lote, economia de alimentação e baixa transacional do alimento |
| Agenda de Manejo (`tasks`) | `save`, `complete`; também hospeda o modo campo offline e sincronização local segura |
| Dados e Cadastros (`data`) | `saveFarmUnit`, `saveBreed`, `saveCategory`, `saveParty`, `exportCollection`, `validateImport`, `importCollection`; fazendas, raças, categorias e contatos/partes comerciais pesquisáveis e transferíveis |
| Dispositivos e IoT (`iot`) | `saveDevice`, `removeDevice`, `testDevice`, `startDevice`, `stopDevice`, `bindRfid`, `unbindRfid`, `simulateRfid`, `simulateWeight` |
| Configurações (`settings`) | `backup`, `restore`; atualização do aplicativo, administração de usuários, perfis e auditoria são expostas pelo runtime/UI desktop |

## Totais atuais

- **17 telas navegáveis**
- **49 ações de apresentação certificadas**
- **17 métodos RPC de runtime contratados**
- IoT é opcional e não bloqueia o core
- Core local-first, sem dependência paga obrigatória

## RPCs contratados

O contrato de QA também cobre a superfície de runtime que não pertence a uma ação de tela:

`describe`, `authState`, `bootstrap`, `login`, `validate`, `logout`, `search`, `alerts`, `audit`, `insights`, `simulateSale`, `reproductionAdmin`, `userAdmin`, `fieldSync`, `references`, `load`, `action`.

### Reprodução profissional (`reproductionAdmin`)

- `state`
- `saveGenetics`
- `saveDoseStock`
- `adjustDoseStock`
- `saveBreedingSeason`
- `recordService`

A UI permite criar e editar touro/sêmen, ativar/desativar genética, criar e editar lotes de doses, ativar/desativar lotes, ajustar quantidade com motivo/data, cadastrar/editar/encerrar estação de monta e registrar serviço com número de doses e observações.

### Administração local (`userAdmin`)

- leitura de usuários, perfis e auditoria;
- criação e edição de usuário;
- ativação/desativação;
- redefinição de senha;
- matriz de permissões.

### Campo offline (`fieldSync`)

- estado e configuração do dispositivo;
- pareamento local;
- operações rápidas;
- exportação/importação de pacote local criptografado;
- controle de operações aplicadas, ignoradas e conflitantes.

## P0 de profundidade e cobertura concluído

O P0 atual fecha as principais lacunas de produto e de exposição da interface:

1. **Arroba/comercial:** peso vivo e carcaça possuem semântica separada e fechamento comercial completo.
2. **Sanidade:** aplicação integra estoque, movimento, custo e carência de forma transacional quando o produto existe no estoque.
3. **Segurança sanitária da venda:** carência ativa gera alerta e impede venda antes da gravação.
4. **Reprodução:** indicadores operacionais e gestão profissional de genética/doses/estação estão expostos, incluindo ajuste manual auditável de doses.
5. **Partes comerciais:** contatos são entidades locais de primeira classe, com busca e transferência de dados.
6. **Cobertura UI/backend:** toda a superfície de tela está representada pelo contrato de 17 telas/49 ações, e RPCs adicionais relevantes são contratados explicitamente.
7. **QA fail-closed:** a Fase 5 compara conjuntos completos de telas e ações, em vez de apenas verificar que um subconjunto antigo ainda existe.

## Observação de escopo

A superfície atual já inclui pastagens analíticas, inteligência produtiva, reprodução profissional, simulador comercial e modo campo offline inicial. Os principais aprofundamentos restantes são financeiro administrativo completo (caixa, pagar/receber e previsto x realizado), expansão do modo campo para mais manejos e especializações opcionais como confinamento, leite, genética/DEP e reprodução embrionária. Esses aprofundamentos não devem introduzir dependência paga obrigatória no core.
