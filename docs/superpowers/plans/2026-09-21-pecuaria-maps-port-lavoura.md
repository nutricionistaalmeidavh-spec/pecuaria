# Pecuária Maps Port from Sistema Lavoura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o módulo de mapas do ArtiSys Pecuária a produção reutilizando a implementação madura do Sistema Lavoura, especializando apenas domínio e UX pecuários, sem criar uma terceira infraestrutura cartográfica paralela.

**Architecture:** `mapasbrasilrelease` continua sendo a fonte oficial de catálogo e PMTiles; `src/maps/core` mantém primitivas GIS/PMTiles genéricas sincronizadas do Repo Utilidades; o Pecuária mantém somente regras de fazenda/piquete/lote/infraestrutura. O gerenciador transacional, estados offline e renderer vetorial local são portados do `SistemaLavoura` e adaptados, não reescritos. MapLibre não é dependência desta entrega: o renderer SVG vetorial existente será usado primeiro e só deve ser substituído em plano separado se os testes de desempenho provarem necessidade.

**Tech Stack:** Electron, React, Node.js, SQLite/local persistence, PMTiles CLI, GeoJSON/WGS84, SVG, Playwright, `node:test`.

**Spec:** `docs/MAPS_INTEGRATION.md`

## Global Constraints

- `nutricionistaalmeidavh-spec/mapasbrasilrelease` é a fonte/distribuidor oficial de `maps-manifest.json` e PMTiles; não usar o build diário do Protomaps como fonte primária silenciosa.
- O core obrigatório deve continuar R$0, local-first/open source, sem Google Maps, Mapbox ou serviço pago obrigatório.
- `utilidades/modules/artisys-agro-maps` continua dono das primitivas genéricas; regras pecuárias não devem entrar em `src/maps/core`.
- O polígono esquemático 0–100 existente em Pastagens deve ser preservado como fallback e não pode ser reinterpretado como WGS84.
- Nenhuma funcionalidade existente de Pastagens, avaliações, rotação, lotação, escore corporal ou planejado x realizado pode desaparecer.
- A UI principal continua integrada em `Pastagens e Áreas`; não criar um módulo isolado de mapas sem necessidade funcional.
- Desktop Windows x64 pode instalar/recortar/verificar PMTiles; web/PWA deve continuar capaz de visualizar e editar dados pecuários espaciais, mas não precisa instalar pacotes PMTiles.
- URLs de assets devem ficar fixadas à release do manifesto (`br-maps-v<releaseVersion>`), nunca misturando manifesto e assets de versões diferentes.
- Qualquer mudança em contrato de RPC deve atualizar `qa/api-contract.json`, `qa/api-contract.baseline.json`, `qa/product-contract.json` e os gates relacionados.

## Review Focus

1. **Release inexistente/draft ou manifesto sem assets disponíveis:** manter mapa local existente utilizável e exibir erro acionável; nunca apagar pacote saudável.
2. **Instalação interrompida ou checksum inválido:** restaurar último pacote bom, limpar `.part`, registrar recovery issue e não promover arquivo inválido.
3. **Browser versus Electron:** `maps.state/saveGeometry/savePoint/remove*` devem funcionar no preview web; operações de pacote devem aparecer como indisponíveis no browser, não como `undefined`.
4. **Piquete sem geometria WGS84:** continuar aparecendo no mapa esquemático e nas demais telas; mapa geográfico deve mostrar estado vazio/mapeamento pendente.
5. **Carga espacial alta:** renderer SVG deve manter interação aceitável com 300 piquetes e 1.000 pontos; se não cumprir o gate definido neste plano, abrir plano separado de renderer, sem introduzir MapLibre nesta entrega por antecipação.

---

## Mapa de arquivos

### Fonte de referência — Sistema Lavoura

- `runtime/map-package-manager.mjs` — mecânica robusta de instalação, verificação, rollback, recuperação e remoção.
- `web/ui/offline-maps.jsx` — UX dos pacotes offline e estados de saúde.
- `web/ui/offline-maps.css` — estilos da experiência offline.
- `web/ui/agricultural-map.jsx` — renderer SVG vetorial, seleção, camadas e ficha lateral.
- `web/ui/agricultural-map.css` — layout do renderer.
- `tests/map-package-manager.test.js` — contrato básico do package manager.
- `tests/p8-map-robustness.test.js` — recuperação/integridade.
- `tests/p3-agricultural-map.test.js` — contrato da superfície vetorial.

