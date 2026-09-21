# Integração de mapas — ArtiSys Pecuária

## Responsabilidades

1. `nutricionistaalmeidavh-spec/mapasbrasilrelease`
   - fonte oficial dos pacotes PMTiles do Brasil;
   - publica `maps-manifest.json` e assets versionados;
   - o Pecuária não duplica esses arquivos no repositório.

2. `utilidades/modules/artisys-agro-maps`
   - origem do core genérico de GIS, snapshots espaciais e planejamento PMTiles;
   - o snapshot usado neste repositório foi copiado para `src/maps/core` com proveniência explícita;
   - alterações genéricas devem voltar primeiro ao Repo Utilidades e depois ser sincronizadas aqui.

3. `pecuaria`
   - regras específicas: fazenda, piquete, lote, lotação atual e infraestrutura;
   - geometrias reais usam WGS84 e são persistidas em `cattle.map-geometries`;
   - pontos operacionais são persistidos em `cattle.map-points`;
   - o polígono esquemático 0–100 já usado pelo módulo de Pastagens continua separado e compatível.

## API do desktop

O Electron expõe `globalThis.artisys.maps({ operation, input, auth })`.

Operações:

- `state`: snapshot espacial pecuário + estado do catálogo;
- `refreshCatalog`: baixa/valida/cacheia o manifesto mais recente;
- `planOffline`: calcula os pacotes PMTiles que interceptam os limites WGS84 cadastrados;
- `saveGeometry` / `removeGeometry`: geometria real de piquete;
- `savePoint` / `removePoint`: cochos, bebedouros, currais, porteiras, saleiros, balanças, sensores e ocorrências.

`planOffline` fixa cada URL no tag `br-maps-v<releaseVersion>`, conforme o contrato de `mapasbrasilrelease`, evitando mistura entre manifesto e assets de releases diferentes.

## Core obrigatório

A integração não depende de Google Maps, Mapbox ou serviço pago. O core é local/self-hosted/open source e os mapas distribuídos continuam externos ao binário/repositório do Pecuária.
