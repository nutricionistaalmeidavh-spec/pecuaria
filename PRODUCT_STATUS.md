# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Versão atual do código: **1.0.1**
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas navegáveis atuais: **17**
- Ações declaradas/certificadas na apresentação: **62**
- Métodos RPC contratados: **17**
- Arquitetura: **desktop local-first**
- Dependência paga obrigatória: **nenhuma**

> Fonte de verdade funcional: `src/ui.js`, `src/presentation.js`, `runtime/backend.mjs`, `qa/product-contract.json` e `docs/FUNCTIONALITY_MATRIX.md`.
> Atualizado em 2026-09-21 para o P1 de profundidade operacional. Contagens históricas de 49 ações ou menos não representam mais a superfície atual.

## Superfície funcional atual

1. Dashboard
2. Lotes
3. Animais
4. Pesagens
5. Sanidade
6. Reprodução
7. Compras e Vendas
8. Resultado por Lote / Financeiro
9. Relatórios Zootécnicos
10. Rastreabilidade
11. Estoque e Insumos
12. Pastagens e Áreas
13. Nutrição
14. Agenda de Manejo / Campo offline
15. Dados e Cadastros
16. Dispositivos e IoT
17. Configurações

A relação exata de ações por tela e RPCs está em `docs/FUNCTIONALITY_MATRIX.md`.

## Núcleo operacional

O produto mantém:

- persistência SQLite transacional e operação local-first;
- invariantes pecuárias e rollback de operações compostas;
- RBAC e auditoria persistente;
- formulários operacionais tipados, sem editor JSON cru na UI normal;
- backup verificável com SHA-256 e safety backup;
- busca global, alertas e importação/exportação locais;
- dashboard e relatórios derivados dos dados persistidos;
- ficha Animal 360º;
- manejo individual e coletivo de movimentação, ciclo de vida, sanidade e reprodução;
- estoque e insumos com movimentações, lote/partida, validade, mínimo e custo;
- nutrição por lote com baixa transacional do alimento;
- rastreabilidade local;
- relatórios CSV/PDF e emissão persistida;
- comercial com peso vivo/carcaça e venda atômica;
- reprodução profissional;
- administração local de usuários, perfis e auditoria;
- IoT opcional para RFID/EID, balanças e conectores locais;
- campo offline criptografado, sem servidor obrigatório.

## P1 — profundidade operacional integrada

### Financeiro administrativo

O financeiro produtivo histórico permanece separado e funcional. O P1 adiciona:

- contas/caixas e categorias;
- contas a pagar e a receber;
- títulos com baixa parcial ou integral;
- liquidações imutáveis e estorno explícito;
- saldo derivado por conta;
- realizado e projeções de 7/30/90 dias;
- importação local de extrato CSV com idempotência;
- conciliação manual com baixa existente ou ajuste explícito/auditável;
- leitura local de XML/NF-e como proposta de lançamento.

O sistema **não transmite documento fiscal**, não consulta SEFAZ e não depende de Open Finance, Pluggy, banco ou serviço externo para operar.

### Pastagens e condição corporal

O módulo de pastagens agora cobre:

- mapa esquemático local, sem GIS/cloud obrigatório;
- capacidade, ocupação, UA/ha, descanso e produtividade por área;
- status disponível, ocupado, descanso e indisponível;
- avaliações com escore, altura, massa de forragem, cobertura e fotos locais;
- planejamento de rotação por lote e período;
- planejado x realizado;
- metas de descanso, ocupação e altura;
- escore corporal do animal pela ação canônica `animals.recordBodyCondition`.

Ausência de observação permanece ausência de dado, e não é convertida artificialmente em zero.

### Campo/mobile offline ampliado

O modo campo continua dentro do mesmo produto e usa pacotes locais criptografados com AES-GCM. O fluxo possui expiração, recibos, replay idempotente, detecção de conflito e proteção de snapshot.

Operações rápidas incluem:

- conclusão de tarefa e pesagem;
- movimentação individual e coletiva;
- sanidade individual e coletiva;
- reprodução individual e coletiva;
- nascimento, desmame e morte;
- vínculo RFID/EID;
- rastreabilidade;
- entrada e saída de lote em pastagem;
- escore corporal;
- avaliação de pastagem.