### Pecuária — manter

- `src/maps/core/*` — primitivas genéricas já vendorizadas.
- `src/pecuaria-map.js` — especialização fazenda/piquete/lote/infraestrutura.
- `runtime/map-rpc.mjs` — RPC autenticado.
- `docs/MAPS_INTEGRATION.md` — responsabilidades arquiteturais.
- `web/pasture-management.jsx` — superfície existente que recebe o mapa real sem perder o esquemático.

### Pecuária — criar/adaptar

- `runtime/map-package-manager.mjs` — port do Lavoura com fonte oficial adaptada.
- `web/maps/cattle-map.jsx` — renderer vetorial especializado.
- `web/maps/offline-maps.jsx` — UX offline especializada.
- `web/maps/map-editor.jsx` — desenho/importação/edição de geometria e pontos.
- `web/maps/browser-runtime.js` — contrato `maps()` para preview web/PWA.
- `web/maps/maps.css` — estilos específicos, derivados dos componentes do Lavoura.
- `tests/map-package-manager.test.js`
- `tests/map-robustness.test.js`
- `tests/cattle-map-ui.test.js`
- `tests/e2e/maps-pastures.spec.mjs`
- `tests/e2e-electron/maps.spec.mjs`

### Pecuária — modificar

- `runtime/host.mjs`
- `runtime/map-rpc.mjs`
- `electron/main.mjs`
- `electron/preload.cjs`
- `web/main.jsx`
- `web/pasture-management.jsx`
- `web/styles.css` somente se tokens existentes forem necessários; preferir `web/maps/maps.css`.
- `qa/api-contract.json`
- `qa/api-contract.baseline.json`
- `qa/product-contract.json`
- `package.json`
- `playwright.config.mjs` somente para adicionar projeto/config separado quando necessário; não quebrar suite web existente.

---

### Task 1: Substituir o planner parcial por package manager robusto, preservando `mapasbrasilrelease`

**Files:**
- Create: `runtime/map-package-manager.mjs`
- Modify: `runtime/host.mjs`
- Modify: `runtime/map-rpc.mjs`
- Modify or remove after migration: `runtime/map-catalog.mjs`
- Test: `tests/map-package-manager.test.js`

**Interfaces:**
- Consumes: `validateMapManifest()` e `buildRegionalMapPlan()` de `src/maps/core/index.js`.
- Produces: `createMapPackageManager({dataDir,...})` com `snapshot()`, `refreshCatalog()`, `planFarmMap()`, `installFarmMap()`, `verifyFarmMap()`, `removeFarmMap()`.
- `snapshot()` retorna `{available, platform, arch, manifestUrl, catalogVersion, catalogAvailable, installed, recoveryIssues, profiles}`.

- [ ] **Step 1: portar primeiro os testes do Lavoura e fazê-los falhar no Pecuária**

Adicionar testes equivalentes ao contrato já validado no Lavoura:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapPackageManager} from '../runtime/map-package-manager.mjs';

test('instala recorte, verifica e remove pacote da fazenda atomicamente', async()=>{
  // fixture de CLI: `extract` escreve arquivo temporário e `verify` retorna sucesso
  // assert: metadata, sha256, size, bbox e remoção final
});

