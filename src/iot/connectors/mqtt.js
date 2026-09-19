import { Connector } from '../core/connector.js';

export class MqttConnector extends Connector {
  constructor({ clientFactory, topics = [], ...config } = {}) {
    super(config);
    if (typeof clientFactory !== 'function') {
      throw new TypeError('MqttConnector requires an injected clientFactory');
    }
    this.url = String(config.url ?? '').trim();
    if (!this.url) throw new TypeError('mqtt.url is required');
    this.clientFactory = clientFactory;
    this.topics = [...topics];
    this.client = null;
  }

  async open() {
    this.client = await this.clientFactory(this.url, this.config.options ?? {});
    if (!this.client || typeof this.client.on !== 'function') {
      throw new TypeError('MQTT client must expose on()');
    }

    this.client.on('connect', () => {
      this.markConnected();
      for (const topic of this.topics) this.client.subscribe(topic);
    });
    this.client.on('message', (topic, payload) => {
      this.emitData({ topic: String(topic), payload: Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload) });
    });
    this.client.on('close', () => this.markDisconnected());
  }

  async close() {
    if (this.client && typeof this.client.end === 'function') await this.client.end();
    this.client = null;
  }

  async publish(topic, payload) {
    if (!this.client || typeof this.client.publish !== 'function') throw new Error('MQTT client is not connected');
    return this.client.publish(String(topic), payload);
  }
}
