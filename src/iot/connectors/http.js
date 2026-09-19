import { Connector } from '../core/connector.js';

export class HttpConnector extends Connector {
  constructor({ fetchImpl = globalThis.fetch, ...config } = {}) {
    super(config);
    if (typeof fetchImpl !== 'function') throw new TypeError('HttpConnector requires fetch');
    this.fetchImpl = fetchImpl;
    this.baseUrl = String(config.baseUrl ?? '').replace(/\/$/, '');
    if (!this.baseUrl) throw new TypeError('http.baseUrl is required');
  }

  async open() {}

  async request(path = '', options = {}) {
    const normalizedPath = String(path);
    const url = /^https?:\/\//i.test(normalizedPath)
      ? normalizedPath
      : `${this.baseUrl}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
    const response = await this.fetchImpl(url, { method: 'GET', ...options });
    if (!response.ok) throw new Error(`HTTP device request failed with status ${response.status}`);
    if (typeof response.json === 'function') return response.json();
    return response;
  }
}
