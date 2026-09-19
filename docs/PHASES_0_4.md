# Migração standalone — Fases 0–4

F0 congela baseline e contratos. F1 fixa fronteiras e política R$0/self-hosted/open source. F2 move domínio, migrations, persistência e core necessário para este repositório. F3 adiciona runtime SQLite, backup/restauração, UI própria, Electron, testes e QA Playwright. F4 adiciona release Windows/NSIS, gate Woodpecker e regras de cutover.

O monorepo continua rollback até homologação dos gates; nenhuma exclusão destrutiva é feita nesta fase.