O Animal 360º offline reúne identificação, lote, peso, escore, eventos, rastreabilidade, tarefas e histórico essencial.

O caminho offline não é privilegiado: a operação é normalizada para uma ação conhecida e o backend revalida a permissão da ação de destino. `iot:bind` permite vínculo RFID sem conceder administração de dispositivos ao operador de campo.

### Compatibilidade

O P1 é aditivo:

- banco com formato P0 abre sem backfill destrutivo;
- coleções novas ausentes são tratadas como vazias;
- pasto legado com status `active` é interpretado operacionalmente sem ser regravado apenas por leitura;
- backup/restore continua válido;
- `FIELD_SYNC_VERSION` permanece 1 porque a ampliação do pacote é compatível e aditiva.

## Reprodução profissional

O produto mantém:

- serviço, diagnóstico de gestação, perdas, parto e desmame;
- indicadores reprodutivos derivados;
- genética/touro/sêmen;
- estoque de doses, lote, validade, custo/dose e mínimo;
- ajuste manual auditável de estoque de doses;
- estação de monta;
- registro profissional de serviço;
- eficiência por protocolo, reprodutor e estação.

## Sanidade e comercial

- protocolos com intervalo, princípio ativo e carência;
- aplicação sanitária pode baixar estoque, registrar movimento e apropriar custo ao lote de forma transacional;
- estoque insuficiente rejeita a operação sem escrita parcial;
- carência ativa gera alerta e bloqueia venda;
- comercial distingue @ de peso vivo e @ de carcaça;
- fechamento suporta peso vivo, carcaça, rendimento, bruto, descontos, frete, comissão e líquido;
- simulador comercial é somente leitura.

## IoT opcional

A superfície IoT permanece opcional e sem custo recorrente obrigatório:

- RFID/EID e balança;
- serial, MQTT e HTTP;
- registry persistente e secret store local;
- simuladores para validação sem hardware;
- falha ou ausência de hardware não impede o uso normal do produto.

## Atualização via GitHub Releases

O desktop usa atualização não silenciosa:

- `autoDownload = false`;
- `autoInstallOnAppQuit = false`;
- sem downgrade automático;
- sem prerelease no canal normal;
- download e instalação exigem ação explícita do usuário;
- falha de internet não bloqueia a operação local;
- nenhum `GH_TOKEN` é embutido no executável.

## QA, contrato e segurança

A superfície pública final do P1 é **17 telas / 62 ações / 17 RPCs**.

A cadeia possui:

- testes Node unitários e integrados;
- boundary/import checks;
- build web;
- Playwright E2E;
- QA de superfície fail-closed;
- API Contracts com baseline SHA-256;
- Security Gate fail-closed;
- Product QA;
- compatibilidade de banco P0;
- regressão IoT P0/P1;
- release validator e certificação existentes.

A suíte P1 verifica, entre outros pontos, execução real das 62 ações, transações, idempotência de import/sync, RBAC do destino no campo offline, compatibilidade de dados legados e paridade backend→UI.

## Limites de posicionamento

O foco atual é **gestão profissional de pecuária bovina generalista, especialmente corte, cria, recria e engorda**.

Não apresentar a versão atual como:

- ERP contábil completo;
- gestão leiteira completa;
- confinamento especializado completo;
- plataforma completa de genética/DEP;
- sistema especializado completo de FIV/TE/IATF;
- emissor fiscal completo;
- integração oficial SISBOV completa.

## Próximos aprofundamentos opcionais

1. nutrição avançada para operações que necessitem matéria seca, composição, conversão e manejo de cocho;
2. conectores fiscais/bancários/externos opcionais, sem tornar terceiros dependência do core;
3. especializações de confinamento, leite ou genética apenas quando houver decisão explícita de produto.

## Regra arquitetural/comercial

O **core obrigatório deve continuar R$ 0 de infraestrutura recorrente, local/self-hosted e baseado em componentes open source**. Serviços pagos, nuvem, APIs comerciais ou integrações externas podem existir apenas como opções explícitas e nunca como dependência silenciosa do funcionamento principal.

**Estado:** P0 de profundidade, P1 de profundidade operacional, IoT P0/P1, reporting/dashboard, reprodução profissional, administração local, campo offline ampliado, updater e gates de engenharia estão integrados na branch de P1 e em fase de certificação final antes do merge em `main`.
