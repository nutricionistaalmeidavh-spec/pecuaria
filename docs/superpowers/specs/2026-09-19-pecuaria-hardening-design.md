# ArtiSys Pecuária — Design de Hardening e Evolução

Data: 2026-09-19
Branch base: `integration/agrofrota-artisys-release`
Branch de trabalho: `hardening/pecuaria-p0-p2`

## Objetivo

Tornar o ArtiSys Pecuária robusto para uso real e promoção futura para `main`, preservando o produto atual, o funcionamento local-first e a ausência de dependência paga obrigatória.

O trabalho não transforma o sistema em outro produto. O escopo permanece: lotes, animais, pesagens, sanidade, reprodução, compra/venda, financeiro, relatórios e configurações.

## Restrições obrigatórias

- Core R$ 0, self-hosted/local e open source.
- Nenhum SaaS pago como dependência silenciosa.
- Não quebrar compatibilidade com o banco legado durante o hardening.
- Não promover para `main` antes da certificação real do release.
- Reaproveitar `utilidades` e `frontEnds` por contratos/adapters, sem copiar upstreams completos para o produto.
- Manter Electron endurecido com `contextIsolation`, `sandbox` e IPC fechado.

## Estratégia escolhida

### Abordagem A — hardening incremental sobre a arquitetura atual — escolhida

Preservar `__artisys_records` como source of truth, reforçar invariantes de domínio, transações, auditoria, permissões, QA e UI sobre a arquitetura atual.

Vantagens: menor risco de regressão, migração controlada, compatibilidade com release/cutover existente e menor duplicação.

### Abordagem B — migrar imediatamente tudo para tabelas SQL normalizadas

Não escolhida agora. Embora possa melhorar consultas específicas, aumentaria muito o risco de migração e criaria duas frentes simultâneas: hardening funcional e reestruturação de armazenamento.

### Abordagem C — recomeçar a aplicação sobre um framework/ERP mais amplo

Descartada. Aumentaria o escopo, invalidaria o trabalho de migração já concluído e não é necessária para resolver os riscos atuais.

## 1. Persistência e source of truth

`__artisys_records` permanece como fonte operacional de verdade nesta fase.

As tabelas `cattle_*` existentes não podem continuar aparentando fornecer constraints que o fluxo operacional não utiliza. O hardening deve:

1. documentar explicitamente o source of truth;
2. impedir duplicidade de identificadores de domínio, especialmente `animal.tag`;
3. validar referências entre entidades no domínio/repository antes da escrita;
4. preservar `expectedVersion` e histórico de alterações;
5. adicionar testes de reabertura do banco e integridade após falhas;
6. manter migrations legadas para compatibilidade, sem criar escrita duplicada silenciosa.

Se uma constraint depender de consulta em outra coleção, ela será aplicada por serviço de domínio/repository e coberta por teste de concorrência/duplicidade.

## 2. Permissões e segurança

O modelo RBAC atual será mantido, mas endurecido.

Permissões novas ou explícitas:

- `settings:read`
- `settings:write`
- `settings:backup`
- `settings:restore`
- `audit:read`
- `users:manage`

Regras:

- `restore` é exclusivo de administrador.
- backup pode ser concedido a administrador e gerente, conforme política final.
- leitura de auditoria exige `audit:read`.
- ações não mapeadas não podem herdar permissões excessivas por omissão.
- toda negação deve retornar erro consistente e ser testada.

## 3. Auditoria

Integrar o contrato de `artisys-audit-log` do RepoUteis por adapter local, sem dependência de serviço externo.

Eventos mínimos auditados:

- autenticação e revogação de sessão;
- criação/alteração/exclusão de lotes;
- criação/movimentação/ciclo de vida de animal;
- pesagens;
- sanidade;
- reprodução;
- compra/venda;
- lançamentos financeiros;
- emissão de relatórios quando aplicável;
- criação de backup;
- restauração;
- mudanças de configuração e permissões.

Cada registro deve conter ator, ação, entidade, id da entidade, data/hora e metadados necessários para diagnóstico, sem gravar senha/token.

## 4. Transações e consistência de negócio

Criar uma camada de use-cases transacionais para operações que cruzam múltiplas entidades.

### Venda de animais

Fluxo atômico:

1. validar animais e status;
2. validar dados da negociação;
3. criar venda;
4. encerrar lifecycle dos animais como vendidos;
5. gerar lançamento financeiro;
6. registrar auditoria;
7. confirmar transação.

Qualquer falha deve causar rollback completo.

### Movimentação de animal

Validar animal ativo e lote destino antes de salvar a movimentação.

### Eventos sanitários/reprodutivos

Validar animal, protocolo e datas antes da persistência.

## 5. QA funcional completo

O contrato atual de 10 telas e 16 ações deve virar a matriz obrigatória de QA.

