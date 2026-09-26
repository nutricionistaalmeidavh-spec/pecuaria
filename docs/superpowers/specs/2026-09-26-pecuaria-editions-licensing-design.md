# ArtiSys Pecuária — edições e licenciamento offline

## Objetivo

Transformar o produto atual em três edições comerciais (Essencial, Gestão e Pro) sem duplicar repositórios, banco ou código, mantendo o core obrigatório local-first, self-hosted e sem dependência paga.

## Escopo

Este desenho implementa as Fases 0–4 do roadmap aprovado:

1. definição comercial;
2. matriz técnica de features;
3. feature flags locais;
4. enforcement no backend;
5. fundação de licenciamento offline verificável.

Não inclui a UX final de ativação/upgrade, builds distintos, checkout ou telemetria remota.

## Arquitetura

A autorização de produto fica separada do RBAC:

`licença/edição -> feature access -> UI/presentation -> RPC feature guard -> RBAC -> domínio`

RBAC continua decidindo o que um usuário autenticado pode fazer dentro das features compradas. Feature access decide o que a licença/edição possui.

## Fonte de verdade

`src/editions.js` será a fonte de verdade para:

- catálogo Essencial/Gestão/Pro;
- conjunto cumulativo de features;
- mapeamento tela -> feature;
- mapeamento ação -> feature quando uma tela mistura níveis;
- mapeamento RPC especializado -> feature.

A matriz comercial legível permanece em `docs/EDITION_MATRIX.md`.

## Feature flags

O módulo local espelha o contrato de `@artisys/feature-flags` do repositório `utilidades`: defaults determinísticos, override por tenant e usuário, sem serviço externo obrigatório.

As edições são presets de defaults. Licença válida pode fornecer uma lista explícita de features; essa lista passa a ser a autoridade para o produto licenciado.

## Licenciamento

O módulo local espelha `artisys-licensing` do repositório `utilidades`:

- payload normalizado;
- assinatura Ed25519;
- chave privada nunca entra no cliente;
- verificação offline por chave pública;
- validação de produto, expiração e device id opcional;
- lista `features` assinada.

### Compatibilidade

Para não quebrar instalações existentes, a ausência de licença mantém `pro` como edição default enquanto `licenseRequired=false`.

Quando `licenseToken` é fornecido, ele é autoritativo. Token inválido, assinatura inválida, produto incorreto, expiração ou device mismatch falham fechados.

Quando `licenseRequired=true`, ausência de token também falha fechada.

## Presentation/UI

`createCattlePresentation` recebe um contexto de acesso de edição.

- Navegação remove telas indisponíveis.
- Ações indisponíveis são removidas da definição funcional da tela.
- Telas mistas removem payloads avançados quando a edição não possui a feature correspondente (por exemplo `finance.admin`).
- `describe()` expõe metadados da edição e apenas a superfície disponível.

## Enforcement de backend

`createRpcBackend` consulta o mesmo contexto de edição antes de autorização RBAC.

Guardas obrigatórios:

- `load(screenId)` valida feature da tela;
- `action(screenId, action)` valida feature da tela e da ação;
- `reproductionAdmin` exige `reproduction.pro`;
- `userAdmin` exige `user.admin`;
- `fieldSync` exige `field.offline`;
- `audit` exige `audit`;
- `simulateSale` exige `sales.simulation`;
- referências retornadas são filtradas por superfície disponível.

Erro de feature indisponível usa código estável `FEATURE_NOT_LICENSED`.

## Integração de host

`createStandaloneHost` recebe opções opcionais:

- `edition='pro'`;
- `licenseToken=null`;
- `licensePublicKey=null`;
- `licenseRequired=false`;
- `deviceId=null`.

O host resolve o acesso uma vez e injeta o mesmo objeto em presentation/backend.

O browser de desenvolvimento continua em Pro por default.

## Segurança

- Nunca confiar apenas em menu oculto.
- Nunca aceitar feature do cliente sem assinatura quando um token de licença está em uso.
- Chave privada de assinatura fica fora do aplicativo.
- Chave pública pode ser distribuída no aplicativo.
- Falha de internet nunca bloqueia licença válida offline.
- Serviços de licença hospedados podem ser adicionados apenas como opção explícita.

## Testes

A suíte deve provar:

1. hierarquia cumulativa Essencial < Gestão < Pro;
2. navegação e ações filtradas;
3. backend nega ação não licenciada antes da operação;
4. RPCs Pro negados em Gestão/Essencial;
5. licença Ed25519 válida libera exatamente as features assinadas;
6. assinatura/produto/device/expiração inválidos falham fechados;
7. ausência de licença preserva Pro por compatibilidade quando não obrigatória;
8. licença obrigatória sem token falha fechada.

## Fora de escopo

- tela final de ativação;
- compra/checkout;
- geração de licença dentro do cliente;
- armazenamento de chave privada no produto;
- dependência de SaaS de flags/licença;
- exclusão de dados em downgrade.