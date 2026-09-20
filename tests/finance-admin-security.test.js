import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {SECURITY_POLICY,PRESENTATION_ACCESS,createSecurityService} from '../src/security.js';

async function fixture(){const dir=await mkdtemp(join(tmpdir(),'pecuaria-fin-rbac-'));const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});return{dir,db,async close(){await db.close();await rm(dir,{recursive:true,force:true})}}}
async function auth(role){const f=await fixture(),security=createSecurityService(f.db);await security.bootstrapUser({id:`${role}-1`,username:`${role}-user`,password:'password-123',roles:[role]});const session=await security.authenticate({username:`${role}-user`,password:'password-123'});return{...f,security,session}}
const credentials=result=>({sessionId:result.session.session.id,token:result.session.token});

test('finance screen has explicit write and settlement permissions',()=>{
  assert.equal(PRESENTATION_ACCESS.screens.finance.read,'finance:read');
  assert.equal(PRESENTATION_ACCESS.screens.finance.write,'finance:write');
  assert.equal(PRESENTATION_ACCESS.screens.finance.actions.settleTitle,'finance:settle');
  assert.equal(PRESENTATION_ACCESS.screens.finance.actions.reverseSettlement,'finance:settle');
  assert.equal(PRESENTATION_ACCESS.screens.finance.actions.reconcileStatement,'finance:settle');
  for(const role of ['manager','finance']){assert.ok(SECURITY_POLICY[role].includes('finance:write'));assert.ok(SECURITY_POLICY[role].includes('finance:settle'));}
  for(const role of ['field-operator','viewer']){assert.ok(!SECURITY_POLICY[role].includes('finance:write'));assert.ok(!SECURITY_POLICY[role].includes('finance:settle'));}
});

test('manager and finance role can mutate/settle while field and viewer are denied',async()=>{
  for(const role of ['manager','finance']){const f=await auth(role);try{const input=credentials(f);await f.security.authorize({...input,permission:'finance:write'});await f.security.authorize({...input,permission:'finance:settle'});}finally{await f.close()}}
  for(const role of ['field-operator','viewer']){const f=await auth(role);try{const input=credentials(f);await assert.rejects(()=>f.security.authorize({...input,permission:'finance:write'}),error=>error?.code==='FORBIDDEN');await assert.rejects(()=>f.security.authorize({...input,permission:'finance:settle'}),error=>error?.code==='FORBIDDEN');}finally{await f.close()}}
});
