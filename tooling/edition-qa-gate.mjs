import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createStandaloneHost} from '../runtime/host.mjs';
import {COMMERCIAL_CATALOG,upgradeQuote} from '../src/edition-commerce.js';
import {createDistributionManifest} from '../src/distribution.js';

const expected=Object.freeze({
  essential:['overview','lots','animals','weights','sanitary','data','settings'],
  management:['overview','lots','animals','weights','sanitary','reproduction','trades','finance','reports','traceability','inventory','pastures','nutrition','tasks','data','settings'],
  pro:['overview','lots','animals','weights','sanitary','reproduction','trades','finance','reports','traceability','inventory','pastures','nutrition','tasks','data','iot','settings']
});

const artifactDir=resolve('qa-artifacts');
await mkdir(artifactDir,{recursive:true});
const report={generatedAt:new Date().toISOString(),product:'agro-pecuaria',editions:{},commerce:{},distribution:null};

for(const edition of Object.keys(expected)){
  const dataDir=await mkdtemp(join(tmpdir(),`pecuaria-edition-qa-${edition}-`));
  let host;
  try{
    host=await createStandaloneHost({dataDir,edition});
    await host.backend.bootstrap({username:'admin',password:'Edition-QA-2026!'});
    const login=await host.backend.login({username:'admin',password:'Edition-QA-2026!'});
    const auth={sessionId:login.session.id,token:login.token};
    const description=await host.backend.describe(auth);
    const ids=description.navigation.map(item=>item.id);
    assert.deepEqual(ids,expected[edition],`${edition} navigation contract drifted`);
    assert.equal(description.edition.id,edition);
    assert.equal(description.edition.features.length>0,true);
    const backup=await host.recovery.createBackup({id:`qa-${edition}`});
    assert.equal(backup.verified,true);
    report.editions[edition]={screens:ids,features:description.edition.features.length,backupVerified:backup.verified};
  }finally{
    await host?.close?.();
    await rm(dataDir,{recursive:true,force:true});
  }
}

report.commerce={
  products:COMMERCIAL_CATALOG.map(item=>({sku:item.sku,edition:item.edition,priceBrl:item.priceBrl})),
  upgrades:[
    upgradeQuote('essential','management'),
    upgradeQuote('management','pro'),
    upgradeQuote('essential','pro')
  ]
};
report.distribution=createDistributionManifest({version:'contract'});
assert.equal(report.distribution.artifacts.length,1);
assert.equal(report.distribution.requiresEditionSpecificBuild,false);

await writeFile(join(artifactDir,'edition-contracts.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log('Edition QA gate: OK (Essential, Management, Pro)');
