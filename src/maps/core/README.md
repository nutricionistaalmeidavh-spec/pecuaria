# Map core provenance

This folder vendors the reusable geometry and PMTiles planning primitives from:

- `nutricionistaalmeidavh-spec/utilidades/modules/artisys-agro-maps`

Ownership remains split intentionally:

- **Generic GIS/PMTiles primitives:** `utilidades/modules/artisys-agro-maps`
- **Published Brazil map catalog and PMTiles assets:** `nutricionistaalmeidavh-spec/mapasbrasilrelease`
- **Livestock rules and UX:** this repository (`pecuaria`)

Do not place cattle-specific rules in this folder. When the generic upstream changes, sync the relevant files and keep livestock adapters/tests outside `src/maps/core`.
