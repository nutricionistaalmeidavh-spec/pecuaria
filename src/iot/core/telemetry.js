function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

function normalizeValue(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('telemetry.value must be finite');
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value.replace(',', '.'));
    if (Number.isFinite(numeric)) return numeric;
    return value;
  }

  if (value === undefined) throw new TypeError('telemetry.value is required');
  return value;
}

export function createTelemetryEvent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('telemetry input is required');

  const date = input.timestamp == null ? new Date() : new Date(input.timestamp);
  if (Number.isNaN(date.getTime())) throw new TypeError('telemetry.timestamp is invalid');

  return Object.freeze({
    deviceId: requiredText(input.deviceId, 'telemetry.deviceId'),
    kind: requiredText(input.kind, 'telemetry.kind'),
    value: normalizeValue(input.value),
    unit: input.unit == null ? null : String(input.unit).trim() || null,
    timestamp: date.toISOString(),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
