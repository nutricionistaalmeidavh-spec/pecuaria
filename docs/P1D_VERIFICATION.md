# P1D — Certificação final

Checkpoint final da branch `p1-operational-depth` após integração e limpeza do scaffolding temporário.

Critérios certificados pela pipeline permanente:
- contrato público congelado em 17 telas, 62 ações e 17 RPCs;
- `animals.recordBodyCondition` como ação canônica de escore corporal;
- compatibilidade com dados P0;
- finanças administrativas local-first sem dependência SaaS obrigatória;
- gestão aprofundada de pastagens e condição corporal;
- campo offline com sincronização AES-GCM, idempotência e autorização do destino;
- regressão IoT P0/P1;
- nenhum workflow ou script `apply-p1*` temporário permanece no produto final.

Este checkpoint é intencionalmente versionado para disparar a certificação sobre o HEAD já limpo, pois commits realizados por workflows com `GITHUB_TOKEN` não encadeiam automaticamente outra execução de GitHub Actions.
