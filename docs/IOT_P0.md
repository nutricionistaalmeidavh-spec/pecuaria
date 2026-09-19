# IoT-ready P0 — ArtiSys Pecuária

## Objetivo

Preparar o produto para integrações locais futuras sem criar custo recorrente para a ArtiSys e sem acoplar o domínio atual a hardware, nuvem ou fornecedores específicos.

## Princípios obrigatórios

- Core com custo recorrente **R$ 0**.
- Nenhum servidor ArtiSys é necessário para o módulo IoT.
- Nenhum SaaS, API paga ou broker hospedado é dependência do produto.
- Hardware e infraestrutura pertencem ao cliente.
- Integrações são opcionais e entram por adapters/connectors.
- O P0 não altera animais, lotes, pesagens, reprodução, estoque, financeiro ou UI atual.

## Estrutura

```text
src/iot/
  core/
    connector.js
    device-registry.js
    telemetry.js
  connectors/
    serial.js
    mqtt.js
    http.js
  adapters/
    rfid.js
    scale.js
  index.js
```

## Contratos

### DeviceRegistry

Mantém metadados de dispositivos em memória e protege IDs duplicados. Persistência definitiva fica fora do P0 para evitar migração de banco enquanto o hardening principal evolui em paralelo.

### Telemetry

`createTelemetryEvent()` produz eventos neutros ao domínio. Um evento sabe apenas dispositivo, tipo, valor, unidade, instante e metadados.

### Connector

Contrato de ciclo de vida (`connect`, `disconnect`, `status`) e assinatura de dados (`onData`). O domínio do Pecuária não precisa conhecer porta COM, MQTT ou HTTP.

### SerialConnector

Não adiciona `serialport` ou outra dependência. Recebe um `transport` injetado. Quando houver um equipamento real, um adapter de infraestrutura poderá usar a biblioteca/driver exigido pelo fabricante.

### MqttConnector

Não instala nem hospeda broker. Recebe `clientFactory` injetado e pode apontar para um Mosquitto/ChirpStack/broker existente na rede do cliente.

### HttpConnector

Usa `fetch` ou implementação injetada e pode acessar equipamentos HTTP existentes na LAN do cliente.

### RFID e balança

Os adapters normalizam leituras brutas. Eles não gravam animais nem pesagens no P0. Esse acoplamento será feito somente em uma fase posterior e depois de estabilizar o trabalho paralelo.

## Fora do P0

- tela de cadastro IoT;
- tabelas/migrações no banco principal;
- vínculo RFID → animal;
- criação automática de pesagem;
- drivers de fabricantes;
- Bluetooth, Modbus e LoRaWAN;
- gateway distribuído;
- comandos remotos de bombas/porteiras;
- qualquer serviço cloud da ArtiSys.

## Segurança para desenvolvimento paralelo

O módulo é acessível somente por `src/iot/index.js`. Nenhum arquivo de domínio existente importa o módulo IoT. Assim, a branch pode ser atualizada/rebaseada sobre o hardening principal com baixa chance de conflito.
