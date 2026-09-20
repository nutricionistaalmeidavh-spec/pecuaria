# Functionality matrix — ArtiSys Pecuária

> Fonte de verdade: `src/ui.js` e `src/presentation.js`.
> Atualizado em 2026-09-20 para refletir a superfície realmente implementada na versão 1.0.1 e o P0 de profundidade de mercado.

| Tela | Funcionalidades expostas |
|---|---|
| Dashboard (`overview`) | KPIs, alertas, desempenho de peso/GMD, resumo reprodutivo, indicadores reprodutivos derivados, sanidade, distribuição por lote, financeiro e atividade recente |
| Lotes (`lots`) | `save`, `remove` |
| Animais (`animals`) | `save`, `recordMilk`, `move`, `lifecycle`, `batchMove`, `batchLifecycle`; ficha Animal 360º |
| Pesagens (`weights`) | `record`; histórico e fluxo de curral |
| Sanidade (`sanitary`) | `saveProtocol`, `record`, `batchRecord`; aplicação com produto/dose/unidade, lote/partida, princípio ativo, próxima dose, carência, baixa transacional de estoque, movimento de insumo e custo por lote; alerta de carência e bloqueio de venda durante carência ativa |
| Reprodução (`reproduction`) | `record`, `batchRecord`; serviço, diagnóstico, perda gestacional, parto e desmame; taxas de serviço, concepção, prenhez, perda gestacional, parto e desmame |
| Compras e Vendas (`trades`) | `create`; venda com caso de uso atômico e fechamento por peso vivo/carcaça, rendimento, preço/@ de carcaça, bruto, descontos, frete, comissão e líquido |
| Resultado por Lote (`finance`) | `addCost`, `fromTrade`; métricas econômicas por lote, custo/kg ganho, margem e custo/@ explicitamente identificado como peso vivo |
| Relatórios Zootécnicos (`reports`) | `csv`, `pdf`, `issue` |
| Rastreabilidade (`traceability`) | `save`, `remove`; identificação oficial e documentos |
| Estoque e Insumos (`inventory`) | `save`, `adjust`; movimentações, mínimo, lote/partida, validade e custo; recebe baixas transacionais de nutrição e sanidade |
| Pastagens e Áreas (`pastures`) | `save`, `enterLot`, `leaveLot`; histórico de ocupação |
| Nutrição (`nutrition`) | `save`, `consume`; consumo por lote, economia de alimentação e baixa transacional do alimento |
| Agenda de Manejo (`tasks`) | `save`, `complete` |
| Dados e Cadastros (`data`) | `saveFarmUnit`, `saveBreed`, `saveCategory`, `saveParty`, `exportCollection`, `validateImport`, `importCollection`; fazendas, raças, categorias e contatos/partes comerciais pesquisáveis e transferíveis |
| Dispositivos e IoT (`iot`) | `saveDevice`, `removeDevice`, `testDevice`, `startDevice`, `stopDevice`, `bindRfid`, `unbindRfid`, `simulateRfid`, `simulateWeight` |
| Configurações (`settings`) | `backup`, `restore`; atualização do aplicativo é exposta pelo runtime desktop |

## Totais atuais

- **17 telas navegáveis**
- **49 ações declaradas na apresentação**
- IoT é opcional e não bloqueia o core
- Core local-first, sem dependência paga obrigatória

## P0 de profundidade concluído

Sem criar novas telas, o P0 aprofundou cinco lacunas prioritárias:

1. **Arroba/comercial:** peso vivo e carcaça deixaram de compartilhar semântica ambígua; fechamento comercial de carcaça ficou visível na UI.
2. **Sanidade:** aplicação passou a integrar estoque, movimento, custo e carência de forma transacional quando o produto existe no estoque.
3. **Segurança sanitária da venda:** carência ativa gera alerta e impede venda antes da gravação.
4. **Reprodução:** eventos agora alimentam indicadores de manejo visíveis ao usuário.
5. **Partes comerciais:** contatos passaram a ser entidades locais de primeira classe, com busca e transferência de dados.

## Observação de escopo

Esta matriz descreve o que existe hoje. Os principais aprofundamentos restantes são pastagens/lotação, operação offline de campo/mobile, inteligência produtiva, reprodução avançada e simulador comercial. Gestão leiteira completa, confinamento especializado e genética avançada continuam fora do escopo funcional completo atual.
