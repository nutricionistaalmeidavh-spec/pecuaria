import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

test('P1 loads P0-shaped local data without destructive backfill or false zero measurements',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecuaria-p1-compat-'));
  let host;
  try{
    host=await createStandaloneHost({dataDir:root});
    await host.persistence.putRecord('cattle.lots','legacy-lot',{id:'legacy-lot',name:'Lote legado',farmUnitId:'legacy-farm'},{expectedVersion:0});
    await host.persistence.putRecord('cattle.animals','legacy-animal',{id:'legacy-animal',tag:'LEG-001',farmUnitId:'legacy-farm',lotId:'legacy-lot',status:'active',weights:[],movements:[],lifecycle:[]},{expectedVersion:0});
    await host.persistence.putRecord('cattle.finance','legacy-finance',{id:'legacy-finance',kind:'cost',amountMinor:12500,lotId:'legacy-lot',description:'Custo produtivo legado'},{expectedVersion:0});
    await host.persistence.putRecord('cattle.pastures','legacy-pasture',{id:'legacy-pasture',name:'Pasto legado',farmUnitId:'legacy-farm',areaHa:10,status:'active',forage:'Brachiaria'},{expectedVersion:0});
    await host.persistence.putRecord('cattle.tasks','legacy-task',{id:'legacy-task',title:'Tarefa legada',dueAt:'2026-09-22T10:00:00.000Z',kind:'management',animalId:'legacy-animal',lotId:'legacy-lot',status:'pending'},{expectedVersion:0});

    const [finance,pastures,animals,tasks]=await Promise.all([
      host.presentation.load('finance'),
      host.presentation.load('pastures'),
      host.presentation.load('animals',{animalId:'legacy-animal'}),
      host.presentation.load('tasks')
    ]);

    assert.equal(finance.rows.length,1);
    assert.equal(finance.rows[0].payload.id,'legacy-finance');
    assert.deepEqual(finance.admin.titles,[]);
    assert.deepEqual(finance.admin.settlements,[]);
    assert.equal(finance.admin.projection.realized.netMinor,0);
    assert.equal(finance.admin.projection.forecast.days7.netMinor,0);

    assert.equal(pastures.rows[0].payload.status,'active','legacy row must not be rewritten on load');
    const managed=pastures.management.pastures.find(item=>item.id==='legacy-pasture');
    assert.equal(managed.status,'available');
    assert.equal(managed.operationalStatus,'available');
    assert.equal(managed.latestAssessment,null);
    assert.equal(managed.restDays,null);
    assert.deepEqual(pastures.management.assessments,[]);
    assert.deepEqual(pastures.management.bodyCondition,[]);
    assert.deepEqual(pastures.management.rotationPlans,[]);

    assert.equal(animals.detail.animal.id,'legacy-animal');
    assert.ok(Array.isArray(animals.detail.timeline));
    assert.equal(tasks.rows[0].payload.id,'legacy-task');

    const storedPasture=await host.persistence.getRecord('cattle.pastures','legacy-pasture');
    assert.equal(storedPasture.payload.status,'active','derived compatibility must not persist a migration on read');
    assert.equal((await host.persistence.listRecords('cattle.finance-titles')).length,0);
    assert.equal((await host.persistence.listRecords('cattle.pasture-assessments')).length,0);
    assert.equal((await host.persistence.listRecords('cattle.body-condition')).length,0);
    assert.equal((await host.persistence.listRecords('cattle.pasture-rotation-plan')).length,0);

    await host.recovery.createBackup({id:'legacy-compatible'});
    await host.persistence.putRecord('cattle.pastures','legacy-pasture',{...storedPasture.payload,name:'Mudança temporária'},{expectedVersion:storedPasture.version});
    await host.recovery.restoreBackup('legacy-compatible');
    const restored=await host.persistence.getRecord('cattle.pastures','legacy-pasture');
    assert.equal(restored.payload.name,'Pasto legado');
    assert.equal(restored.payload.status,'active');
  }finally{
    await host?.close();
    await rm(root,{recursive:true,force:true});
  }
});
