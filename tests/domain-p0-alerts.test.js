import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattleAlertsService} from '../src/services/alerts.js';

test('active sanitary withdrawal is visible in operational alerts',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-withdrawal-alert-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  try{
    await db.putRecord('cattle.events','san-1',{
      id:'san-1',
      kind:'sanitary',
      animalId:'a1',
      occurredAt:'2026-09-20T12:00:00.000Z',
      withdrawalUntil:'2026-09-30T12:00:00.000Z'
    },{expectedVersion:0});
    const alerts=createCattleAlertsService({persistence:db,now:()=>new Date('2026-09-25T12:00:00.000Z')});
    const list=await alerts.list();
    const alert=list.find(item=>item.kind==='sanitary-withdrawal-active');
    assert.ok(alert);
    assert.equal(alert.animalId,'a1');
    assert.equal(alert.dueAt,'2026-09-30T12:00:00.000Z');
    assert.equal(alert.target,'sanitary');
  }finally{
    await db.close();
    await rm(dir,{recursive:true,force:true});
  }
});
