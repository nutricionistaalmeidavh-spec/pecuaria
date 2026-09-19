import { Connector } from '../core/connector.js';

export class SerialConnector extends Connector {
  constructor({ transport, ...config } = {}) {
    super(config);
    if (!transport || typeof transport.open !== 'function') {
      throw new TypeError('SerialConnector requires an injected transport');
    }
    this.transport = transport;
    this.serialConfig = Object.freeze({
      port: String(config.port ?? '').trim(),
      baudRate: Number(config.baudRate ?? 9600),
      dataBits: Number(config.dataBits ?? 8),
      stopBits: Number(config.stopBits ?? 1),
      parity: config.parity ?? 'none',
    });
    if (!this.serialConfig.port) throw new TypeError('serial.port is required');
    if (!Number.isFinite(this.serialConfig.baudRate) || this.serialConfig.baudRate <= 0) {
      throw new TypeError('serial.baudRate must be positive');
    }
  }

  async open() {
    await this.transport.open(this.serialConfig, (data) => this.emitData(data));
  }

  async close() {
    if (typeof this.transport.close === 'function') await this.transport.close();
  }

  async write(data) {
    if (typeof this.transport.write !== 'function') throw new Error('Serial transport is read-only');
    return this.transport.write(data);
  }
}
