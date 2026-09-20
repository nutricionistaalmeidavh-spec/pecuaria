# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Versão atual do código: **1.0.1**
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas navegáveis atuais: **17**
- Ações declaradas na apresentação: **49**
- Arquitetura: **desktop local-first**
- Dependência paga obrigatória: **nenhuma**

> Fonte de verdade funcional: `src/ui.js`, `src/presentation.js` e `docs/FUNCTIONALITY_MATRIX.md`.
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

A relação completa de ações por tela está em `docs/FUNCTIONALITY_MATRIX.md`.

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
- pastagens/áreas com capacidade e histórico de ocupação;
- rastreabilidade com identificação oficial/documentos;
- relatórios CSV/PDF e emissão persistida;
- resultado econômico por lote.

## Alertas operacionais

A central de alertas cobre atualmente:

- manejo sanitário vencido ou próximo;
- animal ativo com pesagem desatualizada;
- estoque abaixo do mínimo;
- insumo próximo da validade ou vencido;
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

Security em release bloqueia findings `MEDIUM`, `HIGH`, `CRITICAL` e desconhecidos.

### Fase 7 sem banco de cliente

Como o produto ainda não possui base legada de cliente em produção, `npm run phase7` usa por padrão uma fixture SQLite versionada em `qa/fixtures/legacy-fixture.sql`.

`ARTISYS_LEGACY_DB` permanece disponível como homologação adicional quando existir uma base real anterior.

## Woodpecker

O Woodpecker é opcional e manual. Não é requisito para QA, build, certificação ou publicação normal.

## Profundidade funcional — estado conhecido

A amplitude atual é alta, mas alguns domínios ainda precisam ser aprofundados antes de serem apresentados como equivalentes a soluções pecuárias especializadas.

### Pontos fortes atuais

- cadastro e histórico individual;
- ficha Animal 360º;
- lotes e manejo coletivo;
- pesagens e GMD;
- alertas;
- estoque;
- nutrição integrada ao estoque;
- rastreabilidade;
- operação local-first;
- auditoria, segurança, backup e QA;
- IoT opcional.

### Aprofundamentos prioritários

1. **Economia de arroba:** o indicador atual baseado em peso vivo deve ser explicitamente separado de arroba de carcaça. Introduzir peso de carcaça, rendimento, @ de carcaça e fechamento de abate antes de tratar custo/@ como indicador comercial de abate.
2. **Sanidade:** integrar aplicação sanitária ao consumo/baixa de estoque, custo, lote/partida do produto e carência.
3. **Reprodução:** derivar indicadores como prenhez, concepção, serviço, desmame, intervalo entre partos, perdas e desempenho por reprodutor/protocolo.
4. **Comercial/financeiro:** aprofundar cliente/fornecedor, preço/@, descontos, frete, comissão, valor líquido e resultado da negociação.
5. **Pastagens:** aprofundar UA/ha, lotação realizada x capacidade, dias de ocupação/descanso e desempenho por área.
6. **Campo/mobile:** criar operação offline de curral/campo sem tornar nuvem ou serviço pago uma dependência do core.

### Escopos especializados

- O suporte atual a leite é básico (registro de produção) e **não deve ser apresentado como gestão leiteira completa**.
- Confinamento e genética avançada não constituem módulos especializados completos na versão atual.
- O foco funcional mais aderente hoje é pecuária bovina generalista, especialmente corte/cria/recria/engorda.

## Regra arquitetural/comercial

O **core obrigatório deve continuar R$ 0 de infraestrutura recorrente, local/self-hosted e baseado em componentes open source**. Serviços pagos, nuvem, APIs comerciais ou integrações externas podem existir apenas como opções explícitas e nunca como dependência silenciosa do funcionamento principal.

**Estado:** P0/P1, IoT P0/P1, reporting/dashboard, updater e P2 de engenharia estão integrados. A próxima evolução deve priorizar profundidade dos módulos existentes em vez de ampliar o menu.
