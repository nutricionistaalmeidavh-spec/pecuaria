import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entryUrl = new URL('../src/iot/index.js', import.meta.url);
const hasIotModule = existsSync(fileURLToPath(entryUrl));
const iot = hasIotModule ? await import(entryUrl) : null;

test('P0 exposes an isolated IoT entrypoint', () => {
  assert.equal(hasIotModule, true);
});

test('DeviceRegistry registers, lists and protects device identity', { skip: !iot }, () => {
  const registry = new iot.DeviceRegistry();
  const device = registry.register({
    id: 'scale-corral-01',
    kind: 'scale',
    name: 'Balança Curral',
    farmId: 'farm-01',
    connector: 'serial',
    enabled: true,
  });

  assert.equal(device.id, 'scale-corral-01');
  assert.equal(device.status, 'disconnected');
  assert.deepEqual(registry.list({ farmId: 'farm-01' }).map(({ id }) => id), ['scale-corral-01']);
  assert.throws(() => registry.register({ ...device }), /already registered/i);
});

test('telemetry events are normalized without coupling to cattle domain', { skip: !iot }, () => {
  const event = iot.createTelemetryEvent({
    deviceId: 'scale-corral-01',
    kind: 'weight',
    value: '481.7',
    unit: 'kg',
    timestamp: '2026-09-19T17:31:00-03:00',
    metadata: { source: 'serial' },
  });

  assert.equal(event.deviceId, 'scale-corral-01');
  assert.equal(event.kind, 'weight');
  assert.equal(event.value, 481.7);
  assert.equal(event.unit, 'kg');
  assert.equal(event.timestamp, '2026-09-19T20:31:00.000Z');
  assert.deepEqual(event.metadata, { source: 'serial' });
});

test('RFID adapter normalizes common reader payloads', { skip: !iot }, () => {
  assert.deepEqual(iot.normalizeRfidReading(' 982000411823945\r\n '), {
    kind: 'rfid',
    tagId: '982000411823945',
  });
  assert.throws(() => iot.normalizeRfidReading(''), /RFID/i);
});

test('scale adapter extracts a stable numeric weight', { skip: !iot }, () => {
  assert.deepEqual(iot.normalizeScaleReading('ST,GS,+00481.70 kg'), {
    kind: 'weight',
    value: 481.7,
    unit: 'kg',
    stable: true,
  });
  assert.deepEqual(iot.normalizeScaleReading('-12,5 kg'), {
    kind: 'weight',
    value: -12.5,
    unit: 'kg',
    stable: false,
  });
});

test('Connector base class manages lifecycle and data listeners', { skip: !iot }, async () => {
  class FakeConnector extends iot.Connector {
    async open() { this.markConnected(); }
    async close() { this.markDisconnected(); }
  }

  const connector = new FakeConnector({ id: 'fake-01' });
  const received = [];
  const unsubscribe = connector.onData((payload) => received.push(payload));

  assert.equal(connector.status, 'disconnected');
  await connector.connect();
  assert.equal(connector.status, 'connected');
  connector.emitData({ value: 1 });
  unsubscribe();
  connector.emitData({ value: 2 });
  assert.deepEqual(received, [{ value: 1 }]);
  await connector.disconnect();
  assert.equal(connector.status, 'disconnected');
});

test('SerialConnector is dependency-free and delegates to injected transport', { skip: !iot }, async () => {
  const calls = [];
  const transport = {
    async open(config, onData) { calls.push(['open', config.port]); this.onData = onData; },
    async close() { calls.push(['close']); },
    async write(data) { calls.push(['write', data]); },
  };
  const connector = new iot.SerialConnector({ id: 'serial-01', port: 'COM4', baudRate: 9600, transport });
  const received = [];
  connector.onData((data) => received.push(data));

  await connector.connect();
  transport.onData('RFID-123');
  await connector.write('PING');
  await connector.disconnect();

  assert.deepEqual(received, ['RFID-123']);
  assert.deepEqual(calls, [['open', 'COM4'], ['write', 'PING'], ['close']]);
});

test('MqttConnector delegates to an injected MQTT client and subscribes locally', { skip: !iot }, async () => {
  const calls = [];
  const handlers = new Map();
  const client = {
    on(event, handler) { handlers.set(event, handler); },
    subscribe(topic) { calls.push(['subscribe', topic]); },
    publish(topic, payload) { calls.push(['publish', topic, payload]); },
    end() { calls.push(['end']); },
  };
  const connector = new iot.MqttConnector({
    id: 'mqtt-01',
    url: 'mqtt://192.168.1.10:1883',
    topics: ['pecuaria/farm-01/#'],
    clientFactory: () => client,
  });
  const received = [];
  connector.onData((message) => received.push(message));

  await connector.connect();
  handlers.get('connect')();
  handlers.get('message')('pecuaria/farm-01/weight', Buffer.from('481.7'));
  await connector.publish('pecuaria/farm-01/cmd', 'tare');
  await connector.disconnect();

  assert.deepEqual(received, [{ topic: 'pecuaria/farm-01/weight', payload: '481.7' }]);
  assert.deepEqual(calls, [
    ['subscribe', 'pecuaria/farm-01/#'],
    ['publish', 'pecuaria/farm-01/cmd', 'tare'],
    ['end'],
  ]);
});

test('HttpConnector uses injected fetch and does not require a cloud service', { skip: !iot }, async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push([url, options.method]);
    return { ok: true, status: 200, json: async () => ({ weight: 481.7 }) };
  };
  const connector = new iot.HttpConnector({ id: 'http-01', baseUrl: 'http://192.168.1.20', fetchImpl });

  await connector.connect();
  const result = await connector.request('/weight');
  await connector.disconnect();

  assert.deepEqual(result, { weight: 481.7 });
  assert.deepEqual(calls, [['http://192.168.1.20/weight', 'GET']]);
});
