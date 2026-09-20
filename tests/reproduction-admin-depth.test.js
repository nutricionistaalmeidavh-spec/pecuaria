import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createReproductionManagementService} from '../src/reproduction-management.js';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-repro-admin-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

const authArgs=session=>({sessionId:session.session.id,token:session.token});

test('professional reproduction manages genetics, semen doses, breeding seasons and efficiency',async()=>{
  const f=await fixture();
  try{
    await f.db.putRecord('cattle.animals','cow-1',{id:'cow-1',tag:'M001',sex:'female',status:'active',lotId:null,weights:[],movements:[],lifecycle:[]},{expectedVersion:0});
    const service=createReproductionManagementService(f.db);

    await service.saveGenetics({id:'gen-bull',type:'bull',name:'Touro Alpha',registry:'RGD-1',breed:'Nelore',active:true},{actorId:'admin'});
    await service.saveGenetics({id:'gen-semen',type:'semen',name:'Sêmen Alpha',registry:'RGD-1',breed:'Nelore',active:true},{actorId:'admin'});
    await service.saveDoseStock({id:'dose-1',geneticsId:'gen-semen',batch:'B001',quantityDoses:2,minDoses:1,expiresAt:'2027-01-01T00:00:00.000Z',costPerDoseMinor:2500,active:true},{actorId:'admin'});
    await service.saveBreedingSeason({id:'season-26',name:'Estação 2026/27',startAt:'2026-10-01T00:00:00.000Z',endAt:'2027-01-31T23:59:59.000Z',status:'planned',targetConceptionPct:55},{actorId:'admin'});

    const recorded=await service.recordProfessionalService({id:'service-1',animalId:'cow-1',occurredAt:'2026-10-10T12:00:00.000Z',method:'iatf',protocol:'IATF 8 dias',geneticsId:'gen-semen',doseStockId:'dose-1',breedingSeasonId:'season-26',dosesUsed:1,expectedCalvingAt:'2027-07-19T12:00:00.000Z'},{actorId:'admin'});
    assert.equal(recorded.payload.metadata.geneticsId,'gen-semen');
    assert.equal(recorded.payload.metadata.breedingSeasonId,'season-26');
    assert.equal((await f.db.getRecord('cattle.reproduction-dose-stock','dose-1')).payload.quantityDoses,1);
    await assert.rejects(()=>service.adjustDoseStock({id:'dose-1',delta:-2},{actorId:'admin'}),/Insufficient semen doses/);

    await service.adjustDoseStock({id:'dose-1',delta:2,reason:'Conferência física',occurredAt:'2026-10-11T12:00:00.000Z'},{actorId:'admin'});
    let dose=await f.db.getRecord('cattle.reproduction-dose-stock','dose-1');
    assert.equal(dose.payload.quantityDoses,3);
    assert.equal(dose.payload.lastAdjustment.delta,2);
    assert.equal(dose.payload.lastAdjustment.reason,'Conferência física');

    await service.saveDoseStock({id:'dose-1',geneticsId:'gen-semen',batch:'B001',quantityDoses:3,minDoses:2,expiresAt:'2027-02-01T00:00:00.000Z',costPerDoseMinor:2600,active:false,notes:'Atualizado após inventário'},{actorId:'admin'});
    dose=await f.db.getRecord('cattle.reproduction-dose-stock','dose-1');
    assert.equal(dose.payload.active,false);
    assert.equal(dose.payload.notes,'Atualizado após inventário');
    assert.equal(dose.payload.lastAdjustment.delta,2);
    assert.equal(dose.payload.lastAdjustment.reason,'Conferência física');

    await f.db.putRecord('cattle.events','check-1',{id:'check-1',kind:'reproduction',animalId:'cow-1',relatedAnimalId:null,type:'pregnancy-check',occurredAt:'2026-11-10T12:00:00.000Z',metadata:{result:'positive'}},{expectedVersion:0});
    const state=await service.load();
    assert.equal(state.genetics.length,2);
    assert.equal(state.doseStocks[0].payload.quantityDoses,3);
    assert.equal(state.seasons[0].payload.id,'season-26');
    assert.equal(state.efficiency.byProtocol.find(x=>x.key==='IATF 8 dias').conceptionRatePct,100);
    assert.equal(state.efficiency.byGenetics.find(x=>x.key==='gen-semen').conceptionRatePct,100);
    assert.equal(state.efficiency.bySeason.find(x=>x.key==='season-26').conceptionRatePct,100);
  }finally{await f.cleanup()}
});

