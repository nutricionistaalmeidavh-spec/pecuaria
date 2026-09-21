import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {buildSpatialSnapshot,normalizeGeometry,validatePosition} from './maps/core/index.js';

export const CATTLE_MAP_COLLECTIONS=Object.freeze({geometries:'cattle.map-geometries',points:'cattle.map-points'});
export const CATTLE_MAP_POINT_KINDS=Object.freeze(['trough','water','corral','gate','salt','mineral','scale','sensor','occurrence','other']);
const rows=value=>(value??[]).map(record=>record?.payload??record).filter(Boolean);
const required=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function createCattleMapPoint(input={}){
  const kind=String(input.kind??'other').trim().toLowerCase();
  if(!CATTLE_MAP_POINT_KINDS.includes(kind))throw new TypeError(`Unsupported cattle map point kind: ${kind}.`);
  const [longitude,latitude]=validatePosition([Number(input.longitude),Number(input.latitude)],'map point');
  return Object.freeze({id:required(input.id,'Map point id'),kind,name:required(input.name,'Map point name'),farmUnitId:required(input.farmUnitId,'Farm unit id'),pastureId:optional(input.pastureId),longitude,latitude,notes:optional(input.notes)});
}

export function createPastureMapGeometry(input={}){
  const geometry=normalizeGeometry(input.geometry,'pasture geometry');
  if(!['Polygon','MultiPolygon'].includes(geometry.type))throw new TypeError('Pasture geometry must be Polygon or MultiPolygon.');
  return Object.freeze({id:required(input.id??input.pastureId,'Map geometry id'),pastureId:required(input.pastureId,'Pasture id'),farmUnitId:required(input.farmUnitId,'Farm unit id'),geometry,source:required(input.source??'manual','Geometry source'),updatedAt:new Date().toISOString()});
}

export function buildCattleMapSnapshot(input={}){
  const farms=rows(input.farms),pastures=rows(input.pastures),lots=rows(input.lots),occupancy=rows(input.occupancy),geometries=rows(input.geometries),points=rows(input.points);
  const lotById=new Map(lots.map(lot=>[String(lot.id),lot]));
  const occupancyByPasture=new Map();
  for(const item of occupancy){if(!item.pastureId)continue;const current=occupancyByPasture.get(String(item.pastureId));if(!current||(!item.leftAt&&current.leftAt)||Date.parse(item.enteredAt??0)>=Date.parse(current.enteredAt??0))occupancyByPasture.set(String(item.pastureId),item);}
  const areas=pastures.map(pasture=>{const current=occupancyByPasture.get(String(pasture.id)),lot=current?.lotId?lotById.get(String(current.lotId)):null;return{...pasture,parentId:pasture.farmUnitId,metadata:{status:pasture.status??'available',forage:pasture.forage??null,capacityAu:pasture.capacityAu??null,currentLotId:current?.lotId??null,currentLotName:lot?.name??lot?.code??null,animalUnits:current?.animalUnits??null}};});
  const spatial=buildSpatialSnapshot({areas,geometries:geometries.map(item=>({areaId:item.pastureId??item.id,geometry:item.geometry??item})),points});
  const bounds=spatial.areas.length?Object.freeze([Math.min(...spatial.areas.map(a=>a.bounds[0])),Math.min(...spatial.areas.map(a=>a.bounds[1])),Math.max(...spatial.areas.map(a=>a.bounds[2])),Math.max(...spatial.areas.map(a=>a.bounds[3]))]):null;
  const schematicPastures=Object.freeze(pastures.filter(p=>Array.isArray(p.polygon)&&p.polygon.length>=3).map(p=>Object.freeze({id:String(p.id),name:p.name??p.id,farmUnitId:p.farmUnitId,areaHa:Number(p.areaHa??0),polygon:p.polygon,status:p.status??'available'})));
  return Object.freeze({farms:Object.freeze(farms),pastures:spatial.areas,unmappedPastures:spatial.unmappedAreas,schematicPastures,points:spatial.points,bounds,generatedAt:spatial.generatedAt,source:Object.freeze({genericCore:'utilidades/modules/artisys-agro-maps',mapDistribution:'nutricionistaalmeidavh-spec/mapasbrasilrelease'})});
}

export function createCattleMapService(persistence){
  if(!persistence?.listRecords)throw new TypeError('Persistence adapter is required.');
  const geometries=createEntityRepository(persistence,{collection:CATTLE_MAP_COLLECTIONS.geometries});
  const points=createEntityRepository(persistence,{collection:CATTLE_MAP_COLLECTIONS.points});
  const list=async collection=>rows(await persistence.listRecords(collection));
  return Object.freeze({
    async snapshot(){const [farms,pastures,g,p,occupancy,lots]=await Promise.all([list('cattle.farm-units'),list('cattle.pastures'),geometries.list(),points.list(),list('cattle.pasture-occupancy'),list('cattle.lots')]);return buildCattleMapSnapshot({farms,pastures,geometries:g,points:p,occupancy,lots});},
    savePastureGeometry:(input,options={})=>geometries.save(createPastureMapGeometry(input),options),
    savePoint:(input,options={})=>points.save(createCattleMapPoint(input),options),
    removePastureGeometry:(id,options={})=>geometries.remove(required(id,'Map geometry id'),options),
    removePoint:(id,options={})=>points.remove(required(id,'Map point id'),options)
  });
}
