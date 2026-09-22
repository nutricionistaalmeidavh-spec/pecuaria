// Vendored from nutricionistaalmeidavh-spec/utilidades/modules/artisys-agro-maps.
import {normalizeGeometry} from './gis.js';

const rows=v=>(v??[]).map(x=>x?.payload??x).filter(Boolean);
const pointsOf=g=>g.type==='Polygon'?g.coordinates.flat(1):g.type==='MultiPolygon'?g.coordinates.flat(2):[];
export function geometryBounds(geometry){
  const g=normalizeGeometry(geometry);const points=pointsOf(g);if(!points.length)return null;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return Object.freeze([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]);
}
export function polygonCentroid(geometry){
  const g=normalizeGeometry(geometry);const ring=g.type==='Polygon'?g.coordinates[0]:g.coordinates[0][0];if(!ring?.length)return null;
  let twice=0,x=0,y=0;for(let i=0;i<ring.length-1;i++){const[a,b]=ring[i],[c,d]=ring[i+1],cross=a*d-c*b;twice+=cross;x+=(a+c)*cross;y+=(b+d)*cross;}
  if(Math.abs(twice)<1e-12){const u=ring.slice(0,-1);return Object.freeze({longitude:u.reduce((s,p)=>s+p[0],0)/u.length,latitude:u.reduce((s,p)=>s+p[1],0)/u.length});}
  return Object.freeze({longitude:x/(3*twice),latitude:y/(3*twice)});
}
export function buildSpatialSnapshot({areas=[],geometries=[],points=[]}={}){
  const geometryById=new Map(rows(geometries).map(g=>[String(g.areaId??g.fieldId??g.id),g.geometry??g]));
  const mapped=[],unmapped=[];for(const area of rows(areas)){const id=String(area.id),raw=geometryById.get(id);if(!raw){unmapped.push(Object.freeze({id,name:area.name??id}));continue;}try{const geometry=normalizeGeometry(raw);mapped.push(Object.freeze({id,name:area.name??id,parentId:area.parentId??area.farmUnitId??null,areaHa:Number(area.areaHa??0),geometry,centroid:polygonCentroid(geometry),bounds:geometryBounds(geometry),metadata:Object.freeze({...structuredClone(area.metadata??{})})}));}catch{unmapped.push(Object.freeze({id,name:area.name??id,invalidGeometry:true}));}}
  const validPoints=rows(points).filter(p=>Number.isFinite(Number(p.longitude))&&Number.isFinite(Number(p.latitude))&&Number(p.longitude)>=-180&&Number(p.longitude)<=180&&Number(p.latitude)>=-90&&Number(p.latitude)<=90).map(p=>Object.freeze({...p,longitude:Number(p.longitude),latitude:Number(p.latitude)}));
  return Object.freeze({areas:Object.freeze(mapped),unmappedAreas:Object.freeze(unmapped),points:Object.freeze(validPoints),generatedAt:new Date().toISOString()});
}