test('não promove pacote quando verify falha', async()=>{
  // assert: último pacote saudável permanece no lugar
});
```

- [ ] **Step 2: portar as primitivas transacionais do Lavoura**

Reutilizar a estrutura de `runtime/map-package-manager.mjs` do Sistema Lavoura:

```js
const tempPath=`${finalPath}.part-${process.pid}-${Date.now()}.pmtiles`;
const backupPath=`${finalPath}.bak`;
await writeJournal(recordId,{...journalBase,stage:'verified-temp'});
// somente promover depois de `pmtiles verify` e SHA-256
```

Manter: preflight de disco, journal, rollback, `installed()`, health `healthy|unverified|outdated|missing|corrupt`, recovery issues e lock de instalação concorrente.

- [ ] **Step 3: adaptar a origem do pacote — não copiar `resolveRecentSource()` literalmente**

O manager do Pecuária deve resolver fontes pelo manifesto oficial:

```js
async function planFarmMap(input={}){
  const manifest=(await loadCachedCatalog()) ?? await refreshCatalog();
  return buildRegionalMapPlan({
    areaId:input.farmUnitId,
    areaName:input.farmName,
    bounds:input.bounds,
    manifest,
    profile:input.profile,
    releaseBaseUrl:`https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v${manifest.releaseVersion}`
  });
}
```

Se o plano retornar mais de uma fonte estadual, não escolher uma silenciosamente. Retornar `MAP_MULTI_SOURCE_REQUIRED` com as fontes envolvidas e cobrir o caso com teste; suporte a fazenda interestadual pode ser implementado depois como composição explícita, sem corromper o fluxo comum.

- [ ] **Step 4: instalar usando o asset versionado do release**

```js
const plan=await planFarmMap(input);
if(plan.sources.length!==1) throw new MapPackageError('MAP_MULTI_SOURCE_REQUIRED','A propriedade intercepta mais de um pacote regional.');
const source=plan.sources[0];
await execFileImpl(cli,[
  'extract',source.url,tempPath,
  `--bbox=${plan.bbox}`,
  `--maxzoom=${plan.maxZoom}`,
  '--overfetch=0',
  '--download-threads=4'
]);
```

Registrar `catalogVersion`, `sourceId`, `sourceSha256`, `bounds`, `profile`, `sha256` local, `size`, `installedAt`, `verifiedAt`.

- [ ] **Step 5: consolidar `runtime/map-catalog.mjs` para evitar duas fontes de verdade**

Depois que `createMapPackageManager()` possuir `refreshCatalog/planFarmMap/snapshot`, remover a lógica duplicada de catálogo de `runtime/map-catalog.mjs` ou transformar o arquivo em thin re-export sem estado próprio.

- [ ] **Step 6: executar testes focados**

```bash
node --test tests/map-package-manager.test.js tests/maps-integration.test.js
```

Expected: PASS; nenhuma chamada ao build diário do Protomaps em testes de produção.

- [ ] **Step 7: commit**

```bash
git add runtime/map-package-manager.mjs runtime/map-rpc.mjs runtime/host.mjs tests/map-package-manager.test.js tests/maps-integration.test.js
git commit -m "feat: port robust map package manager to pecuaria"
```

---

### Task 2: Portar recuperação, integridade e estados offline do Lavoura

**Files:**
- Modify: `runtime/map-package-manager.mjs`
- Create: `tests/map-robustness.test.js`

**Interfaces:**
- Consumes: package manager da Task 1.
- Produces: erros estáveis `MAP_DISK_FULL`, `MAP_CATALOG_UNAVAILABLE`, `MAP_CATALOG_INVALID`, `MAP_VERIFY_FAILED`, `MAP_PACKAGE_CORRUPT`, `MAP_RECOVERY_FAILED`, `MAP_INSTALL_IN_PROGRESS`, `MAP_MULTI_SOURCE_REQUIRED`, `MAP_UNSUPPORTED_RUNTIME`.

- [ ] **Step 1: portar testes de recovery do Lavoura**

Cobrir journal com `.bak`, `.part`, metadata e promoção interrompida:

```js
test('restaura backup conhecido após promoção interrompida',async()=>{
  // criar final ausente + backup presente + transaction journal
  // snapshot() deve restaurar final e limpar o journal quando seguro
});
```

- [ ] **Step 2: cobrir falhas operacionais adicionais**

```js
test('ENOSPC vira MAP_DISK_FULL', async()=>{});
test('checksum local divergente vira corrupt', async()=>{});
test('catálogo novo marca pacote anterior como outdated', async()=>{});
test('duas instalações simultâneas da mesma fazenda são rejeitadas', async()=>{});
```

- [ ] **Step 3: implementar somente o necessário para passar os testes**

Portar do Lavoura `normalizeMapPackageError`, `reconcilePackages`, `preflight`, `verifyFarmMap`, `installed` e comparação de versão.

- [ ] **Step 4: rodar suite focada**

```bash
node --test tests/map-package-manager.test.js tests/map-robustness.test.js
```

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add runtime/map-package-manager.mjs tests/map-robustness.test.js
git commit -m "test: port offline map recovery guarantees"
```

