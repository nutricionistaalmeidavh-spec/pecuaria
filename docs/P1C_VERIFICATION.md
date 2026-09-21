# P1C — Campo Offline Completo: verificação

Checkpoint de certificação da branch `p1-operational-depth`.

Superfície esperada após P1C:
- 17 telas principais;
- 62 ações de apresentação contratadas;
- 17 RPCs;
- `animals.registerBirth` exposto por formulário tipado e pelo fluxo de campo;
- quick operations mantidas como aliases do `fieldSync`, sem novos RPCs;
- sincronização local AES-GCM e idempotência por `operation.id`/receipts preservadas.

Este commit existe também para disparar os gates sobre o código gerado no commit anterior pelo GitHub Actions, já que pushes feitos com `GITHUB_TOKEN` não iniciam outra rodada de workflows automaticamente.