O QA de release só será considerado completo quando validar:

- abertura das 10 telas;
- execução positiva das 16 ações;
- principais cenários negativos;
- persistência após reinício/reabertura;
- conflitos de versão;
- RBAC por papel;
- backup e restore;
- transação de venda com rollback induzido;
- ausência de segredos e problemas críticos de segurança;
- build e instalador.

Screenshots continuam úteis como evidência visual, mas não contam sozinhas como cobertura funcional.

Integrar, conforme contratos existentes no RepoUteis:

- `artisys-qa`
- `artisys-product-qa`
- `artisys-security`
- `artisys-api-contracts`
- `artisys-release-validator`

Módulos ainda classificados como `implemented` precisam ser homologados dentro do Pecuária antes de se tornarem bloqueadores obrigatórios de release.

## 6. Backup e recuperação

Substituir o backup manual isolado por adapter compatível com `artisys-backup`, preservando o armazenamento local.

Cada backup deve possuir:

- id;
- data/hora;
- tamanho;
- SHA-256;
- verificação de integridade;
- política de retenção configurável;
- teste de restauração em sandbox quando usado na certificação.

Antes de restore real, criar backup de segurança automaticamente.

## 7. Frontend comercial

Remover o textarea JSON como interface normal do usuário. Ele pode permanecer somente como ferramenta interna/dev se necessário.

Reaproveitar padrões do `frontEnds`:

- `shells/desktop-admin` para shell;
- `tables-kit` para listagens;
- `navigation-kit` para navegação;
- `dialogs-kit` para formulários e confirmações;
- `feedback-kit` para loading/erro/sucesso/vazio.

Telas:

- Visão Geral: KPIs úteis e alertas.
- Lotes: tabela/cards com quantidade, peso médio e custo.
- Animais: busca, filtros e ficha do animal.
- Pesagens: histórico e ganho de peso.
- Sanidade: protocolos, aplicações e vencimentos.
- Reprodução: timeline de eventos.
- Compra/Venda: fluxo guiado com seleção e conferência.
- Financeiro: custos, receitas e custo por cabeça.
- Relatórios: filtros + exportação.
- Configurações: usuários, backup/restore, auditoria e preferências.

A UI deve continuar consumindo o mesmo backend RPC endurecido; regras de negócio não migram para componentes React.

## 8. Módulos adicionais do RepoUteis

Integração prioritária após o P0:

- `artisys-alerts`
- `artisys-reporting`
- `artisys-search`
- `artisys-importer`
- `artisys-exporter`
- `artisys-dashboard`

Integrações opcionais, nunca necessárias para o core:

- `artisys-serialport` para balanças/dispositivos;
- `artisys-printing` para etiquetas e impressões.

Sincronização/multitenancy permanecem fora do P0 e só entram se houver necessidade concreta do produto.

## 9. Release e certificação

O pipeline deve manter Woodpecker/Windows e o fluxo local atual, adicionando os gates de hardening.

Critérios mínimos para certificação:

1. unitários passam;
2. integração passa;
3. E2E das 16 ações passa;
4. RBAC passa;
5. auditoria passa;
6. backup/restore passa;
7. product QA passa;
8. security passa sem achado crítico não aceito;
9. release-validator passa;
10. instalador é gerado, verificado e recebe SHA-256;
11. evidências pertencem ao mesmo commit.

Somente depois disso a branch poderá ser candidata à promoção para `main`.

## 10. Ordem de implementação

### P0

1. source of truth e constraints;
2. permissões Settings/Backup/Restore;
3. audit-log;
4. QA das 16 ações;
5. transações críticas.

### P1

6. frontend real com componentes reutilizáveis;
7. backup robusto;
8. alerts/reporting/search/importer/exporter/dashboard.

### P2

9. product QA, release-validator e security como gates finais homologados;
10. certificação com banco/instalador reais;
11. promoção para `main` somente com evidência `passed`.

## Critérios de sucesso

O hardening estará concluído quando:

- não houver escrita operacional duplicada entre dois modelos de persistência;
- duplicidades e referências inválidas forem rejeitadas;
- operações multi-entidade relevantes forem atômicas;
- permissões sensíveis estiverem explicitamente protegidas;
- auditoria produzir histórico útil e consultável;
- todas as 16 ações do contrato forem exercitadas automaticamente;
- a interface não exigir JSON manual para uso normal;
- backup/restore tiver integridade verificável;
- o instalador certificado corresponder ao commit certificado;
- nenhuma dependência paga for necessária para o core.

## Não objetivos desta fase

- transformar o produto em ERP agrícola completo;
- adicionar marketplace, billing SaaS ou infraestrutura always-on;
- adicionar cloud obrigatória;
- substituir Electron;
- reescrever toda a persistência em outro banco;
- criar recursos pecuários sem relação com os riscos diagnosticados antes do hardening.
