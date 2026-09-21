# ArtiSys Pecuária — P1 Operational Depth Design

Data: 2026-09-20
Branch: `p1-operational-depth`
Base: `main` após o P0 de cobertura UI/backend (`1102af5`)

## 1. Objetivo

O P1 aprofunda três áreas já existentes sem criar uma segunda aplicação nem introduzir dependências recorrentes: modo campo/offline, financeiro administrativo e manejo de pastagens. O produto permanece desktop local-first, self-hosted, com SQLite local e sem serviço pago obrigatório.

O P1 deve transformar funcionalidades hoje parciais em fluxos operacionais completos para uma propriedade de pecuária bovina generalista, especialmente corte/cria/recria/engorda, preservando os contratos e invariantes já certificados no P0.

## 2. Restrições permanentes

1. O core obrigatório continua R$ 0/mês de infraestrutura.
2. Nenhuma funcionalidade deste P1 depende de nuvem, API paga ou conta de terceiro.
3. A persistência primária continua local no produto.
4. Integrações externas futuras são opcionais e não podem bloquear o uso normal.
5. Toda operação nova de backend destinada ao usuário precisa de superfície de UI.
6. Toda ação/tela/RPC nova deve entrar no contrato de QA.
7. O modo campo continua usando sincronização local por arquivo criptografado AES-GCM.
8. Importações externas são tratadas como arquivos locais; não será criado cliente fiscal online neste P1.
9. Não transformar este P1 em contabilidade completa, gestão leiteira, confinamento especializado ou plataforma de genética.
10. O P1 não adicionará nova tela principal ao menu: financeiro permanece em `finance`, pastagens em `pastures` e campo em `tasks`.

## 3. Arquitetura geral

O P1 evolui os módulos existentes e adiciona serviços de domínio pequenos, sem criar `v2` paralelos.

Fluxo de escrita normal:

`UI React -> runtime/backend.mjs -> presentation/action ou RPC específico -> serviço de domínio -> persistence transaction -> SQLite`

Fluxo de campo:

`FieldMobileWorkspace -> fieldSync.quick -> normalizeQuick -> action autenticada -> persistência local + queue -> exportBundle AES-GCM -> importBundle na base -> idempotência/receipts -> ação de apresentação -> SQLite`

Fluxo financeiro:

`Finance UI -> ações financeiras administrativas -> FinanceAdminService -> títulos/baixas/conciliações -> projeções derivadas -> SQLite`

Fluxo de pastagem:

`Pastures UI -> ações de cadastro/avaliação/rotação -> PastureManagementService -> ocupação + avaliação + planejamento -> indicadores derivados -> SQLite`

## 4. Campo/mobile offline

### 4.1. Escopo funcional

O modo campo atual deve manter tarefa, pesagem, movimentação e sanidade e ganhar:

- reprodução rápida;
- registro atômico de nascimento;
- desmame;
- morte/baixa;
- leitura/associação manual de RFID/EID;
- rastreabilidade rápida;
- manejo coletivo de animais;
- entrada em pastagem;
- saída de pastagem;
- escore corporal;
- escore de pastagem;
- consulta Animal 360º offline.

A interface continua orientada a uso em curral/campo: alvos grandes, poucos campos por operação, confirmação clara e nenhuma dependência de conectividade.

### 4.2. Novos quick kinds e destinos

`src/field-sync.js` passa a reconhecer quick kinds com destino explícito:

| Quick kind | Destino contratado |
|---|---|
| `reproduction.record` | `reproduction.record` |
| `animal.birth` | nova ação `animals.registerBirth` |
| `animal.weaning` | `reproduction.record` com `type=weaning` |
| `animal.death` | `animals.lifecycle` com `type=death` |
| `rfid.bind` | `iot.bindRfid` |
| `traceability.save` | `traceability.save` |
| `animal.batchMove` | `animals.batchMove` |
| `animal.batchLifecycle` | `animals.batchLifecycle` |
| `sanitary.batchRecord` | `sanitary.batchRecord` |
| `reproduction.batchRecord` | `reproduction.batchRecord` |
| `pasture.enterLot` | `pastures.enterLot` |
| `pasture.leaveLot` | `pastures.leaveLot` |
| `animal.bodyScore` | nova ação `animals.recordBodyCondition` |
| `pasture.score` | nova ação `pastures.recordAssessment` |

`animals.registerBirth` cria o bezerro e o evento de nascimento na mesma transação. O input mínimo é `id`, `tag`, `farmUnitId`, `birthDate`, `sex`, com `damId`, `sireId`, `lotId`, `breedId`, `categoryId`, `rfid` e observações opcionais. Se qualquer validação falhar, nenhum dos dois registros é persistido.

Cada quick kind é normalizado para um comando explícito `{screenId, action, input}`. Não haverá comando genérico arbitrário no pacote offline.

