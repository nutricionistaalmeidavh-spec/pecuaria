import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildCattleMapSnapshot,createCattleMapPoint,createPastureMapGeometry} from '../src/pecuaria-map.js';
import {createMapCatalog,MAP_RELEASE_REPOSITORY} from '../runtime/map-catalog.mjs';

const pastureGeometry={type:'Polygon',coordinates:[[[-47.90,-21.20],[-47.89,-21.20],[-47.89,-21.19],[-47.90,-21.19],[-47.90,-21.20]]]};

test('livestock map specializes generic GIS around pasture, lot and infrastructure',()=>{
  const geometry=createPastureMapGeometry({pastureId:'p1',farmUnitId:'f1',geometry:pastureGeometry});
  const point=createCattleMapPoint({id:'water-1',kind:'water',name:'Bebedouro 1',farmUnitId:'f1',pastureId:'p1',longitude:-47.895,latitude:-21.195});
  const snapshot=buildCattleMapSnapshot({
    farms:[{id:'f1',name:'Fazenda Norte'}],
    pastures:[{id:'p1',name:'Piquete 1',farmUnitId:'f1',areaHa:12,status:'occupied',forage:'Brachiaria'}],
    geometries:[geometry],points:[point],lots:[{id:'l1',name:'Lote 03'}],
    occupancy:[{id:'o1',pastureId:'p1',lotId:'l1',enteredAt:'2026-09-20T10:00:00.000Z',animalUnits:42}]
  });
  assert.equal(snapshot.pastures.length,1);
  assert.equal(snapshot.pastures[0].metadata.currentLotName,'Lote 03');
  assert.equal(snapshot.pastures[0].metadata.animalUnits,42);
  assert.equal(snapshot.points[0].kind,'water');
  assert.deepEqual(snapshot.bounds,[-47.9,-21.2,-47.89,-21.19]);
  assert.equal(snapshot.source.mapDistribution,MAP_RELEASE_REPOSITORY);
});

test('pasture WGS84 geometry stays separate from existing schematic polygon',()=>{
  const snapshot=buildCattleMapSnapshot({pastures:[{id:'p1',name:'Piquete 1',farmUnitId:'f1',areaHa:8,polygon:[{x:0,y:0},{x:80,y:0},{x:50,y:70}]}]});
  assert.equal(snapshot.pastures.length,0);
  assert.equal(snapshot.unmappedPastures.length,1);
  assert.equal(snapshot.schematicPastures.length,1);
});

test('map catalog pins asset URLs to the manifest release tag',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'pecuaria-maps-'));
  const manifest={schemaVersion:1,releaseVersion:'2026.09.0',maps:[{id:'sp',kind:'state',bounds:[-53.2,-25.3,-44.1,-19.7],available:true,asset:'sp.pmtiles',size:123,sha256:'a'.repeat(64),minZoom:0,maxZoom:14}]};
  const catalog=createMapCatalog({dataDir,fetchImpl:async()=>({ok:true,status:200,async json(){return manifest;}})});
  await catalog.refresh();
  const plan=await catalog.plan({farmUnitId:'f1',farmName:'Fazenda Norte',bounds:[-47.90,-21.20,-47.89,-21.19],profile:'detailed'});
  assert.equal(plan.sources.length,1);
  assert.equal(plan.sources[0].url,'https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v2026.09.0/sp.pmtiles');
  assert.equal((await catalog.snapshot()).repository,MAP_RELEASE_REPOSITORY);
  const cached=JSON.parse(await readFile(join(dataDir,'maps','catalog.json'),'utf8'));
  assert.equal(cached.releaseVersion,'2026.09.0');
});
