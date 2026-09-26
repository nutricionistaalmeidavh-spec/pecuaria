import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {EDITIONS} from '../src/editions.js';
import {EDITION_UX,editionUxProfile} from '../src/edition-ux.js';
import {COMMERCIAL_CATALOG,upgradeQuote} from '../src/edition-commerce.js';
import {createDistributionManifest} from '../src/distribution.js';
import {clearLocalTelemetry,getLocalTelemetryState,recordLocalTelemetry,setLocalTelemetryContext,setLocalTelemetryEnabled} from '../web/p2-runtime.js';

test('F5 edition UX is progressively deeper without locked-menu clutter',()=>{
  const essential=editionUxProfile('essential');
  const management=editionUxProfile('management');
  const pro=editionUxProfile('pro');
  assert.equal(essential.label,'Essencial');
  assert.equal(management.label,'Gestão');
  assert.equal(pro.label,'Pro');
  assert.equal(essential.showUpgradeHint,true);
  assert.equal(management.showUpgradeHint,true);
  assert.equal(pro.showUpgradeHint,false);
  assert.equal(essential.sections.includes('finance-admin'),false);
  assert.equal(management.sections.includes('finance-admin'),false);
  assert.equal(pro.sections.includes('finance-admin'),true);
  assert.equal(essential.sections.includes('field-offline'),false);
  assert.equal(management.sections.includes('field-offline'),false);
  assert.equal(pro.sections.includes('field-offline'),true);
  assert.deepEqual(Object.keys(EDITION_UX),['essential','management','pro']);
});

test('F6 same database survives upgrade and downgrade without destructive migration',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pecuaria-edition-continuity-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir,edition:'essential'});
    const before=await host.persistence.schemaState();
    await host.persistence.putRecord('cattle.animals','animal-1',{id:'animal-1',tag:'001',status:'active',sex:'female'},{expectedVersion:0});
    await host.close();host=null;

    for(const edition of ['management','pro']){
      host=await createStandaloneHost({dataDir,edition});
      assert.equal((await host.persistence.getRecord('cattle.animals','animal-1')).payload.tag,'001');
      assert.equal((await host.persistence.schemaState()).productId,before.productId);
      await host.close();host=null;
    }

    host=await createStandaloneHost({dataDir,edition:'pro'});
    await host.persistence.putRecord('cattle.finance-accounts','pro-account',{id:'pro-account',name:'Conta Pro'},{expectedVersion:0});
    await host.close();host=null;

    host=await createStandaloneHost({dataDir,edition:'essential'});
    assert.equal((await host.persistence.getRecord('cattle.animals','animal-1')).payload.tag,'001');
    assert.equal((await host.persistence.getRecord('cattle.finance-accounts','pro-account')).payload.name,'Conta Pro');
  }finally{
    await host?.close?.();
    await rm(dataDir,{recursive:true,force:true});
  }
});

test('F8 distribution uses one installer/codebase for every commercial SKU',()=>{
  const manifest=createDistributionManifest({version:'1.1.0'});
  assert.equal(manifest.strategy,'single-installer');
  assert.equal(manifest.artifacts.length,1);
  assert.equal(manifest.artifacts[0].file,'ArtiSys-Pecuaria-Setup-1.1.0.exe');
  assert.deepEqual(manifest.editions,['essential','management','pro']);
  assert.deepEqual(manifest.skus,COMMERCIAL_CATALOG.map(item=>item.sku));
});

test('F9 commercial catalog and upgrade differences are deterministic',()=>{
  assert.deepEqual(COMMERCIAL_CATALOG.map(item=>[item.edition,item.priceBrl]),[
    ['essential',39],['management',120],['pro',330]
  ]);
  assert.equal(upgradeQuote('essential','management').amountBrl,81);
  assert.equal(upgradeQuote('management','pro').amountBrl,210);
  assert.equal(upgradeQuote('essential','pro').amountBrl,291);
  assert.throws(()=>upgradeQuote('pro','management'),error=>error?.code==='INVALID_EDITION_UPGRADE');
  for(const item of COMMERCIAL_CATALOG){
    assert.deepEqual(item.features,EDITIONS[item.edition].features);
    assert.equal(item.saleModel,'one-time');
  }
});

test('F10 local telemetry is opt-in and carries only technical edition context',()=>{
  const memory=new Map();
  const previous=globalThis.localStorage;
  globalThis.localStorage={
    getItem:key=>memory.has(key)?memory.get(key):null,
    setItem:(key,value)=>memory.set(key,String(value)),
    removeItem:key=>memory.delete(key)
  };
  try{
    setLocalTelemetryContext({
      version:'1.1.0',edition:'management',features:['animals.basic','finance.production'],
      migrations:['001','002'],lastBackupAt:'2026-09-26T12:00:00.000Z',
      email:'should-not-be-recorded@example.com',customerName:'Secret Customer'
    });
    assert.equal(recordLocalTelemetry('app.start',{surface:'desktop'}),false);
    assert.equal(getLocalTelemetryState().events.length,0);
    setLocalTelemetryEnabled(true);
    assert.equal(recordLocalTelemetry('app.start',{surface:'desktop',email:'blocked@example.com'}),true);
    const [event]=getLocalTelemetryState().events;
    assert.equal(event.context.edition,'management');
    assert.equal(event.context.version,'1.1.0');
    assert.deepEqual(event.context.features,['animals.basic','finance.production']);
    assert.equal('email' in event.context,false);
    assert.equal('customerName' in event.context,false);
    assert.equal('email' in event.detail,false);
    clearLocalTelemetry();
  }finally{
    if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;
  }
});