### 4.3. Snapshot offline

`SNAPSHOT_COLLECTIONS` passa a incluir as coleções necessárias para operar sem internet:

- `cattle.tasks`
- `cattle.animals`
- `cattle.lots`
- `cattle.sanitary-protocols`
- `cattle.inventory`
- `cattle.events`
- `cattle.traceability`
- `cattle.pastures`
- `cattle.pasture-occupancy`
- `cattle.breeding-seasons`
- `cattle.reproduction-genetics`
- `cattle.reproduction-dose-stock`
- `cattle.body-condition`
- `cattle.pasture-assessments`
- `cattle.pasture-rotation-plan`.

O snapshot continua sendo emitido apenas pela base. O aparelho de campo recebe cópia de leitura e aplica somente atualizações que não conflitam com operações locais pendentes.

Fotos de pastagem não são embutidas no pacote do P1; o snapshot leva apenas metadados e referência local. Transferência binária de fotos fica fora do escopo deste P1.

### 4.4. Animal 360º offline

A consulta offline usa apenas dados do snapshot local. Ela mostra identificação, lote, peso recente, escore corporal recente, eventos sanitários/reprodutivos recentes, rastreabilidade, tarefas pendentes e histórico essencial. Não haverá edição livre por JSON.

### 4.5. Conflitos, idempotência e segurança

- `operation.id` continua sendo a chave de idempotência.
- `RECEIPTS` impede reaplicação da mesma operação.
- Operação já recebida é `skipped`, nunca executada duas vezes.
- Snapshot não sobrescreve entidade tocada por operação local ainda não resolvida.
- Falha de operação remota gera `conflict` com erro legível; não há fallback silencioso.
- Pacote expirado, chave incorreta ou autenticação AES-GCM inválida é rejeitado antes de qualquer escrita.
- Operações coletivas devem ser determinísticas e não repetir efeitos em retry.
- `registerBirth` e demais operações multi-entidade usam transação.

## 5. Financeiro administrativo local

### 5.1. Objetivo de domínio

O financeiro atual permanece responsável por resultado econômico produtivo. O P1 acrescenta administração financeira operacional da fazenda, sem virar contabilidade fiscal completa.

### 5.2. Entidades

Novas coleções:

- `cattle.finance-accounts` — caixas/contas locais;
- `cattle.finance-titles` — títulos a pagar e a receber;
- `cattle.finance-settlements` — baixas/pagamentos/recebimentos e estornos;
- `cattle.finance-categories` — categorias administrativas;
- `cattle.finance-reconciliations` — linhas importadas e conciliações manuais;
- `cattle.finance-imports` — metadados dos arquivos importados, sem armazenar segredo externo.

Um único `finance-titles` usa `direction=payable|receivable`; não haverá coleções paralelas de contas a pagar e receber.

### 5.3. Conta a pagar/receber

Título financeiro suporta:

- id;
- descrição;
- direção (`payable` ou `receivable`);
- valor original em centavos;
- valor aberto derivado das baixas válidas;
- emissão;
- vencimento;
- status derivado (`open`, `partial`, `settled`, `cancelled`);
- categoria;
- conta/caixa opcional;
- `partyId` opcional;
- `lotId` opcional;
- `tradeId` opcional;
- documento/referência opcional;
- observações.

`openAmountMinor` e status financeiro não são campos livremente editáveis; são derivados pelo serviço.

### 5.4. Baixas e estornos

Uma baixa é imutável após criação. Correção é feita somente por estorno explícito, também imutável, referenciando a baixa original.

Invariantes:

- baixa > 0;
- soma líquida de baixas válidas não pode ultrapassar o valor original;
- baixa parcial resulta em `partial`;
- baixa total resulta em `settled`;
- título cancelado não aceita nova baixa;
- retry com o mesmo `operationId` não duplica baixa;
- estorno recompõe o aberto e mantém histórico auditável;
- baixa/estorno e atualização derivada do título ocorrem na mesma transação.

### 5.5. Ações financeiras contratadas

A tela `finance` ganha ações de apresentação explícitas:

- `saveAccount`
- `saveCategory`
- `saveTitle`
- `cancelTitle`
- `settleTitle`
- `reverseSettlement`
- `importStatement`
- `reconcileStatement`
- `importInvoiceXml`

Essas ações entram em `qa/product-contract.json`, `qa/api-contract.json`, forms tipados e E2E.

### 5.6. Caixa e fluxo de caixa

O saldo é derivado das baixas e estornos, não armazenado como número editável livremente.

A UI exibe:

- saldo por conta;
- entradas realizadas;
- saídas realizadas;
- títulos a vencer;
- títulos vencidos;
- previsão 7/30/90 dias;
- previsto x realizado;
- filtros por categoria, parte, lote e período.

