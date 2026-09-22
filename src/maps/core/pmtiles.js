// Vendored from nutricionistaalmeidavh-spec/utilidades/modules/artisys-agro-maps.
const RELEASE_RE=/^[0-9]{4}\.[0-9]{2}\.[0-9]+$/,SHA_RE=/^[a-f0-9]{64}$/;
export const MAP_PROFILES=Object.freeze({basic:Object.freeze({maxZoom:10,label:'Basic'}),detailed:Object.freeze({maxZoom:12,label:'Detailed'}),maximum:Object.freeze({maxZoom:14,label:'Maximum'})});
const validBounds=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3];
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const safe=v=>String(v??'area').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'area';
export function validateMapManifest(input){
  if(input?.schemaVersion!==1||!RELEASE_RE.test(String(input.releaseVersion??''))||!Array.isArray(input.maps)||!input.maps.length)throw new TypeError('Invalid map manifest.');
  const ids=new Set();for(const map of input.maps){if(!map?.id||ids.has(map.id)||!validBounds(map.bounds))throw new TypeError('Invalid map entry.');ids.add(map.id);if(map.available===true&&(!String(map.asset??'').endsWith('.pmtiles')||!Number.isInteger(map.size)||map.size<=0||!SHA_RE.test(String(map.sha256??''))))throw new TypeError(`Invalid PMTiles asset: ${map.id}.`);}return input;
}
export function buildRegionalMapPlan({areaId,areaName=null,bounds,manifest,profile='detailed',releaseBaseUrl}={}){
  if(!validBounds(bounds))throw new TypeError('Valid WGS84 bounds are required.');const checked=validateMapManifest(manifest),definition=MAP_PROFILES[profile];if(!definition)throw new TypeError('Unknown map profile.');
  const sources=checked.maps.filter(m=>m.available===true&&m.kind!=='national'&&overlap(bounds,m.bounds));if(!sources.length)throw new Error('No map package intersects this area.');
  const base=String(releaseBaseUrl??'').replace(/\/$/,'');if(!base)throw new TypeError('releaseBaseUrl is required; host map releases yourself or provide an explicit source.');
  return Object.freeze({areaId:String(areaId),areaName,profile,profileLabel:definition.label,bounds:Object.freeze([...bounds]),bbox:bounds.join(','),minZoom:0,maxZoom:definition.maxZoom,sources:Object.freeze(sources.map(m=>Object.freeze({id:m.id,url:`${base}/${m.asset}`,sha256:m.sha256,size:m.size,minZoom:m.minZoom,maxZoom:m.maxZoom}))),outputAsset:`area-${safe(areaId)}-${profile}.pmtiles`,requiresNetwork:true,localAfterInstall:true});
}
