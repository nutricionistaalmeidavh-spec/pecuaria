import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';

const can=(role,permission)=>(SECURITY_POLICY[role]??[]).includes('*')||(SECURITY_POLICY[role]??[]).includes(permission);

test('P1 role matrix keeps finance, cattle, RFID and device administration separated',()=>{
  const matrix={
    admin:{cattle:true,financeWrite:true,financeSettle:true,rfid:true,iotAdmin:true},
    manager:{cattle:true,financeWrite:true,financeSettle:true,rfid:true,iotAdmin:true},
    finance:{cattle:false,financeWrite:true,financeSettle:true,rfid:false,iotAdmin:false},
    'field-operator':{cattle:true,financeWrite:false,financeSettle:false,rfid:true,iotAdmin:false},
    viewer:{cattle:false,financeWrite:false,financeSettle:false,rfid:false,iotAdmin:false}
  };
  for(const [role,expected] of Object.entries(matrix)){
    assert.equal(can(role,'cattle:write'),expected.cattle,`${role} cattle write`);
    assert.equal(can(role,'finance:write'),expected.financeWrite,`${role} finance write`);
    assert.equal(can(role,'finance:settle'),expected.financeSettle,`${role} finance settle`);
    assert.equal(can(role,'iot:bind'),expected.rfid,`${role} RFID bind`);
    assert.equal(can(role,'iot:write'),expected.iotAdmin,`${role} IoT admin`);
  }
  assert.equal(PRESENTATION_ACCESS.screens.finance.actions.settleTitle,'finance:settle');
  assert.equal(PRESENTATION_ACCESS.screens.finance.actions.reverseSettlement,'finance:settle');
  assert.equal(PRESENTATION_ACCESS.screens.iot.actions.bindRfid,'iot:bind');
  assert.equal(PRESENTATION_ACCESS.screens.iot.actions.unbindRfid,'iot:bind');
});

test('field quick execution authorizes both cattle field access and the normalized destination action',async()=>{
  const backend=await readFile(new URL('../runtime/backend.mjs',import.meta.url),'utf8');
  assert.match(backend,/permission\(prepared\.command\.screenId,'write',prepared\.command\.action\)/);
  assert.match(backend,/permission\(command\.screenId,'write',command\.action\)/);
  assert.match(backend,/Unsupported field quick operation/);
});

test('critical P1 finance mutations audit authenticated actor without raw input or secrets',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-p1-security-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    const user=await host.backend.bootstrap({username:'admin',password:'P1-Security-2026!'});
    const login=await host.backend.login({username:'admin',password:'P1-Security-2026!'});
    const auth={sessionId:login.session.id,token:login.token};
    await host.backend.action({screenId:'finance',action:'saveTitle',auth,input:{
      id:'sec-title',direction:'payable',description:'Título seguro',originalAmountMinor:10000,
      issuedAt:'2026-09-21',dueAt:'2026-09-30',notes:'não deve vazar',actorId:'spoofed',token:'raw-secret'
    }});
    await host.backend.action({screenId:'finance',action:'settleTitle',auth,input:{
      id:'sec-settlement',operationId:'sec-op',titleId:'sec-title',amountMinor:2500,occurredAt:'2026-09-21T10:00:00Z',notes:'sigiloso'
    }});
    const audit=await host.presentation.services.audit.list();
    const relevant=audit.filter(entry=>['cattle.finance.title.save','cattle.finance.title.settle'].includes(entry.action));
    assert.equal(relevant.length,2);
    assert.ok(relevant.every(entry=>entry.actorId===user.id));
    const serialized=JSON.stringify(relevant);
    for(const secret of ['spoofed','raw-secret','não deve vazar','sigiloso'])assert.ok(!serialized.includes(secret),secret);
  }finally{
    await host?.close();
    await rm(root,{recursive:true,force:true});
  }
});