---

### Task 3: Portar o renderer vetorial do Lavoura e especializar para Pecuária

**Files:**
- Create: `web/maps/cattle-map.jsx`
- Create: `web/maps/maps.css`
- Create: `tests/cattle-map-ui.test.js`

**Interfaces:**
- Consumes: `maps({operation:'state'}) -> {map, provider}`.
- Produces: `<CattleMap map={...} onAddPoint onEditPasture onSelectPasture />`.

- [ ] **Step 1: escrever contrato de UI antes do componente**

```js
test('mapa pecuário preserva camadas e ficha operacional',async()=>{
  const ui=await source('web/maps/cattle-map.jsx');
  for(const text of ['Piquetes','Lotes','Infraestrutura','Ocorrências']) assert.match(ui,new RegExp(text));
  assert.match(ui,/currentLotName/);
  assert.match(ui,/animalUnits/);
  assert.match(ui,/data-testid=["']cattle-map["']/);
});
```

- [ ] **Step 2: portar somente as primitivas visuais úteis do `agricultural-map.jsx`**

Reutilizar: `projector`, `ringPoints`, bounds combinados, seleção por mouse/teclado, `<polygon>`, `<polyline>`, pontos, toggles de camada e painel lateral.

Não portar semântica agrícola de safra/cultura/chuva/operação.

- [ ] **Step 3: mapear semântica Pecuária**

```js
const LAYER_LABELS=Object.freeze({
  pastures:'Piquetes',
  lots:'Lotes',
  infrastructure:'Infraestrutura',
  occurrences:'Ocorrências',
  sensors:'Sensores'
});
```

Ficha selecionada deve expor nome, área, forrageira, status, `currentLotName`, `animalUnits` e infraestrutura vinculada.

- [ ] **Step 4: adicionar acessibilidade equivalente ao mapa visual**

Cada piquete e ponto deve ser focável e a mesma informação da ficha deve existir em texto/DOM; não depender apenas de cor/posição.

- [ ] **Step 5: criar gate de desempenho do renderer atual**

Teste de unidade deve montar snapshot com 300 piquetes e 1.000 pontos e garantir que as funções puras de projeção/snapshot não apresentem crescimento quadrático óbvio. O benchmark visual deve ser registrado no QA manual; se o SVG ficar inadequado, abrir issue/plano separado para renderer acelerado.

- [ ] **Step 6: commit**

```bash
git add web/maps/cattle-map.jsx web/maps/maps.css tests/cattle-map-ui.test.js
git commit -m "feat: adapt Lavoura vector map to cattle domain"
```

---

### Task 4: Portar a UX de mapas offline e integrar em Pastagens sem remover o mapa esquemático

**Files:**
- Create: `web/maps/offline-maps.jsx`
- Modify: `web/maps/maps.css`
- Modify: `web/pasture-management.jsx`
- Modify: `web/main.jsx`
- Test: `tests/cattle-map-ui.test.js`

**Interfaces:**
- Consumes: `backend.maps({auth,operation,input})`.
- Produces: tabs/segmented control `Mapa geográfico | Esquemático`; painel de pacotes offline no contexto de fazenda.

- [ ] **Step 1: portar `LavouraOfflineMaps` e trocar somente a semântica necessária**

Preservar health copy, mensagens de erro, perfis, instalar/verificar/remover/atualizar catálogo e estado `Somente no desktop Windows`.

```jsx
<CattleOfflineMaps
  data={mapState}
  onRun={(operation,input)=>backend.maps({auth,operation,input})}
  reload={loadMaps}
/>
```

- [ ] **Step 2: manter `PastureMap` atual como fallback explícito**

Não apagar `data-testid="pasture-local-map"`. Introduzir wrapper:

```jsx
<div data-testid="pasture-map-mode">
  <button>Mapa geográfico</button>
  <button>Esquemático</button>
</div>
```

Sem geometria WGS84, o mapa geográfico deve mostrar “Mapeie pelo menos um piquete”; o esquemático continua disponível.

- [ ] **Step 3: integrar carregamento no `web/main.jsx`**

Quando `screenId==='pastures'`, carregar `backend.maps({operation:'state'})` e passar o estado ao `PastureManagementWorkspace`. Falha de catálogo não deve impedir a tela de Pastagens de abrir.

