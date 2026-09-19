import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'pecuaria-tx-'));
  const dbPath = join(dir, 'db.sqlite');
  const db = await openProductPersistence({dbPath, productId: 'agro-pecuaria'});
  return {dir, dbPath, db};
}

test('transaction commits all writes together', async () => {
  const {dir, db} = await fixture();
  try {
    await db.transaction(async tx => {
      await tx.putRecord('a', '1', {ok: 1}, {expectedVersion: 0});
      await tx.putRecord('b', '1', {ok: 2}, {expectedVersion: 0});
    });
    assert.equal((await db.getRecord('a', '1')).payload.ok, 1);
    assert.equal((await db.getRecord('b', '1')).payload.ok, 2);
  } finally {
    await db.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('transaction rolls every write back on failure and survives reopen', async () => {
  const {dir, dbPath, db: opened} = await fixture();
  let db = opened;
  try {
    await assert.rejects(() => db.transaction(async tx => {
      await tx.putRecord('a', '1', {ok: 1}, {expectedVersion: 0});
      throw new Error('forced');
    }), /forced/);
    assert.equal(await db.getRecord('a', '1'), null);
    await db.close();
    db = await openProductPersistence({dbPath, productId: 'agro-pecuaria'});
    assert.equal(await db.getRecord('a', '1'), null);
  } finally {
    try { await db.close(); } catch {}
    await rm(dir, {recursive: true, force: true});
  }
});

test('transaction view does not expose nested transaction entrypoint', async () => {
  const {dir, db} = await fixture();
  try {
    await db.transaction(async tx => {
      assert.equal('transaction' in tx, false);
      await tx.putRecord('a', '1', {ok: true}, {expectedVersion: 0});
    });
  } finally {
    await db.close();
    await rm(dir, {recursive: true, force: true});
  }
});