### 5.7. Conciliação manual

A conciliação deste P1 é local e manual:

- importar CSV simples de extrato;
- cada linha importada recebe identidade estável baseada no arquivo + índice + conteúdo normalizado;
- usuário relaciona uma linha a uma baixa existente ou cria ajuste explícito;
- linha conciliada não pode ser conciliada novamente;
- reimportar o mesmo arquivo não duplica linhas;
- não haverá Open Finance, Pluggy ou serviço bancário obrigatório.

### 5.8. XML/NF-e opcional

O usuário seleciona um XML local. O parser extrai somente dados úteis para sugerir título/parte/valor/documento. Nenhuma transmissão para SEFAZ é feita neste P1.

A importação exige confirmação do usuário antes de criar título. Falha de parse ou cancelamento não grava título parcialmente.

## 6. Pastagens operacionais

### 6.1. Cadastro ampliado

O cadastro de pasto/piquete ganha campos opcionais:

- cor/identificador visual;
- coordenadas/polígono simples em sistema local;
- status operacional (`available`, `occupied`, `resting`, `unavailable`);
- meta de descanso;
- meta de ocupação;
- altura alvo;
- observações.

Mapa é esquemático e local. Não depende de Google Maps, Mapbox ou tile server remoto.

### 6.2. Avaliações de pastagem

Nova coleção `cattle.pasture-assessments`:

- id;
- pastureId;
- occurredAt;
- score configurável;
- heightCm opcional;
- forageMassKgHa opcional;
- groundCoverPct opcional;
- notes;
- photoPaths locais opcionais.

Os escores aceitam uma escala configurável pela propriedade, com default 1–5. A ação contratada é `pastures.recordAssessment`.

### 6.3. Escore corporal

Nova coleção `cattle.body-condition`:

- id;
- animalId;
- occurredAt;
- score;
- scaleId;
- notes.

A escala é configurável; o default do produto é 1–5. A ação contratada é `animals.recordBodyCondition`. O sistema registra o valor informado e não produz diagnóstico clínico.

### 6.4. Planejamento de rotação

Nova coleção `cattle.pasture-rotation-plan`:

- id;
- pastureId;
- lotId;
- plannedEnterAt;
- plannedLeaveAt;
- status (`planned`, `active`, `completed`, `cancelled`);
- notes.

A ação contratada é `pastures.saveRotationPlan`. A ocupação realizada permanece em `cattle.pasture-occupancy`. O sistema compara planejado x realizado em vez de sobrescrever o plano.

### 6.5. Indicadores

A tela deriva:

- UA/ha atual;
- capacidade x ocupação;
- dias em ocupação;
- dias em descanso;
- lotes acima da capacidade;
- kg/ha e @/ha quando houver dados suficientes;
- altura/forragem mais recente;
- tendência do escore;
- rotação planejada x realizada.

Ausência de dados aparece como `sem dados`, não como zero falso.

## 7. UI

### 7.1. Navegação

O P1 não adiciona telas principais ao menu:

- financeiro administrativo fica em `finance`;
- aprofundamento de pastagem fica em `pastures`;
- campo ampliado fica no workspace já exibido em `tasks`.

A densidade é resolvida com painéis internos, tabs/segmentos e drawers/modais existentes, sem aumentar as 17 telas navegáveis.

### 7.2. Finance UI

Adicionar dentro de `finance`:

- resumo de caixa;
- contas a pagar/receber;
- formulário de título;
- baixa parcial/total;
- estorno;
- previsto x realizado;
- conciliação manual;
- importação de CSV/XML local.

### 7.3. Pasture UI

Adicionar dentro de `pastures`:

- cards de status;
- mapa esquemático;
- formulário de avaliação;
- histórico de avaliações;
- planejamento de rotação;
- comparação planejado x realizado.

### 7.4. Field UI

`FieldMobileWorkspace` usa seções compactas e selecionáveis para não exibir todos os formulários simultaneamente. Os fluxos coletivos reutilizam seletores multi-animal. A consulta Animal 360º offline abre sem abandonar o modo campo.

## 8. Contratos

O P1 mantém `qa/product-contract.json` e `qa/api-contract.json` como contratos explícitos.

A superfície permanece com 17 telas principais. A contagem de ações aumenta apenas pelas ações explicitamente definidas nesta especificação. Novos RPCs só serão criados se uma operação não se encaixar de forma limpa em `action`, `fieldSync` ou serviços já expostos; a preferência é não ampliar RPCs.

A Fase 5 continua comparando igualdade de conjuntos, não apenas presença parcial.

## 9. Auditoria e RBAC

