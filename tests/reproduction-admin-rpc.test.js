import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-admin-rpc-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

test('authenticated RPC connects professional reproduction and user administration end to end',async()=>{
  const f=await fixture();
  try{
    const presentation=createCattlePresentation({persistence:f.db});
    const backend=createRpcBackend({presentation,persistence:f.db});
    await backend.bootstrap({username:'admin',password:'12345678'});
    const login=await backend.login({username:'admin',password:'12345678'});
    const auth={sessionId:login.session.id,token:login.token};

    const adminState=await backend.userAdmin({auth,operation:'state'});
    assert.ok(adminState.profiles.some(profile=>profile.id==='admin'));
    await backend.userAdmin({auth,operation:'create',input:{username:'gestor',password:'abcdefgh',roles:['manager'],active:true}});
    assert.ok((await backend.userAdmin({auth,operation:'state'})).users.some(user=>user.username==='gestor'));

    await f.db.putRecord('cattle.animals','cow-rpc',{id:'cow-rpc',tag:'RPC1',sex:'female',status:'active',lotId:null,weights:[],movements:[],lifecycle:[]},{expectedVersion:0});
    await backend.reproductionAdmin({auth,operation:'saveGenetics',input:{id:'gen-rpc',type:'bull',name:'Touro RPC',active:true}});
    await backend.reproductionAdmin({auth,operation:'saveBreedingSeason',input:{id:'season-rpc',name:'Estação RPC',startAt:'2026-09-01T00:00:00.000Z',endAt:'2026-12-31T23:59:59.000Z',status:'active',targetConceptionPct:60}});
    await backend.reproductionAdmin({auth,operation:'recordService',input:{id:'service-rpc',animalId:'cow-rpc',occurredAt:'2026-10-01T12:00:00.000Z',method:'natural',protocol:'Monta controlada',geneticsId:'gen-rpc',breedingSeasonId:'season-rpc'}});
    const reproduction=await backend.reproductionAdmin({auth,operation:'state'});
    assert.equal(reproduction.genetics[0].payload.name,'Touro RPC');
    assert.equal(reproduction.efficiency.summary.services,1);
  }finally{await f.cleanup()}
});
