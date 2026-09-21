# Functionality matrix — ArtiSys Pecuária

> Fonte de verdade funcional: `src/ui.js`, `src/presentation.js`, `runtime/backend.mjs` e `qa/product-contract.json`.
> Atualizado em 2026-09-21 para refletir o P1 de profundidade operacional integrado ao core local-first.

| Tela | Funcionalidades expostas |
|---|---|
| Dashboard (`overview`) | KPIs, alertas, desempenho de peso/GMD, resumo reprodutivo, sanidade, distribuição por lote, financeiro e atividade recente |
| Lotes (`lots`) | `save`, `remove` |
| Animais (`animals`) | `save`, `recordMilk`, `move`, `lifecycle`, `batchMove`, `batchLifecycle`, `recordBodyCondition`, `registerBirth`; ficha Animal 360º |
| Pesagens (`weights`) | `record`; histórico, inteligência produtiva e fluxo de curral |
| Sanidade (`sanitary`) | `saveProtocol`, `record`, `batchRecord`; produto/dose/unidade, lote/partida, princípio ativo, próxima dose, carência, baixa transacional de estoque, movimento de insumo e custo por lote; alerta de carência e bloqueio de venda durante carência ativa |
| Reprodução (`reproduction`) | `record`, `batchRecord`; serviço, diagnóstico, perda gestacional, parto e desmame; indicadores derivados; painel profissional com genética, doses, estação de monta e eficiência |
| Compras e Vendas (`trades`) | `create`; venda atômica e fechamento por peso vivo/carcaça, rendimento, preço/@ de carcaça, bruto, descontos, frete, comissão e líquido; simulador sem persistência |
| Resultado por Lote / Financeiro (`finance`) | `addCost`, `fromTrade`, `saveAccount`, `saveCategory`, `saveTitle`, `cancelTitle`, `settleTitle`, `reverseSettlement`, `importStatement`, `reconcileStatement`, `importInvoiceXml`; DRE produtiva e financeiro administrativo local |
| Relatórios Zootécnicos (`reports`) | `csv`, `pdf`, `issue`; relatórios operacionais e aprofundados |
| Rastreabilidade (`traceability`) | `save`, `remove`; identificação oficial e documentos |
| Estoque e Insumos (`inventory`) | `save`, `adjust`; movimentações, mínimo, lote/partida, validade e custo; baixas transacionais de nutrição e sanidade |
| Pastagens e Áreas (`pastures`) | `save`, `enterLot`, `leaveLot`, `recordAssessment`, `saveRotationPlan`; mapa esquemático local, histórico de ocupação, UA/ha, capacidade, descanso, kg/ha, @/ha, avaliações e rotação planejada x realizada |
| Nutrição (`nutrition`) | `save`, `consume`; consumo por lote, economia de alimentação e baixa transacional do alimento |
| Agenda de Manejo (`tasks`) | `save`, `complete`; também hospeda o modo campo offline, Animal 360º offline e sincronização local segura |
| Dados e Cadastros (`data`) | `saveFarmUnit`, `saveBreed`, `saveCategory`, `saveParty`, `exportCollection`, `validateImport`, `importCollection`; fazendas, raças, categorias e contatos/partes comerciais pesquisáveis e transferíveis |
| Dispositivos e IoT (`iot`) | `saveDevice`, `removeDevice`, `testDevice`, `startDevice`, `stopDevice`, `bindRfid`, `unbindRfid`, `simulateRfid`, `simulateWeight` |
| Configurações (`settings`) | `backup`, `restore`; atualização do aplicativo, administração de usuários, perfis e auditoria são expostas pelo runtime/UI desktop |

## Totais atuais

- **17 telas navegáveis**
- **62 ações de apresentação certificadas**
- **17 métodos RPC de runtime contratados**
- IoT permanece opcional e não bloqueia o core
- Core local-first, sem dependência paga obrigatória

## RPCs contratados

`describe`, `authState`, `bootstrap`, `login`, `validate`, `logout`, `search`, `alerts`, `audit`, `insights`, `simulateSale`, `reproductionAdmin`, `userAdmin`, `fieldSync`, `references`, `load`, `action`.

### Financeiro administrativo local

O financeiro produtivo existente (`cattle.finance`) foi preservado. O P1 adiciona um subsistema administrativo separado para:

