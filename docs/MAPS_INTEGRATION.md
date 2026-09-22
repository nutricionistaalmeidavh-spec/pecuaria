# Integração de mapas — ArtiSys Pecuária

## Responsabilidades

1. `nutricionistaalmeidavh-spec/mapasbrasilrelease`
   - fonte/distribuidor oficial dos pacotes PMTiles do Brasil;
   - publica `maps-manifest.json`, checksums e assets versionados;
   - o Pecuária não duplica os PMTiles no repositório;
   - o cliente fixa assets à tag `br-maps-v<releaseVersion>`, evitando mistura de versões.

2. `utilidades/modules/artisys-agro-maps`
   - origem do core genérico de GIS, snapshots espaciais e planejamento PMTiles;
   - o snapshot usado neste repositório foi copiado para `src/maps/core` com proveniência explícita;
   - alterações genéricas devem voltar primeiro ao Repo Utilidades e depois ser sincronizadas aqui.

3. `SistemaLavoura`
   - referência madura para a mecânica de package manager, recovery, verificação e UX offline;
   - o Pecuária porta/adapta esses padrões, sem copiar a regra antiga de buscar builds diários do Protomaps como fonte de dados;
   - a ferramenta `go-pmtiles` continua sendo um utilitário open source de recorte/verificação, não a fonte oficial do conteúdo cartográfico.

4. `pecuaria`
   - regras específicas: fazenda, piquete, lote, lotação atual, UA e infraestrutura;
   - geometrias reais usam WGS84 e são persistidas em `cattle.map-geometries`;
   - pontos operacionais são persistidos em `cattle.map-points`;
   - o polígono esquemático 0–100 já usado pelo módulo de Pastagens continua separado e compatível.

## Renderer e UI

A visão geográfica reutiliza o padrão vetorial SVG do Sistema Lavoura: Polygon/MultiPolygon, pontos, camadas, seleção por mouse/teclado, ficha lateral e equivalente textual acessível. MapLibre não é uma dependência desta entrega; um renderer acelerado só deve ser introduzido se testes reais de desempenho justificarem a troca.

Em `Pastagens e Áreas` o usuário pode alternar entre:

- **Mapa geográfico** — WGS84, lote atual, UA, forrageira, infraestrutura, sensores e ocorrências;
- **Esquemático** — desenho local 0–100 legado, preservado como fallback.

O editor aceita GeoJSON Polygon/MultiPolygon ou vértices WGS84 e mostra a área geodésica calculada separadamente da área cadastrada. Cochos, bebedouros, currais, porteiras, saleiros, balanças, sensores e ocorrências são cadastrados por formulário tipado, sem JSON cru.

## RPC `maps`

O Electron e o browser expõem `globalThis.artisys.maps({ operation, input })`. A sessão autenticada é ligada pelo bootstrap/preload e não precisa ser manipulada pelo componente visual.

Operações:

- `state`: snapshot espacial pecuário + provider de pacotes;
- `refreshCatalog`: baixa/valida/cacheia o manifesto mais recente;
- `planOffline`: calcula o recorte da propriedade;
- `installFarmMap`: extrai, verifica e promove o PMTiles local de forma transacional;
- `verifyFarmMap`: verifica PMTiles e SHA-256 local;
- `removeFarmMap`: remove pacote/metadados locais;
- `saveGeometry` / `removeGeometry`: geometria real de piquete;
- `savePoint` / `removePoint`: infraestrutura e ocorrências.

As operações de dados espaciais funcionam no browser/PWA. Instalação/verificação de PMTiles é explicitamente desktop Windows x64; no browser o provider retorna `available:false` e erro estável `MAP_UNSUPPORTED_RUNTIME` para operações desktop-only.

## Integridade e recuperação

O package manager usa:

1. arquivo temporário `.part`;
2. `pmtiles extract` com bbox da fazenda;
3. `pmtiles verify`;
4. SHA-256 local;
5. journal transacional;
6. backup do último pacote conhecido como bom;
7. promoção atômica;
8. rollback/recovery em falha.

Estados locais: `healthy`, `unverified`, `outdated`, `missing` e `corrupt`. Falha ao verificar uma atualização antes da criação do backup não apaga o pacote saudável já existente.

## Dependências e disponibilidade

A integração não depende de Google Maps, Mapbox ou serviço pago. O core é local/self-hosted/open source.

Para download em produção, `mapasbrasilrelease` precisa possuir uma release **publicada** (não draft) com o `maps-manifest.json` e os assets indicados como `available:true`. Enquanto a release estiver apenas em draft, a parte de download via `/releases/latest/` permanece bloqueada externamente, embora domínio, UI, persistência, recovery e testes locais do Pecuária continuem funcionais.
