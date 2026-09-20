# Functionality matrix — ArtiSys Pecuária

> Fonte de verdade: `src/ui.js` e `src/presentation.js`.
> Atualizado em 2026-09-20 para refletir a superfície realmente implementada na versão 1.0.1.

| Tela | Funcionalidades expostas |
|---|---|
| Dashboard (`overview`) | KPIs, alertas, desempenho de peso/GMD, reprodução, sanidade, distribuição por lote, financeiro e atividade recente |
| Lotes (`lots`) | `save`, `remove` |
| Animais (`animals`) | `save`, `recordMilk`, `move`, `lifecycle`, `batchMove`, `batchLifecycle`; ficha Animal 360º |
| Pesagens (`weights`) | `record`; histórico e fluxo de curral |
| Sanidade (`sanitary`) | `saveProtocol`, `record`, `batchRecord` |
| Reprodução (`reproduction`) | `record`, `batchRecord` |
| Compras e Vendas (`trades`) | `create`; venda com caso de uso atômico |
| Resultado por Lote (`finance`) | `addCost`, `fromTrade`; métricas econômicas por lote |
| Relatórios Zootécnicos (`reports`) | `csv`, `pdf`, `issue` |
| Rastreabilidade (`traceability`) | `save`, `remove`; identificação oficial e documentos |
| Estoque e Insumos (`inventory`) | `save`, `adjust`; movimentações, mínimo, lote, validade e custo |
| Pastagens e Áreas (`pastures`) | `save`, `enterLot`, `leaveLot`; histórico de ocupação |
| Nutrição (`nutrition`) | `save`, `consume`; consumo por lote e baixa transacional de alimento |
| Agenda de Manejo (`tasks`) | `save`, `complete` |
| Dados e Cadastros (`data`) | `saveFarmUnit`, `saveBreed`, `saveCategory`, `exportCollection`, `validateImport`, `importCollection` |
| Dispositivos e IoT (`iot`) | `saveDevice`, `removeDevice`, `testDevice`, `startDevice`, `stopDevice`, `bindRfid`, `unbindRfid`, `simulateRfid`, `simulateWeight` |
| Configurações (`settings`) | `backup`, `restore`; atualização do aplicativo é exposta pelo runtime desktop |

## Totais atuais

- **17 telas navegáveis**
- **49 ações declaradas na apresentação**
- IoT é opcional e não bloqueia o core
- Core local-first, sem dependência paga obrigatória

## Observação de escopo

Esta matriz descreve o que existe hoje. Não implica que todos os domínios tenham a mesma profundidade. Reprodução, sanidade, pastagens, financeiro/comercial e operação móvel/campo permanecem áreas de aprofundamento planejado.