test('local user administration creates and edits users, exposes profile matrix and audits changes',async()=>{
  const f=await fixture();
  try{
    const security=createCattlePresentation({persistence:f.db}).services.security;
    await security.bootstrapUser({id:'admin-1',username:'admin',password:'12345678',roles:['admin']});
    const adminSession=await security.authenticate({username:'admin',password:'12345678'});
    const auth=authArgs(adminSession);

    const profiles=await security.listProfiles(auth);
    assert.ok(profiles.some(x=>x.id==='manager'));
    assert.ok(profiles.some(x=>x.id==='field-operator'));
    assert.ok(profiles.find(x=>x.id==='admin').permissions.includes('*'));

    await security.createUser({...auth,user:{id:'user-1',username:'campo',password:'abcdefgh',roles:['field-operator'],active:true}});
    let users=await security.listUsers(auth);
    assert.equal(users.find(x=>x.id==='user-1').roles[0],'field-operator');

    await security.updateUser({...auth,id:'user-1',changes:{roles:['finance'],active:true}});
    users=await security.listUsers(auth);
    assert.deepEqual(users.find(x=>x.id==='user-1').roles,['finance']);

    await security.resetUserPassword({...auth,id:'user-1',password:'ijklmnop'});
    await assert.rejects(()=>security.authenticate({username:'campo',password:'abcdefgh'}),/invalid credentials/);
    const financeSession=await security.authenticate({username:'campo',password:'ijklmnop'});
    assert.ok(financeSession.session.id);
    await assert.rejects(()=>security.listUsers(authArgs(financeSession)),/permission denied: security:admin/);

    await assert.rejects(()=>security.updateUser({...auth,id:'admin-1',changes:{active:false}}),/last active admin/i);
    const audit=await security.listAudit({...auth,limit:100});
    const actions=audit.map(x=>x.payload?.action??x.action);
    assert.ok(actions.includes('security.user.create'));
    assert.ok(actions.includes('security.user.update'));
    assert.ok(actions.includes('security.user.password.reset'));
  }finally{await f.cleanup()}
});

test('desktop RPC and existing screens expose professional reproduction and user administration',async()=>{
  const files=await Promise.all([
    readFile(new URL('../runtime/backend.mjs',import.meta.url),'utf8'),
    readFile(new URL('../electron/main.mjs',import.meta.url),'utf8'),
    readFile(new URL('../electron/preload.cjs',import.meta.url),'utf8'),
    readFile(new URL('../web/main.jsx',import.meta.url),'utf8'),
    readFile(new URL('../web/pro-management.jsx',import.meta.url),'utf8').catch(()=>''),
  ]);
  const combined=files.join('\n');
  for(const method of ['reproductionAdmin','userAdmin'])assert.match(combined,new RegExp(method));
  for(const id of ['professional-reproduction','genetics-register','semen-dose-stock','semen-dose-adjustment','breeding-season','reproduction-efficiency','user-administration','permission-matrix'])assert.match(combined,new RegExp(`data-testid=["']${id}["']`));
  for(const label of ['Estoque de doses','Ajustar estoque','Motivo do ajuste','Doses utilizadas','Estação de monta','Eficiência por protocolo','Eficiência por reprodutor','Eficiência por estação','Criar usuário','Perfis e permissões'])assert.match(combined,new RegExp(label));
});
