export function normalizeScaleReading(payload) {
  const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '');
  const match = raw.match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!match) throw new TypeError('Scale reading does not contain a numeric weight');

  const value = Number(match[0].replace(',', '.'));
  if (!Number.isFinite(value)) throw new TypeError('Scale weight is invalid');

  const unitMatch = raw.match(/\b(kg|g|lb|lbs)\b/i);
  const unit = (unitMatch?.[1] ?? 'kg').toLowerCase().replace('lbs', 'lb');
  const stable = /(^|[,;\s])ST([,;\s]|$)/i.test(raw);

  return Object.freeze({ kind: 'weight', value, unit, stable });
}
