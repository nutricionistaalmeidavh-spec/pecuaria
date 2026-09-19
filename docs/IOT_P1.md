# IoT P1 Local — ArtiSys Pecuária

## Escopo

O P1 permite configurar integrações IoT diretamente no computador da fazenda. Nenhum servidor ArtiSys, assinatura, API paga ou infraestrutura em nuvem é obrigatório.

O cliente fornece os equipamentos, drivers de sistema operacional quando exigidos pelo fabricante, rede local e eventual broker MQTT.

## Integrações suportadas

### Serial / USB

Perfis:

- Leitor RFID Serial/USB
- Balança Serial/USB

Configuração disponível:

- porta, por exemplo `COM4`;
- baud rate;
- delimitador de mensagens.

O runtime utiliza `serialport` localmente. O botão **Testar conexão** abre e fecha a porta para validar disponibilidade.

Equipamentos que usam protocolo binário ou comandos proprietários podem exigir um adapter específico do fabricante.

### MQTT

Perfis:

- Leitor RFID MQTT
- Balança MQTT

Configuração disponível:

- URL do broker, por exemplo `mqtt://192.168.1.20:1883`;
- tópicos;
- usuário e senha/token quando necessários.

O broker pertence ao cliente. Pode ser um broker já existente ou um Mosquitto local. O Sistema Pecuária não depende de broker da ArtiSys.

### HTTP local

Perfis:

- Leitor RFID HTTP
- Balança HTTP

Configuração disponível:

- URL local do equipamento;
- caminho do endpoint;
- intervalo de leitura;
- credenciais quando necessárias.

Exemplo:

```text
http://192.168.1.42/api/weight
```

### Simuladores

Perfis:

- Simulador RFID
- Simulador de balança

Servem para validar toda a jornada sem possuir hardware físico.

## Jornada RFID + balança

1. O administrador cadastra o leitor RFID e a balança na mesma estação/curral.
2. O código RFID é vinculado ao cadastro de um animal.
3. O leitor identifica o RFID.
4. O sistema seleciona o animal apenas naquela estação.
5. Uma leitura de peso instável é ignorada.
6. Uma leitura estável dentro da janela de correlação é registrada no animal.
7. O contexto da estação é consumido após a pesagem, evitando atribuir o próximo peso ao animal anterior.

RFID desconhecido limpa o contexto da estação e não pode gerar pesagem no último animal reconhecido.

## Segurança

- Administrador: leitura e configuração IoT.
- Gerente: somente leitura da configuração/status IoT.
- Senhas e tokens não são armazenados junto aos registros normais de dispositivos.
- No desktop, credenciais ficam em armazenamento local criptografado AES-256-GCM.
- Listagens e auditoria não retornam os segredos.

## Inicialização e falhas

Dispositivos marcados como ativos são iniciados localmente quando o host abre.

Falha em um equipamento não impede a abertura do Sistema Pecuária. Cada dispositivo mantém estado independente (`disconnected`, `connecting`, `connected` ou `error`).

## Custos recorrentes

Para a ArtiSys:

- servidor obrigatório: não;
- banco cloud obrigatório: não;
- API paga obrigatória: não;
- broker MQTT ArtiSys: não;
- assinatura IoT: não.

O core permanece compatível com venda por preço único.

## Limite de compatibilidade

O P1 não promete compatibilidade universal com qualquer marca/modelo. Um equipamento funciona diretamente quando consegue entregar suas leituras por um dos transportes suportados e em formato interpretável pelo perfil genérico.

Casos que normalmente exigem adapter específico:

- protocolo binário proprietário;
- checksum/frame específico do fabricante;
- sequência própria de comandos para solicitar leitura;
- SDK proprietário;
- comunicação Bluetooth/Modbus/LoRaWAN sem gateway para Serial, MQTT ou HTTP.

Esses adapters podem ser acrescentados posteriormente sem alterar o domínio principal do Sistema Pecuária.