- [ ] **Step 4: atualizar contrato de UI**

Adicionar asserts para `cattle-map`, `pasture-map-mode`, `offline-maps-workspace` e preservar os ids P1B existentes.

- [ ] **Step 5: commit**

```bash
git add web/maps/offline-maps.jsx web/maps/maps.css web/pasture-management.jsx web/main.jsx tests/cattle-map-ui.test.js
git commit -m "feat: integrate geographic and offline maps into pastures"
```

---

### Task 5: Criar editor pecuário para geometria e infraestrutura sem JSON cru

**Files:**
- Create: `web/maps/map-editor.jsx`
- Modify: `web/maps/cattle-map.jsx`
- Modify: `web/main.jsx`
- Modify: `src/pecuaria-map.js`
- Test: `tests/maps-integration.test.js`
- Test: `tests/cattle-map-ui.test.js`

**Interfaces:**
- Consumes RPCs: `saveGeometry`, `removeGeometry`, `savePoint`, `removePoint`.
- Produces UI tipada para Polygon/MultiPolygon e pontos `trough|water|corral|gate|salt|mineral|scale|sensor|occurrence|other`.

- [ ] **Step 1: testar importação e edição sem alterar o polígono esquemático**

```js
test('salvar WGS84 não altera pasture.polygon 0-100', async()=>{});
test('rejeita polygon auto-intersectante', ()=>{});
test('rejeita longitude/latitude fora de WGS84', ()=>{});
```

- [ ] **Step 2: criar fluxo de importação GeoJSON**

Aceitar `Feature` Polygon/MultiPolygon ou `FeatureCollection` com seleção explícita da feição. Normalizar via `src/maps/core/gis.js`; nunca persistir JSON cru sem validação.

- [ ] **Step 3: criar fluxo de desenho/edição simples**

O renderer deve permitir iniciar limite, adicionar/remover vértices e salvar. Nesta entrega, edição por formulário de vértices + clique no mapa é suficiente; arraste sofisticado não é requisito.

- [ ] **Step 4: criar fluxo de infraestrutura**

```jsx
<select name="kind">
  <option value="water">Bebedouro</option>
  <option value="trough">Cocho</option>
  <option value="corral">Curral</option>
  <option value="gate">Porteira</option>
  <option value="salt">Saleiro</option>
  <option value="scale">Balança</option>
  <option value="sensor">Sensor</option>
  <option value="occurrence">Ocorrência</option>
</select>
```

- [ ] **Step 5: calcular área geodésica separadamente da área cadastrada**

Adicionar utilitário genérico somente se ainda não existir no Repo Utilidades; no Pecuária apenas consumir o resultado. UI deve mostrar `Área cadastrada` e `Área calculada`, com ação explícita para atualizar cadastro; nunca substituir automaticamente.

- [ ] **Step 6: commit**

```bash
git add web/maps/map-editor.jsx web/maps/cattle-map.jsx web/main.jsx src/pecuaria-map.js tests/maps-integration.test.js tests/cattle-map-ui.test.js
git commit -m "feat: add typed cattle map editing flows"
```

---

### Task 6: Dar ao browser/PWA o mesmo contrato de mapa usado pelo Electron

**Files:**
- Create: `web/maps/browser-runtime.js`
- Modify: `web/main.jsx`
- Modify: `runtime/map-rpc.mjs` somente se necessário para aceitar `mapPackageManager=null`.
- Test: `tests/maps-browser-runtime.test.js`

**Interfaces:**
- Consumes: `createBrowserPersistence`, `createCattlePresentation`, `createCattleMapService`, `createMapRpc`.
- Produces backend web com método `maps()`; provider de pacote retorna `available:false` no browser.

- [ ] **Step 1: escrever teste que reproduz o gap atual**

```js
test('browser backend exposes maps instead of undefined',async()=>{
  const backend=await createBrowserBackendForTest();
  assert.equal(typeof backend.maps,'function');
});
```

- [ ] **Step 2: criar runtime compartilhado**

```js
export function attachBrowserMaps({coreBackend,presentation,persistence}){
  const mapService=createCattleMapService(persistence);
  return Object.freeze({
    ...coreBackend,
    maps:createMapRpc({presentation,mapService,mapPackageManager:null})
  });
}
```