- criação/edição/cancelamento de título: permissão financeira;
- baixa/estorno: permissão financeira específica;
- conciliação: permissão financeira;
- avaliações/rotação de pastagem: permissão de manejo/pastagem;
- quick operations de campo respeitam o usuário autenticado e a permissão da ação de destino;
- todas as mutações críticas geram auditoria com actorId, entidade, ação e metadados não sensíveis.

O pacote offline não transporta senha de usuário nem token de sessão. A chave de pareamento continua sendo o segredo do canal local.

## 10. Migração e compatibilidade

Novas coleções usam a persistência genérica existente; nenhuma tabela de domínio legada deve ser destruída.

O banco anterior precisa abrir normalmente após upgrade. Dados existentes de financeiro produtivo e pastagem continuam válidos sem backfill obrigatório.

Campos novos são opcionais quando isso preservar compatibilidade. Invariantes novas se aplicam a novas operações e não tornam registros antigos ilegíveis.

## 11. Tratamento de erros

- validação ocorre antes da primeira escrita quando possível;
- operações multi-entidade usam transação;
- erro financeiro nunca deixa título parcialmente baixado;
- erro de nascimento nunca cria apenas animal ou apenas evento;
- erro de pastagem nunca fecha ocupação de forma parcial;
- erro de importação CSV/XML não gera registros parciais;
- conflito offline é registrado e apresentado ao usuário;
- nenhum erro de integração opcional impede o core local.

## 12. Testes obrigatórios

### 12.1. Unitários

- normalização de todos os quick kinds novos;
- nascimento atômico;
- cálculos de saldo/aberto/status;
- previsto x realizado;
- idempotência de baixa e conciliação;
- rotação e métricas de descanso/ocupação;
- escalas de escores;
- parsing local de CSV/XML.

### 12.2. Integração

- baixa parcial e total;
- bloqueio de overpayment;
- estorno;
- conciliação única;
- entrada/saída de pastagem;
- avaliação e rotação;
- body score;
- nascimento sem escrita parcial;
- quick operations aplicadas via backend autenticado.

### 12.3. Offline contract

Para cada quick kind novo:

1. preparar operação no campo;
2. aplicar localmente;
3. exportar pacote;
4. importar na base;
5. verificar efeito uma única vez;
6. reimportar o mesmo pacote;
7. confirmar idempotência;
8. retornar receipt;
9. importar receipt no campo;
10. confirmar `acked`.

Também testar pacote adulterado, expirado, chave errada e conflito de snapshot.

### 12.4. E2E

Playwright cobre pelo menos:

- criar título -> baixar parcialmente -> quitar;
- estornar baixa;
- previsão financeira;
- importar arquivo local válido e rejeitar inválido;
- cadastrar avaliação de pasto;
- planejar rotação e registrar realizado;
- executar quick reproduction/nascimento/baixa/pasture no modo campo;
- abrir Animal 360º offline;
- navegar por todas as ações contratadas.

### 12.5. Gates

Antes de merge:

- import boundary;
- Node unit/integration;
- web build;
- Browser E2E;
- Phase 5;
- API contract gate;
- Security gate;
- Product QA gate.

## 13. Sequência de implementação

1. Escrever testes de domínio e contratos que inicialmente falhem.
2. Criar serviços/entidades financeiras administrativas.
3. Expor ações e UI financeira.
4. Expandir `field-sync` e seus snapshots/quick kinds.
5. Expandir o `FieldMobileWorkspace`.
6. Criar avaliações/rotação/escores de pastagem e nascimento atômico.
7. Expor UI de pastagens e novos fluxos de animais.
8. Atualizar contratos e baseline para a superfície definida.
9. Atualizar matriz funcional/status do produto.
10. Rodar QA completo e corrigir regressões antes de merge.

## 14. Critérios de aceite

O P1 é aceito quando:

- os três blocos funcionam sem internet e sem serviço pago;
- nenhuma mutação financeira duplica efeito em retry;
- nenhuma operação offline é aplicada duas vezes;
- nascimento nunca produz registro parcial;
- Animal 360º pode ser consultado no snapshot de campo;
- financeiro mostra aberto, realizado e previsto coerentes com os lançamentos;
- pastagem mostra ocupação, descanso, avaliações e planejamento sem confundir ausência de dados com zero;
- toda nova operação de usuário tem UI;
- contratos refletem a superfície real;
- todos os gates obrigatórios passam no commit candidato a merge.

## 15. Fora de escopo deste P1

- Open Finance/Pluggy obrigatório;
- conciliação bancária automática online;
- emissão/transmissão fiscal;
- contabilidade completa;
- folha de pagamento;
- mapa online com tiles externos obrigatórios;
- transferência binária de fotos no pacote offline;
- telemetria cloud obrigatória;
- manejo leiteiro completo;
- confinamento especializado;
- DEP, acasalamento genético avançado, FIV/TE completa.
