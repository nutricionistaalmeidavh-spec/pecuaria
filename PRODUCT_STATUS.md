# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Versão atual do código: **1.0.1**
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas navegáveis atuais: **17**
- Ações declaradas/certificadas na apresentação: **49**
- Métodos RPC contratados: **17**
- Arquitetura: **desktop local-first**
- Dependência paga obrigatória: **nenhuma**

> Fonte de verdade funcional: `src/ui.js`, `src/presentation.js`, `runtime/backend.mjs`, `qa/product-contract.json` e `docs/FUNCTIONALITY_MATRIX.md`.
> Atualizado em 2026-09-20. Contagens históricas de 10/11 telas e 16/25 ações não representam mais a superfície atual.

## Superfície funcional atual

1. Dashboard
2. Lotes
3. Animais
4. Pesagens
5. Sanidade
6. Reprodução
7. Compras e Vendas
8. Resultado por Lote
9. Relatórios Zootécnicos
10. Rastreabilidade
11. Estoque e Insumos
12. Pastagens e Áreas
13. Nutrição
14. Agenda de Manejo
15. Dados e Cadastros
16. Dispositivos e IoT
17. Configurações

A relação completa de ações por tela e RPCs está em `docs/FUNCTIONALITY_MATRIX.md`.

## Produto

O núcleo mantém:

- persistência transacional;
- invariantes pecuárias;
- RBAC e auditoria persistente;
- venda atômica com rollback;
- formulários operacionais tipados;
- backup verificável com SHA-256 e safety backup;
- busca global, alertas e importação/exportação locais;
- reporting e dashboard derivados da fonte persistida;
- ficha Animal 360º com timeline de pesagens, movimentações, ciclo de vida, sanidade, reprodução, negociações, rastreabilidade e tarefas;
- manejo coletivo de movimentação, ciclo de vida, sanidade e reprodução;
- estoque com movimentações, lote, validade, mínimo e custo;
- nutrição por lote com cálculo de consumo e baixa transacional do alimento;
- pastagens/áreas com capacidade, UA/ha, ocupação, descanso e produtividade por área;
- rastreabilidade com identificação oficial/documentos;
- relatórios CSV/PDF e emissão persistida;
- resultado econômico por lote, DRE produtiva, apropriação e comparativos;
- simulador comercial sem persistência;
- reprodução profissional com genética, sêmen, estoque de doses, estação de monta e eficiência;
- administração local de usuários/perfis e auditoria;
- modo campo offline com sincronização local criptografada.

## P0 de profundidade de mercado — concluído

O P0 aprofunda módulos existentes sem ampliar o menu e sem introduzir dependência paga.

### Economia de arroba e fechamento comercial

- separação explícita entre **arroba de peso vivo** e **arroba de carcaça**;
- cálculo de peso vivo, @ de peso vivo, peso de carcaça, rendimento de carcaça e @ de carcaça;
- venda pode calcular o fechamento por preço/@ de carcaça;
- valor bruto, descontos, frete, comissão e valor líquido ficam persistidos no fechamento;
- a tela de Compras e Vendas expõe os dados de carcaça;
- simulador de cenário calcula o fechamento sem criar venda nem alterar estoque/rebanho;
- o indicador econômico legado continua compatível, mas a interface identifica claramente `Custo/@ peso vivo`.

### Sanidade integrada à operação

- protocolo sanitário suporta intervalo, princípio ativo e carência;
- aplicação resolve produto, dose, unidade, lote/partida e custo;
- quando o insumo está cadastrado, a aplicação faz **baixa transacional de estoque**, registra movimento e apropria custo ao lote do animal;
- estoque insuficiente rejeita a operação sem escrita parcial;
- período de carência fica registrado no evento e aparece na central de alertas;
- venda de animal com carência sanitária ativa é bloqueada antes de qualquer gravação;
- registros antigos continuam aceitos quando ainda não existe item correspondente no estoque.

### Reprodução profissional

Além dos eventos de serviço, diagnóstico, perda gestacional, parto e desmame, o produto mantém:

- taxas de serviço, concepção, prenhez, perda, parto e desmame;
- intervalo entre partos e dias em aberto;
- cadastro e edição de touros/sêmen;
- ativação/desativação de genética;
- estoque de doses com lote, validade, custo/dose e mínimo;
- edição e ativação/desativação de lotes de doses;
- ajuste manual auditável de quantidade com motivo e data;
- estação de monta com meta de concepção e status planejada/ativa/encerrada;
- registro profissional de serviço com método, protocolo, genética, lote de doses, quantidade utilizada, previsão de parto e observações;
- eficiência por protocolo, reprodutor e estação.

### Contatos e partes comerciais

- cliente, fornecedor, frigorífico e demais partes podem ser cadastrados como entidades locais de catálogo;
- contatos suportam papéis, documento, telefone, e-mail e observações;
- contatos participam da busca global e dos fluxos de exportação/importação;
- negociações continuam usando `partyId`, com cadastro de parte correspondente disponível ao usuário.

