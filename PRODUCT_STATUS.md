# ArtiSys Pecuária — Status do Produto

- Produto: `agro-pecuaria`
- Versão estável atual: `1.0.0`
- Banco: `artisys-pecuaria.sqlite`
- Migration obrigatória: `agro-pecuaria/001-initial.sql`
- Telas contratadas atuais: **11**
- Ações contratadas atuais: **25**
- Dependência paga obrigatória: **nenhuma**

## Produto

O núcleo é local-first e mantém:

- persistência transacional;
- invariantes pecuárias;
- RBAC e auditoria persistente;
- venda atômica com rollback;
- formulários operacionais tipados;
- backup verificável com SHA-256 e safety backup;
- busca, alertas e importação/exportação locais;
- reporting e dashboard derivados da fonte de verdade persistida.

## IoT opcional

A superfície IoT permanece opcional e sem custo recorrente obrigatório:

- tela **Dispositivos e IoT**;
- RFID/EID e balança;
- conectores serial, MQTT e HTTP;
- registry persistente e secret store local;
- simuladores para validação sem hardware;
- falha/ausência de hardware não impede o uso normal do produto.

O contrato atual contém **11 telas e 25 ações**, incluindo 9 ações IoT.

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

## Gates P2

A cadeia de QA/release possui:

- API Contracts com baseline SHA-256;
- Security Gate fail-closed;
- Product QA;
- Phase 7 data cutover;
- Release Validator;
- Phase 8 certification.

Security em release bloqueia findings `MEDIUM`, `HIGH`, `CRITICAL` e desconhecidos. O runner Windows usa `cmd.exe`/`ComSpec` para executar `npm audit` de forma portável.

## Fase 7 sem banco de cliente

Como o produto ainda não possui cliente com base anterior, `npm run phase7` usa por padrão uma fixture SQLite versionada em `qa/fixtures/legacy-fixture.sql`.

O ensaio gera a base temporária, migra apenas uma cópia sandbox, testa escrita/reabertura e backup/restore, preserva tabelas preexistentes e exige hash inalterado da fonte.

`ARTISYS_LEGACY_DB` continua disponível apenas como homologação adicional quando futuramente existir uma base real anterior.

## Release GitHub automatizada

`.github/workflows/release.yml` executa em `windows-latest`:

1. import boundary e testes;
2. build web e Playwright;
3. Fase 5 — 11/11 telas e 25/25 ações;
4. API Contracts;
5. Security em modo release;
6. Product QA;
7. Fase 7 com fixture;
8. build `ArtiSys-Pecuaria-Setup-*.exe` + `latest.yml`;
9. `release-run.json` com SHA-256;
10. Release Validator;
11. Fase 8;
12. validação final dos artefatos;
13. upload das evidências.

Uma tag `vX.Y.Z` que coincida com `package.json` publica, somente após esses gates, o instalador e metadados no GitHub Release. Esse é o canal consumido pelo updater do cliente.

## Woodpecker

O Woodpecker continua opcional e **somente manual**:

```yaml
when:
  - event: [manual]
```

Ele não é requisito para QA, build, certificação ou publicação normal.

**Estado:** P0/P1, IoT P0/P1, reporting/dashboard, updater e P2 estão integrados no fluxo de produto. O repositório possui caminho autônomo de QA + build Windows + certificação via GitHub Actions e não depende de banco legado de cliente para homologar releases enquanto não existir instalação anterior real.