- contas/caixas e categorias;
- contas a pagar e a receber;
- títulos com situação derivada por liquidações imutáveis;
- baixa parcial ou integral;
- estorno explícito que reabre saldo quando aplicável;
- visão de realizado e projeções de 7/30/90 dias;
- saldo derivado por conta, sem saldo inicial editável silencioso;
- importação local de extrato CSV com identificador estável e idempotência;
- conciliação manual com baixa existente ou ajuste explícito/auditável;
- leitura local de XML/NF-e como **sugestão**, sem criar título automaticamente.

Não há transmissão fiscal, consulta SEFAZ, Open Finance, Pluggy ou API bancária obrigatória. CSV e XML são processados localmente.

### Pastagens e condição corporal

O P1 aprofunda o manejo visual e mensurável sem usar mapas remotos:

- identificação visual e polígono esquemático em coordenadas locais 0–100;
- estados disponível, ocupado, descanso e indisponível;
- meta de descanso, ocupação e altura;
- avaliações de pastagem com escore, altura, massa de forragem, cobertura, fotos locais e observações;
- planejamento de rotação por lote e período;
- comparação planejado x realizado;
- indicadores de lotação, capacidade, ocupação, descanso, kg/ha e @/ha;
- escore corporal registrado pela ação canônica `animals.recordBodyCondition` e consumido pelas visões de manejo/pastagem.

Ausência de observação é representada como ausência de dado, não como zero inventado.

### Campo offline (`fieldSync`)

O modo campo continua no mesmo produto e não depende de uma segunda aplicação ou servidor externo. O pacote local usa criptografia AES-GCM e controle de expiração, recibos, idempotência e conflitos.

Operações rápidas suportadas incluem:

- tarefa concluída e pesagem;
- movimentação individual/coletiva;
- reprodução individual/coletiva;
- nascimento, desmame e morte;
- sanidade individual/coletiva;
- vínculo RFID/EID com permissão granular;
- rastreabilidade;
- entrada/saída de lote em pastagem;
- escore corporal e avaliação de pastagem.

O snapshot local inclui animais, lotes, tarefas, eventos, rastreabilidade, inventário, protocolos sanitários, pastagens/ocupação, dados reprodutivos, condição corporal, avaliações e rotação. O Animal 360º offline reúne identificação, lote, peso, escore, eventos, rastreabilidade, tarefas e histórico essencial.

O `fieldSync` não aceita comando arbitrário `{screenId, action}`. Toda operação é normalizada para uma ação conhecida e passa novamente pela autorização da ação de destino.

### Reprodução profissional (`reproductionAdmin`)

- `state`
- `saveGenetics`
- `saveDoseStock`
- `adjustDoseStock`
- `saveBreedingSeason`
- `recordService`

A UI permite criar/editar touro ou sêmen, ativar/desativar genética, gerenciar lotes de doses, ajustar estoque com motivo/data, cadastrar/editar/encerrar estação de monta e registrar serviço com doses e observações.

### Administração local (`userAdmin`)

- leitura de usuários, perfis e auditoria;
- criação e edição de usuário;
- ativação/desativação;
- redefinição de senha;
- matriz de permissões.

## Cobertura UI/backend e QA

A superfície pública é fechada por contrato. A Fase 5 compara conjuntos completos de telas, ações e RPCs; não basta manter um subconjunto histórico.

O P1 também possui cobertura para:

1. execução funcional das 62 ações contratadas;
2. compatibilidade com banco P0 sem backfill destrutivo;
3. formulários tipados, sem editor JSON cru na UI normal;
4. RBAC por destino também no caminho offline;
5. idempotência/replay de sync;
6. transações de nascimento, sanidade e finanças;
7. E2E de financeiro, pastagens, animal e modo campo;
8. baseline SHA-256 do contrato de API.

## Observação de escopo

O produto é uma gestão profissional de pecuária bovina generalista, especialmente **corte, cria, recria e engorda**. A superfície atual não deve ser apresentada como ERP contábil completo, gestão leiteira completa, confinamento especializado, plataforma completa de genética/DEP, FIV/TE/IATF especializada, sistema fiscal emissor ou integração oficial SISBOV completa.

Integrações fiscais, bancárias, cloud ou serviços pagos podem ser oferecidos futuramente apenas como conectores opcionais. O funcionamento obrigatório do core deve permanecer local/self-hosted e sem custo recorrente de infraestrutura.