`state/saveGeometry/savePoint/removeGeometry/removePoint` devem funcionar. `installFarmMap/verifyFarmMap/removeFarmMap/refreshCatalog` devem retornar erro estável `MAP_UNSUPPORTED_RUNTIME` ou provider `available:false`, nunca ausência de função.

- [ ] **Step 3: usar o mesmo caminho no `getBackend()` de `web/main.jsx`**

Electron continua via `globalThis.artisys`; web constrói backend local com o mesmo método `maps`.

- [ ] **Step 4: commit**

```bash
git add web/maps/browser-runtime.js web/main.jsx runtime/map-rpc.mjs tests/maps-browser-runtime.test.js
git commit -m "feat: expose cattle maps contract in browser runtime"
```

---

### Task 7: Cobrir jornadas E2E web e Electron

**Files:**
- Create: `tests/e2e/maps-pastures.spec.mjs`
- Create: `tests/e2e-electron/maps.spec.mjs`
- Create: `qa/fixtures/maps/test-region.pmtiles` apenas se um fixture mínimo válido puder ser versionado com tamanho aceitável; caso contrário gerar fixture durante o teste com fake CLI.
- Modify: `package.json`
- Modify: `playwright.config.mjs` somente se necessário para projeto separado Electron.

**Interfaces:**
- Consumes: UI/RPC das Tasks 3–6.
- Produces evidência E2E web e Electron para mapa, persistência e pacote local.

- [ ] **Step 1: E2E web — dados espaciais e UX**

Cobrir em `maps-pastures.spec.mjs`:

```js
test('mapeia piquete e infraestrutura sem perder o mapa esquemático',async({page})=>{
  // login
  // abrir Pastagens
  // alternar para Mapa geográfico
  // criar/importar limite
  // adicionar Bebedouro
  // selecionar piquete e validar lote/UA
  // alternar para Esquemático e validar que continua disponível
});
```

Também cobrir empty state, erro de catálogo não bloqueante e usuário sem permissão de escrita.

- [ ] **Step 2: E2E web — persistência entre reloads**

Criar geometria/ponto, recarregar página, validar persistência e seleção.

- [ ] **Step 3: E2E Electron — IPC e package manager real/fake controlado**

Lançar Electron com diretório temporário e provider injetável. Validar:

- `renderer -> preload -> IPC -> map-rpc`;
- instalação cria metadata/pacote;
- verify marca `healthy`;
- corrupção controlada marca `corrupt`;
- remoção apaga pacote;
- reinício preserva estado local.

- [ ] **Step 4: E2E Electron — modo sem rede**

Depois da instalação fixture, bloquear rede e validar que a UI ainda mostra pacote local e dados geográficos da fazenda.

- [ ] **Step 5: capturar screenshots de QA**

Playwright já retém screenshot/trace/video em falha; adicionar screenshot explícito da tela `Pastagens e Áreas` com mapa geográfico para revisão visual de release.

- [ ] **Step 6: scripts**

```json
{
  "scripts": {
    "test:e2e:maps": "playwright test tests/e2e/maps-pastures.spec.mjs",
    "test:e2e:electron:maps": "playwright test -c playwright.electron.config.mjs tests/e2e-electron/maps.spec.mjs"
  }
}
```

- [ ] **Step 7: commit**

```bash
git add tests/e2e/maps-pastures.spec.mjs tests/e2e-electron/maps.spec.mjs package.json playwright.config.mjs
git commit -m "test: add web and electron e2e for cattle maps"
```

---

### Task 8: Atualizar contratos, gates e certificação de release

**Files:**
- Modify: `qa/api-contract.json`
- Modify: `qa/api-contract.baseline.json`
- Modify: `qa/product-contract.json`
- Modify: testes/gates que fixam contagem de RPCs.
- Modify: `docs/MAPS_INTEGRATION.md`

**Interfaces:**
- Consumes: superfície final.
- Produces: contrato de release auditável e sem drift silencioso.

- [ ] **Step 1: atualizar RPC contract**

Adicionar `maps` aos `rpcMethods`; contagem esperada passa de 17 para 18, sem remover nenhum método anterior.

- [ ] **Step 2: registrar operações de mapa no contrato de produto**

Documentar no contrato ao menos:

