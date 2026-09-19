export class Connector {
  #listeners = new Set();

  constructor(config = {}) {
    this.config = Object.freeze({ ...config });
    this.id = String(config.id ?? '').trim();
    if (!this.id) throw new TypeError('connector.id is required');
    this.status = 'disconnected';
  }

  async connect() {
    if (this.status === 'connected') return;
    this.status = 'connecting';
    try {
      await this.open();
      if (this.status === 'connecting') this.markConnected();
    } catch (error) {
      this.markDisconnected();
      throw error;
    }
  }

  async disconnect() {
    if (this.status === 'disconnected') return;
    this.status = 'disconnecting';
    try {
      await this.close();
    } finally {
      this.markDisconnected();
    }
  }

  async open() {
    throw new Error('Connector.open() must be implemented');
  }

  async close() {}

  markConnected() {
    this.status = 'connected';
  }

  markDisconnected() {
    this.status = 'disconnected';
  }

  onData(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emitData(payload) {
    for (const listener of this.#listeners) listener(payload);
  }
}
