import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {SECURITY_POLICY,PRESENTATION_ACCESS,createSecurityService} from '../src/security.js';
import {createAuditService} from '../src/audit.js';
import {createStandaloneHost} from '../runtime/host.mjs';

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-security-'));
  const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});
  return{dir,db,async cleanup(){await db.close();await rm(dir,{recursive:true,force:true})}};
}

async function sessionFor(db,{role='admin',id=role}={}){
  const audit=createAuditService(db,{productId:'agro-pecuaria'});
  const security=createSecurityService(db,{audit});
  await security.bootstrapUser({id,username:`${role}-user`,password:'password-123',roles:[role]});
  const auth=await security.authenticate({username:`${role}-user`,password:'password-123'});
  return{audit,security,auth};
}

test('settings permissions are explicit and restore remains admin-only',()=>{
  assert.equal(PRESENTATION_ACCESS.screens.settings.read,'settings:read');
  assert.equal(PRESENTATION_ACCESS.screens.settings.actions.backup,'settings:backup');
  assert.equal(PRESENTATION_ACCESS.screens.settings.actions.restore,'settings:restore');
  assert.ok(SECURITY_POLICY.manager.includes('settings:read'));
  assert.ok(SECURITY_POLICY.manager.includes('settings:backup'));
  assert.ok(!SECURITY_POLICY.manager.includes('settings:restore'));
  assert.ok(!SECURITY_POLICY.viewer.includes('settings:read'));
});

test('manager can back up but cannot restore; admin can restore',async()=>{
  const managerFixture=await fixture();
  try{
    const {security,auth}=await sessionFor(managerFixture.db,{role:'manager'});
    await security.authorize({sessionId:auth.session.id,token:auth.token,permission:'settings:backup'});
    await assert.rejects(
      ()=>security.authorize({sessionId:auth.session.id,token:auth.token,permission:'settings:restore'}),
      error=>error?.code==='FORBIDDEN'
    );
  }finally{await managerFixture.cleanup()}

  const adminFixture=await fixture();
  try{
    const {security,auth}=await sessionFor(adminFixture.db,{role:'admin'});
    await security.authorize({sessionId:auth.session.id,token:auth.token,permission:'settings:restore'});
  }finally{await adminFixture.cleanup()}
});

test('audit sanitizer recursively removes credentials and tokens',async()=>{
  const f=await fixture();
  try{
    const audit=createAuditService(f.db,{productId:'agro-pecuaria'});
    await audit.append({
      actorId:'u1',action:'test.sanitize',entityType:'test',entityId:'1',
      metadata:{password:'secret-a',safe:'ok',nested:{token:'secret-b',passwordHash:'secret-c',keep:1},items:[{tokenHash:'secret-d',name:'item'}]}
    });
    const [entry]=await audit.list({action:'test.sanitize'});
    assert.equal(entry.metadata.safe,'ok');
    assert.deepEqual(entry.metadata.nested,{keep:1});
    assert.deepEqual(entry.metadata.items,[{name:'item'}]);
    const serialized=JSON.stringify(entry);
    assert.ok(!serialized.includes('secret-a'));
    assert.ok(!serialized.includes('secret-b'));
    assert.ok(!serialized.includes('secret-c'));
    assert.ok(!serialized.includes('secret-d'));
  }finally{await f.cleanup()}
});

test('security writes durable audit events and listAudit is permission protected',async()=>{
  const f=await fixture();
  try{
    const audit=createAuditService(f.db,{productId:'agro-pecuaria'});
    const security=createSecurityService(f.db,{audit});
    await security.bootstrapUser({id:'admin-1',username:'admin',password:'password-123',roles:['admin']});
    const auth=await security.authenticate({username:'admin',password:'password-123'});
    const beforeRevoke=await security.listAudit({sessionId:auth.session.id,token:auth.token});
    assert.ok(beforeRevoke.some(entry=>entry.action==='security.user.bootstrap'));
    assert.ok(beforeRevoke.some(entry=>entry.action==='security.session.login'));
    await security.revoke({sessionId:auth.session.id,token:auth.token});
    const all=await audit.list();
    assert.ok(all.some(entry=>entry.action==='security.session.revoke'));
    assert.ok(all.every(entry=>!JSON.stringify(entry).includes(auth.token)));
  }finally{await f.cleanup()}
});

test('viewer cannot read audit log',async()=>{
  const f=await fixture();
  try{
    const {security,auth}=await sessionFor(f.db,{role:'viewer'});
    await assert.rejects(
      ()=>security.listAudit({sessionId:auth.session.id,token:auth.token}),
      error=>error?.code==='FORBIDDEN'
    );
  }finally{await f.cleanup()}
});

test('RPC mutations audit the authenticated actor instead of trusting input actorId',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-rpc-audit-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    const admin=await host.backend.bootstrap({username:'admin',password:'password-123'});
    const auth=await host.backend.login({username:'admin',password:'password-123'});
    await host.backend.action({
      screenId:'lots',
      action:'save',
      auth:{sessionId:auth.session.id,token:auth.token},
      input:{id:'lot-audit',name:'Lote Auditoria',farmUnitId:'farm-1',purpose:'beef',actorId:'spoofed-user'}
    });
    const events=await host.presentation.services.audit.list({action:'cattle.lot.save'});
    assert.equal(events.length,1);
    assert.equal(events[0].actorId,admin.id);
    assert.notEqual(events[0].actorId,'spoofed-user');
  }finally{
    await host?.close();
    await rm(root,{recursive:true,force:true});
  }
});