### Campo/mobile offline

O modo campo atual é local-first e não depende de nuvem:

- fila de manejo;
- conclusão rápida de tarefas;
- pesagem com teclado de toque;
- movimentação de animal entre lotes;
- aplicação sanitária rápida;
- pareamento base/campo;
- exportação/importação de pacote local criptografado;
- fila pendente e detecção de conflitos.

### Administração local

- criação e edição de usuários;
- ativação/desativação;
- redefinição de senha;
- perfis e matriz de permissões;
- auditoria local das operações.

## Alertas operacionais

A central de alertas cobre atualmente:

- manejo sanitário vencido ou próximo;
- **carência sanitária ativa**;
- animal ativo com pesagem desatualizada;
- estoque abaixo do mínimo;
- insumo próximo da validade ou vencido;
- estoque de doses reprodutivas no mínimo ou próximo da validade;
- tarefa de manejo atrasada;
- previsão de parto próxima, quando informada;
- backup ausente/desatualizado.

## IoT opcional

A superfície IoT permanece opcional e sem custo recorrente obrigatório:

- tela **Dispositivos e IoT**;
- RFID/EID e balança;
- conectores serial, MQTT e HTTP;
- registry persistente e secret store local;
- simuladores para validação sem hardware;
- falha/ausência de hardware não impede o uso normal do produto.

## Atualização via GitHub Releases

O desktop usa atualização não silenciosa:

- consulta o canal GitHub Releases;
- `autoDownload = false`;
- `autoInstallOnAppQuit = false`;
- sem downgrade automático;
- sem prerelease no canal normal;
- **Baixar atualização** exige ação do usuário;
- **Instalar e reiniciar** exige nova ação explícita;
- **Verificar atualizações** disponível em Configurações;
- falha de internet não bloqueia a operação local;
- nenhum `GH_TOKEN` é embutido no executável.

## QA, certificação e release

A cadeia possui:

- testes Node;
- boundary/import checks;
- build web;
- Playwright;
- QA de superfície;
- API Contracts com baseline SHA-256;
- Security Gate fail-closed;
- Product QA;
- Phase 7 data cutover;
- Release Validator;
- Phase 8 certification;
- build Windows NSIS;
- evidências de release com SHA-256.

O contrato principal agora representa **17 telas, 49 ações e 17 métodos RPC**. A Fase 5 compara conjuntos completos de navegação, telas e ações com o contrato, para bloquear tanto funcionalidades ausentes quanto deriva por funcionalidades novas não certificadas.

Security em release bloqueia findings `MEDIUM`, `HIGH`, `CRITICAL` e desconhecidos.

### Fase 7 sem banco de cliente

Como o produto ainda não possui base legada de cliente em produção, `npm run phase7` usa por padrão uma fixture SQLite versionada em `qa/fixtures/legacy-fixture.sql`.

`ARTISYS_LEGACY_DB` permanece disponível como homologação adicional quando existir uma base real anterior.

## Woodpecker

O Woodpecker é opcional e manual. Não é requisito funcional do produto.

## Profundidade funcional — próximos aprofundamentos

Os aprofundamentos que antes estavam planejados para pastagens, inteligência produtiva, reprodução profissional, simulador comercial e campo offline inicial já estão presentes. As próximas prioridades passam a ser:

1. **Financeiro administrativo:** caixa, contas a pagar/receber, previsto x realizado e conciliação local.
2. **Campo/mobile ampliado:** reprodução, nascimento/desmame/baixa, RFID, rastreabilidade, manejo coletivo, pastagem e consulta Animal 360º offline.
3. **Pastagem visual:** mapa/piquetes, escores configuráveis, fotos e planejamento visual de rotação.
4. **Nutrição avançada opcional:** matéria seca, composição, conversão e manejo de cocho para operações que exigirem maior especialização.
5. **Integrações fiscais/externas opcionais:** importação de XML/NF-e ou integrações oficiais sem tornar serviços externos dependência do core.

### Escopos especializados

- O suporte atual a leite é básico (registro de produção) e **não deve ser apresentado como gestão leiteira completa**.
- Confinamento, genética/DEP e reprodução embrionária avançada não constituem módulos especializados completos na versão atual.
- O foco funcional mais aderente hoje é pecuária bovina generalista, especialmente corte/cria/recria/engorda.

## Regra arquitetural/comercial

O **core obrigatório deve continuar R$ 0 de infraestrutura recorrente, local/self-hosted e baseado em componentes open source**. Serviços pagos, nuvem, APIs comerciais ou integrações externas podem existir apenas como opções explícitas e nunca como dependência silenciosa do funcionamento principal.

**Estado:** profundidade P0, IoT P0/P1, reporting/dashboard, reprodução profissional, administração local, campo offline inicial, updater e P2 de engenharia estão integrados na superfície atual. A próxima evolução deve priorizar profundidade operacional e decisão, sem ampliar o menu por ampliar.
