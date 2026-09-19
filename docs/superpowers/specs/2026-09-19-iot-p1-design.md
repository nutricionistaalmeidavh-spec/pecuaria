# IoT P1 Local Design — ArtiSys Pecuária

## Objetivo

Transformar a fundação IoT P0 em integração local utilizável pelo cliente, sem servidor ArtiSys, sem SaaS obrigatório e sem custo recorrente para a ArtiSys.

## Restrições

- Core e operação: R$ 0/mês para a ArtiSys.
- Hardware, rede, broker MQTT e equipamentos pertencem ao cliente.
- Funciona offline na LAN/PC da fazenda.
- Nenhum dado IoT depende de nuvem ArtiSys.
- Integrações de fabricante continuam por adapters; protocolos proprietários não são prometidos como plug-and-play.
- P1 suporta conectores genéricos Serial/USB, MQTT e HTTP e um simulador local.
- Credenciais locais não devem aparecer em auditoria, UI de listagem ou telemetria.

## Entregáveis

1. Registry persistente de dispositivos e vínculos RFID.
2. Perfis genéricos: RFID serial, balança serial, RFID MQTT, balança MQTT, RFID HTTP, balança HTTP e simulador.
3. Driver Serial real via `serialport` e cliente MQTT real via `mqtt`; HTTP usa `fetch` nativo.
4. Device manager com start/stop/test/listagem de portas e status.
5. Correlação por estação: RFID identifica animal; pesagem estável subsequente registra peso no animal vinculado.
6. Simulador para validar fluxo completo sem hardware.
7. Tela `Dispositivos e IoT` com cadastro, teste, ativação e vínculo RFID → animal.
8. Segurança: administração/configuração IoT apenas por `admin`; leitura por `manager` e `admin`.
9. Testes de unidade/integração e CI exclusivo da branch.

## Compatibilidade

P1 torna utilizáveis equipamentos que exponham dados por um protocolo suportado e formato configurável. Equipamentos com protocolo binário/proprietário podem exigir adapter específico posteriormente.
