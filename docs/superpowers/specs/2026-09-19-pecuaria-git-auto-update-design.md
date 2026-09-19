# ArtiSys Pecuária — Atualização de Versão via GitHub

Data: 2026-09-19
Branch: `hardening/reporting-dashboard-p2`

## Objetivo

Adicionar atualização automática de versão ao desktop Windows sem atualização silenciosa, sem servidor próprio e sem custo recorrente obrigatório. O aplicativo deve consultar um canal Git/GitHub automaticamente, informar quando houver versão nova e somente baixar/instalar após decisão explícita do usuário.

## Canal de distribuição

O canal de atualização será **GitHub Releases**, não arquivos crus da branch. O instalador NSIS e o manifesto de atualização (`latest.yml`) devem ser publicados juntos a partir do mesmo build certificado.

O destino de atualização deve ser configurado explicitamente no build (`provider: github`, `owner`, `repo`) para não depender da inferência de `.git/config` ou ambiente CI.

Enquanto o repositório `pecuaria` permanecer público, ele pode servir como canal. Se o source for tornado privado, a distribuição deve migrar para um repositório público dedicado apenas a releases/artefatos, evitando embutir token GitHub no cliente.

## Comportamento do cliente

1. Ao iniciar, depois de a janela estar funcional, o app consulta atualização em background.
2. Se não houver nova versão, nenhuma interrupção é mostrada.
3. Se houver nova versão, a UI mostra versão atual, versão disponível e release notes resumidas quando existirem.
4. O usuário escolhe `Depois` ou `Baixar atualização`.
5. O download só começa após confirmação explícita.
6. Após download e validação, a UI mostra `Instalar e reiniciar`.
7. A instalação só começa após nova confirmação explícita.
8. Fechar o aplicativo normalmente não pode instalar atualização baixada sem esse consentimento.
9. Deve existir também `Verificar atualizações` em Configurações para consulta manual.

## Regras de segurança e integridade

- `autoDownload = false`.
- Instalação automática ao sair deve ser desativada para a versão compatível de `electron-updater` adotada pelo projeto.
- `allowDowngrade = false`.
- Prereleases não entram no canal estável por padrão.
- O app nunca recebe `GH_TOKEN` de distribuição.
- O pacote e o manifesto precisam vir do mesmo release/build.
- Checksum do updater deve ser validado pelo fluxo padrão do `electron-updater`; a certificação P2 registra também SHA-256 do instalador final.
- Erro de rede/update não pode impedir uso offline do sistema.
- Updater só roda no app empacotado; ambiente de desenvolvimento usa adapter injetável/mock.

## Arquitetura

### Main process

Criar `electron/updater.mjs` responsável por:

- configurar o `electron-updater`;
- consultar releases;
- normalizar estados (`idle`, `checking`, `available`, `not-available`, `downloading`, `downloaded`, `error`);
- emitir somente payloads sanitizados para a renderer;
- iniciar download apenas por IPC explícito;
- executar `quitAndInstall()` apenas por IPC explícito.

### IPC/preload

O preload expõe apenas métodos fechados:

- `updates.getState()`
- `updates.check()`
- `updates.download()`
- `updates.install()`
- `updates.onState(callback)`

Nenhuma URL arbitrária, caminho de arquivo, token ou comando é aceito da renderer.

### Renderer

A interface reutiliza o sistema de feedback/diálogo existente. Não cria uma 11ª tela; o controle manual fica dentro de Configurações e o aviso de nova versão é global.

## Versionamento

- Versões de distribuição usam SemVer estável `X.Y.Z`.
- A versão em `package.json` é a versão autoritativa do binário empacotado.
- Uma release só pode ser publicada quando a tag Git corresponder exatamente a `v${package.version}`.
- O pipeline deve rejeitar tag/versão divergente e versão não superior à release estável anterior.

## Integração com P2

O updater entra **antes da certificação real Windows** porque altera o pacote final e o contrato de release.

A certificação P2 deve provar:

- o NSIS gera metadata de auto-update;
- `latest.yml` e `.exe` pertencem ao mesmo build;
- versão/tag coincidem;
- update disponível é detectado em teste com provider/mock controlado;
- nenhuma atualização baixa ou instala sem consentimento;
- falha de rede não bloqueia o produto;
- Woodpecker continua manual-only.

## Critério de sucesso

O recurso estará concluído quando um usuário instalado numa versão anterior puder abrir o Pecuária, ser avisado de uma release estável mais nova, optar por baixar e depois optar por instalar/reiniciar, sem baixar ou instalar nada silenciosamente e sem exigir serviço pago da ArtiSys.
