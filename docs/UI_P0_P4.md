# UI P0–P4 — Sistema Pecuária

Implementação de 2026-09-19.

## Escopo

- P0: shell administrativo mais limpo, navegação compacta, tokens verdes e topbar com busca/notificações/perfil.
- P1: composição dedicada para `overview`, preservando telas e ações operacionais existentes.
- P2: iconografia SVG local e semanticamente mapeada, sem CDN nem serviço externo.
- P3: um único hero fotográfico local (`web/public/pecuaria-hero.webp`); demais áreas usam ícones.
- P4: quatro KPIs primários no dashboard: animais ativos, peso médio, lotes ativos e alertas.

## Restrições preservadas

- core local-first;
- funcionamento offline;
- sem serviço pago obrigatório;
- sem dependência de CDN;
- persistência, domínio, IoT, atualização e fluxos de ação existentes permanecem separados da camada visual.

## QA

Os contratos de UI ficam em `tests/dashboard-ui-contract.test.js` e `tests/e2e/dashboard-ui.spec.mjs`, além da suíte funcional já existente.
