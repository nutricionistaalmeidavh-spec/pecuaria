function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

export class DeviceRegistry {
  #devices = new Map();

  register(input) {
    if (!input || typeof input !== 'object') throw new TypeError('device is required');

    const id = requiredText(input.id, 'device.id');
    if (this.#devices.has(id)) throw new Error(`Device ${id} is already registered`);

    const device = Object.freeze({
      ...input,
      id,
      kind: requiredText(input.kind, 'device.kind'),
      name: requiredText(input.name, 'device.name'),
      farmId: input.farmId == null ? null : String(input.farmId).trim() || null,
      connector: requiredText(input.connector, 'device.connector'),
      enabled: input.enabled !== false,
      status: input.status ?? 'disconnected',
    });

    this.#devices.set(id, device);
    return device;
  }

  get(id) {
    return this.#devices.get(String(id)) ?? null;
  }

  list(filters = {}) {
    return [...this.#devices.values()].filter((device) => {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && device[key] !== value) return false;
      }
      return true;
    });
  }

  remove(id) {
    return this.#devices.delete(String(id));
  }

  clear() {
    this.#devices.clear();
  }
}