```text
state
refreshCatalog
planOffline
installFarmMap
verifyFarmMap
removeFarmMap
saveGeometry
removeGeometry
savePoint
removePoint
```

- [ ] **Step 3: atualizar baseline/digest usando o tooling existente**

Não editar hash “na mão”. Rodar o gate que projeta o contrato e persistir o digest gerado pelo próprio tooling.

- [ ] **Step 4: rodar suite completa**

```bash
npm test
npm run check
npm run qa:contracts
npm run qa:security
npm run qa:product
npm run qa:web
npm run test:e2e:maps
npm run test:e2e:electron:maps
```

Expected: todos PASS.

- [ ] **Step 5: certificar release externa antes do merge final**

Verificar que `mapasbrasilrelease` possui release **publicada** (não draft) cujo `maps-manifest.json` possui pelo menos o asset do estado usado no teste de homologação com `available:true`, `size`, `sha256` e tag correspondente a `releaseVersion`.

Teste manual de produção:

```text
1. instalar build Windows em máquina limpa
2. cadastrar fazenda + piquete WGS84
3. baixar mapa da fazenda
4. fechar aplicativo
5. desconectar internet
6. reabrir
7. validar mapa/dados locais
8. verificar integridade
9. reconectar e atualizar catálogo
10. confirmar que nenhuma função antiga de Pastagens desapareceu
```

- [ ] **Step 6: atualizar documentação final**

`docs/MAPS_INTEGRATION.md` deve descrever explicitamente que:

- package manager e UX offline foram portados/adaptados do Sistema Lavoura;
- a fonte oficial no Pecuária é `mapasbrasilrelease`;
- SVG vetorial é o renderer atual;
- MapLibre/renderer acelerado fica fora do escopo até existir evidência de desempenho que justifique a troca.

- [ ] **Step 7: commit**

```bash
git add qa docs tests package.json
git commit -m "chore: certify cattle maps release contracts"
```

---

## Critério de 100% pronto

O módulo só pode ser chamado de pronto para produção quando todos os itens abaixo forem verdadeiros:

- [ ] `mapasbrasilrelease` possui release pública e consumível.
- [ ] Pecuária usa catálogo/asset versionado dessa release.
- [ ] Download/recorte/verify/rollback/remove funcionam no desktop.
- [ ] Mapa geográfico reutiliza renderer vetorial adaptado do Lavoura.
- [ ] Mapa esquemático atual continua disponível.
- [ ] Usuário consegue mapear piquete e adicionar infraestrutura sem JSON cru.
- [ ] Piquete selecionado mostra lote atual e UA.
- [ ] Web/PWA possui `maps()` funcional para dados espaciais.
- [ ] Operações desktop-only têm estado indisponível explícito no browser.
- [ ] E2E web cobre jornada pecuária completa.
- [ ] E2E Electron cobre IPC, filesystem, package manager e modo sem rede.
- [ ] QA contracts reconhecem 18 RPCs e as operações de mapa.
- [ ] Suite completa e gates de release passam.
- [ ] Build Windows homologado com internet e sem internet.
- [ ] Nenhuma funcionalidade anterior de Pastagens foi removida.

## O que foi removido do roadmap antigo por já existir no Lavoura

Não tratar como implementação do zero:

- gerenciador de download/verify/rollback de PMTiles;
- preflight de disco;
- journal e recovery de instalação interrompida;
- health `healthy/outdated/missing/corrupt`;
- UX de instalar/verificar/remover pacote;
- perfis Básico/Detalhado/Máximo;
- renderer SVG com Polygon/MultiPolygon/Point/LineString;
- seleção por teclado/mouse;
- toggles de camadas;
- ficha lateral de entidade selecionada;
- empty states básicos do mapa.

Esses itens são **port/adapt**. Trabalho novo é apenas o que muda domínio, contratos, integração Pecuária, edição pecuária e E2E específico.

## Fora de escopo desta entrega

- MapLibre/Mapbox GL ou qualquer renderer novo sem evidência de necessidade.
- Google Maps/Mapbox pagos.
- sincronização cloud obrigatória.
- rastreamento GPS em tempo real de cada animal.
- composição multiestado automática de PMTiles; primeiro retornar estado explícito `MAP_MULTI_SOURCE_REQUIRED` e planejar separadamente se houver necessidade real.
