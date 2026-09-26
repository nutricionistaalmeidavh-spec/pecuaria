import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {resolveFeatureFlag,isFeatureEnabled as flagEnabled,mergeFeatureFlags} from '../shared/packages/feature-flags/src/index.js';
import {createLicensePayload,signLicense,verifyLicense,isFeatureEnabled as licensedFeatureEnabled} from '../shared/packages/licensing/src/index.js';
import {createEditionAccess,editionFeatures} from '../src/editions.js';
import {resolveProductAccess} from '../runtime/license.mjs';

test('feature flags resolve user over tenant over defaults and unknown flags fail closed',()=>{
  const context={defaults:{alpha:true,beta:false},tenantFlags:{beta:true},userFlags:{beta:false,gamma:true}};
  assert.equal(resolveFeatureFlag('alpha',context),true);
  assert.equal(resolveFeatureFlag('beta',context),false);
  assert.equal(resolveFeatureFlag('gamma',context),true);
  assert.equal(resolveFeatureFlag('unknown',context),false);
  assert.equal(flagEnabled('alpha',context),true);
  assert.deepEqual(mergeFeatureFlags({a:true},{b:false},{a:false}),{a:false,b:false});
});

test('edition presets are cumulative and keep mixed-screen Pro actions out of Management',()=>{
  const essential=createEditionAccess({edition:'essential'});
  const management=createEditionAccess({edition:'management'});
  const pro=createEditionAccess({edition:'pro'});

  for(const feature of editionFeatures('essential')){
    assert.equal(essential.has(feature),true,feature);
    assert.equal(management.has(feature),true,feature);
    assert.equal(pro.has(feature),true,feature);
  }
  for(const feature of editionFeatures('management'))assert.equal(pro.has(feature),true,feature);

  assert.equal(essential.screenEnabled('overview'),true);
  assert.equal(essential.screenEnabled('finance'),false);
  assert.equal(management.screenEnabled('finance'),true);
  assert.equal(management.screenEnabled('iot'),false);
  assert.equal(pro.screenEnabled('iot'),true);

  assert.equal(management.actionEnabled('finance','addCost'),true);
  assert.equal(management.actionEnabled('finance','saveTitle'),false);
  assert.equal(pro.actionEnabled('finance','saveTitle'),true);
  assert.equal(essential.actionEnabled('animals','batchMove'),false);
  assert.equal(management.actionEnabled('animals','batchMove'),true);
  assert.equal(management.actionEnabled('animals','recordBodyCondition'),false);
  assert.equal(pro.actionEnabled('animals','recordBodyCondition'),true);
  assert.equal(pro.has('feature.unknown'),false);
});

test('edition RPC gates separate professional operations from productive management',()=>{
  const essential=createEditionAccess({edition:'essential'});
  const management=createEditionAccess({edition:'management'});
  const pro=createEditionAccess({edition:'pro'});

  assert.equal(essential.rpcEnabled('simulateSale'),false);
  assert.equal(management.rpcEnabled('simulateSale'),true);
  assert.equal(management.rpcEnabled('reproductionAdmin'),false);
  assert.equal(management.rpcEnabled('fieldSync'),false);
  assert.equal(management.rpcEnabled('userAdmin'),false);
  assert.equal(management.rpcEnabled('audit'),false);
  assert.equal(pro.rpcEnabled('reproductionAdmin'),true);
  assert.equal(pro.rpcEnabled('fieldSync'),true);
  assert.equal(pro.rpcEnabled('userAdmin'),true);
  assert.equal(pro.rpcEnabled('audit'),true);
});

test('licensing signs and verifies feature-bearing payloads offline with Ed25519',()=>{
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const payload=createLicensePayload({
    licenseId:'lic-management-1',
    product:'agro-pecuaria',
    customerId:'customer-1',
    issuedAt:'2026-09-26T12:00:00.000Z',
    features:editionFeatures('management')
  });
  const token=signLicense(payload,privateKey);
  const verified=verifyLicense(token,publicKey,{product:'agro-pecuaria',now:'2026-09-26T12:30:00.000Z'});
  assert.equal(verified.valid,true);
  assert.equal(licensedFeatureEnabled(verified.payload,'finance.production'),true);
  assert.equal(licensedFeatureEnabled(verified.payload,'finance.admin'),false);
});

test('valid signed license becomes authoritative product access',()=>{
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const features=editionFeatures('management');
  const token=signLicense({
    licenseId:'lic-management-2',product:'agro-pecuaria',customerId:'customer-2',
    issuedAt:'2026-09-26T12:00:00.000Z',features
  },privateKey);
  const access=resolveProductAccess({licenseToken:token,licensePublicKey:publicKey,now:'2026-09-26T13:00:00.000Z'});
  assert.equal(access.edition,'management');
  assert.equal(access.licensed,true);
  assert.equal(access.has('finance.production'),true);
  assert.equal(access.has('finance.admin'),false);
});

test('invalid or mismatched licenses fail closed',()=>{
  const a=generateKeyPairSync('ed25519');
  const b=generateKeyPairSync('ed25519');
  const base={licenseId:'lic-pro',product:'agro-pecuaria',customerId:'customer-3',issuedAt:'2026-09-26T12:00:00.000Z',features:editionFeatures('pro')};
  const token=signLicense(base,a.privateKey);

  assert.throws(()=>resolveProductAccess({licenseToken:token,licensePublicKey:b.publicKey}),error=>error?.code==='LICENSE_INVALID');

  const otherProduct=signLicense({...base,licenseId:'lic-other',product:'other-product'},a.privateKey);
  assert.throws(()=>resolveProductAccess({licenseToken:otherProduct,licensePublicKey:a.publicKey}),error=>error?.code==='LICENSE_INVALID');

  const deviceToken=signLicense({...base,licenseId:'lic-device',deviceIds:['device-a']},a.privateKey);
  assert.throws(()=>resolveProductAccess({licenseToken:deviceToken,licensePublicKey:a.publicKey,deviceId:'device-b'}),error=>error?.code==='LICENSE_INVALID');

  const expired=signLicense({...base,licenseId:'lic-expired',expiresAt:'2026-09-26T12:10:00.000Z'},a.privateKey);
  assert.throws(()=>resolveProductAccess({licenseToken:expired,licensePublicKey:a.publicKey,now:'2026-09-26T12:11:00.000Z'}),error=>error?.code==='LICENSE_INVALID');
});

test('legacy no-license startup remains Pro unless licensing is explicitly required',()=>{
  const access=resolveProductAccess();
  assert.equal(access.edition,'pro');
  assert.equal(access.licensed,false);
  assert.equal(access.has('finance.admin'),true);
  assert.throws(()=>resolveProductAccess({licenseRequired:true}),error=>error?.code==='LICENSE_REQUIRED');
});
