const R=6378137;
const rad=value=>Number(value)*Math.PI/180;
const polygonTypes=new Set(['Polygon','MultiPolygon']);

export function extractGeoJsonGeometry(input,featureIndex=0){
  const value=typeof input==='string'?JSON.parse(input):input;
  let geometry=value;
  if(value?.type==='Feature')geometry=value.geometry;
  else if(value?.type==='FeatureCollection'){
    if(!Array.isArray(value.features)||!value.features.length)throw new TypeError('FeatureCollection GeoJSON está vazio.');
    const index=Number(featureIndex);
    if(!Number.isInteger(index)||index<0||index>=value.features.length)throw new RangeError('Índice da feição GeoJSON é inválido.');
    geometry=value.features[index]?.geometry;
  }
  if(!polygonTypes.has(geometry?.type))throw new TypeError('A geometria GeoJSON deve ser Polygon ou MultiPolygon.');
  return structuredClone(geometry);
}

function ringAreaM2(ring=[]){
  if(ring.length<4)return 0;
  let sum=0;
  for(let i=0;i<ring.length-1;i++){
    const [lon1,lat1]=ring[i],[lon2,lat2]=ring[i+1];
    sum+=(rad(lon2)-rad(lon1))*(2+Math.sin(rad(lat1))+Math.sin(rad(lat2)));
  }
  return Math.abs(sum*R*R/2);
}
function polygonAreaM2(rings=[]){
  if(!rings.length)return 0;
  const outer=ringAreaM2(rings[0]);
  const holes=rings.slice(1).reduce((sum,ring)=>sum+ringAreaM2(ring),0);
  return Math.max(0,outer-holes);
}
export function geometryAreaHa(input){
  const geometry=extractGeoJsonGeometry(input);
  const area=geometry.type==='Polygon'?polygonAreaM2(geometry.coordinates):geometry.coordinates.reduce((sum,polygon)=>sum+polygonAreaM2(polygon),0);
  return area/10000;
}

export function verticesToPolygon(vertices=[]){
  const points=vertices.map((point,index)=>{
    const longitude=Number(Array.isArray(point)?point[0]:point?.longitude);
    const latitude=Number(Array.isArray(point)?point[1]:point?.latitude);
    if(!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new TypeError(`Vértice ${index+1}: longitude fora de WGS84.`);
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90)throw new TypeError(`Vértice ${index+1}: latitude fora de WGS84.`);
    return [longitude,latitude];
  });
  if(points.length<3)throw new TypeError('Informe ao menos três vértices.');
  const ring=[...points];
  if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])ring.push([...ring[0]]);
  return {type:'Polygon',coordinates:[ring]};
}
