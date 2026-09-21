export function normalizeRfidReading(payload) {
  const raw = globalThis.Buffer?.isBuffer?.(payload) ? payload.toString('utf8') : String(payload ?? '');
  const tagId = raw.replace(/[\r\n\t]/g, '').trim();
  if (!tagId) throw new TypeError('RFID reading is empty');
  return Object.freeze({ kind: 'rfid', tagId });
}
