import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {signLicense} from '../shared/packages/licensing/src/index.js';
import {editionFeatures} from '../src/editions.js';
import {installStoredLicense,isStoredLicenseEnforced,loadStoredProductAccess,removeStoredLicense} from '../runtime/license-store.mjs';

const payload=(edition,id)=>({
  licenseId:id,product:'agro-pecuaria',customerId:'customer-1',
  issuedAt:'2026-09-26T12:00:00.000Z',features:editionFeatures(edition)
});

test('stored signed license upgrades edition without changing data directory',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pecuaria-license-store-'));
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  try{
    const fallback=await loadStoredProductAccess({dataDir,publicKey,edition:'pro'});
    assert.equal(fallback.edition,'pro');
    assert.equal(fallback.licensed,false);

    const essentialToken=signLicense(payload('essential','lic-essential'),privateKey);
    const essential=await installStoredLicense({dataDir,token:essentialToken,publicKey,now:'2026-09-26T13:00:00.000Z'});
    assert.equal(essential.edition,'essential');
    assert.equal(await isStoredLicenseEnforced(dataDir),true);
    assert.equal((await loadStoredProductAccess({dataDir,publicKey,now:'2026-09-26T13:00:00.000Z'})).edition,'essential');

    const managementToken=signLicense(payload('management','lic-management'),privateKey);
    const management=await installStoredLicense({dataDir,token:managementToken,publicKey,now:'2026-09-26T13:00:00.000Z'});
    assert.equal(management.edition,'management');
    assert.equal((await loadStoredProductAccess({dataDir,publicKey,now:'2026-09-26T13:00:00.000Z'})).edition,'management');

    await removeStoredLicense({dataDir});
    await assert.rejects(()=>loadStoredProductAccess({dataDir,publicKey,edition:'pro'}),error=>error?.code==='LICENSE_REQUIRED');
  }finally{
    await rm(dataDir,{recursive:true,force:true});
  }
});

test('invalid stored upgrade is rejected before replacing valid entitlement',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pecuaria-license-invalid-'));
  const trusted=generateKeyPairSync('ed25519'),attacker=generateKeyPairSync('ed25519');
  try{
    const valid=signLicense(payload('essential','valid'),trusted.privateKey);
    await installStoredLicense({dataDir,token:valid,publicKey:trusted.publicKey,now:'2026-09-26T13:00:00.000Z'});
    const forged=signLicense(payload('pro','forged'),attacker.privateKey);
    await assert.rejects(()=>installStoredLicense({dataDir,token:forged,publicKey:trusted.publicKey,now:'2026-09-26T13:00:00.000Z'}),error=>error?.code==='LICENSE_INVALID');
    assert.equal((await loadStoredProductAccess({dataDir,publicKey:trusted.publicKey,now:'2026-09-26T13:00:00.000Z'})).edition,'essential');
  }finally{
    await rm(dataDir,{recursive:true,force:true});
  }
});
