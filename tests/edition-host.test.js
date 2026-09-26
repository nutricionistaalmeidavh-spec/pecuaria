import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

test('standalone host injects requested edition into the same backend/codebase',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pecuaria-edition-host-'));
  const host=await createStandaloneHost({dataDir,edition:'essential'});
  try{
    const description=await host.backend.describe();
    assert.equal(description.edition.id,'essential');
    assert.equal(description.edition.licensed,false);
    assert.equal(description.navigation.some(item=>item.id==='finance'),false);
    assert.equal(description.navigation.some(item=>item.id==='iot'),false);
    assert.equal(description.navigation.some(item=>item.id==='animals'),true);
    await assert.rejects(
      ()=>host.backend.maps({operation:'state'}),
      error=>error?.code==='FEATURE_NOT_LICENSED'&&error?.feature==='pastures.advanced'
    );
  }finally{
    await host.close();
    await rm(dataDir,{recursive:true,force:true});
  }
});
