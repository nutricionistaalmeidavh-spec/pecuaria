// Vendored from nutricionistaalmeidavh-spec/utilidades/modules/artisys-agro-maps.
// Keep generic geometry rules here; cattle-specific behavior belongs outside this folder.
const ALLOWED_GEOMETRIES=new Set(['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon']);
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a[0]===b[0]&&a[1]===b[1];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(v,a,b)=>v>=Math.min(a,b)-1e-12&&v<=Math.max(a,b)+1e-12;
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=1e-12&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);
const intersects=(a,b,c,d)=>{const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);return(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);};
const ringArea=ring=>Math.abs(ring.slice(0,-1).reduce((sum,p,i)=>{const n=ring[i+1];return sum+p[0]*n[1]-n[0]*p[1];},0))/2;

export function validatePosition(position,path='coordinate'){
  if(!Array.isArray(position)||position.length<2)throw new TypeError(`${path} must contain longitude and latitude.`);
  const lon=Number(position[0]),lat=Number(position[1]);
  if(!Number.isFinite(lon)||lon<-180||lon>180)throw new TypeError(`${path} longitude is outside WGS84.`);
  if(!Number.isFinite(lat)||lat<-90||lat>90)throw new TypeError(`${path} latitude is outside WGS84.`);
  return Object.freeze([lon,lat,...position.slice(2).map(Number)]);
}
export function validatePolygonRingTopology(ring,path='ring'){
  if(!Array.isArray(ring)||ring.length<4)throw new TypeError(`${path} requires at least four positions.`);
  if(!same(ring[0],ring.at(-1)))throw new TypeError(`${path} must be closed.`);
  if(new Set(ring.slice(0,-1).map(p=>`${p[0]},${p[1]}`)).size<3)throw new TypeError(`${path} is degenerate.`);
  for(let a=0;a<ring.length-1;a++)for(let b=a+1;b<ring.length-1;b++){if(b===a+1||(a===0&&b===ring.length-2))continue;if(intersects(ring[a],ring[a+1],ring[b],ring[b+1]))throw new TypeError(`${path} is self-intersecting.`);}
  if(ringArea(ring)<=1e-14)throw new TypeError(`${path} is degenerate.`);
  return ring;
}
const depth=type=>({Point:0,MultiPoint:1,LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3})[type];
const mapCoords=(value,d,path)=>d===0?validatePosition(value,path):Object.freeze(value.map((v,i)=>mapCoords(v,d-1,`${path}[${i}]`)));
export function normalizeGeometry(geometry,path='geometry'){
  const type=String(geometry?.type??'');if(!ALLOWED_GEOMETRIES.has(type))throw new TypeError(`${path} type is unsupported.`);
  const coordinates=mapCoords(geometry.coordinates,depth(type),`${path}.coordinates`);
  const polygons=type==='Polygon'?[coordinates]:type==='MultiPolygon'?coordinates:[];
  polygons.forEach((polygon,p)=>polygon.forEach((ring,r)=>validatePolygonRingTopology(ring,`${path}[${p}][${r}]`)));
  return Object.freeze({type,coordinates});
}
export function normalizeFeatureCollection(input={}){
  if(input.type!=='FeatureCollection'||!Array.isArray(input.features)||!input.features.length)throw new TypeError('A non-empty GeoJSON FeatureCollection is required.');
  const geometryTypes={};
  const features=input.features.map((f,i)=>{if(f?.type!=='Feature')throw new TypeError(`Feature ${i+1} is invalid.`);const geometry=normalizeGeometry(f.geometry,`features[${i}].geometry`);geometryTypes[geometry.type]=(geometryTypes[geometry.type]??0)+1;return Object.freeze({type:'Feature',...(f.id==null?{}:{id:String(f.id)}),properties:Object.freeze({...structuredClone(f.properties??{})}),geometry});});
  return Object.freeze({type:'FeatureCollection',features:Object.freeze(features),summary:Object.freeze({featureCount:features.length,geometryTypes:Object.freeze(geometryTypes)})});
}
export const GIS_GEOMETRY_TYPES=Object.freeze([...ALLOWED_GEOMETRIES]);
