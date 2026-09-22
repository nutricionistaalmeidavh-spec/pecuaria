import {createCattleMapService} from '../../src/pecuaria-map.js';
import {createMapRpc} from '../../runtime/map-rpc.mjs';

const provider=()=>Object.freeze({available:false,platform:'browser',arch:null,catalogAvailable:false,catalogVersion:null,installed:Object.freeze([]),recoveryIssues:Object.freeze([]),profiles:Object.freeze([{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}])});
const unsupported=()=>{const error=new Error('Mapas PMTiles offline são gerenciados pelo aplicativo desktop Windows x64.');error.code='MAP_UNSUPPORTED_RUNTIME';return error;};

export function createBrowserMapsRuntime({mapService}={}){
  if(!mapService?.snapshot)throw new TypeError('Cattle map service is required.');
  return async function maps({operation='state',input={}}={}){
    if(operation==='state')return Object.freeze({map:await mapService.snapshot(),provider:provider(),catalog:provider()});
    if(operation==='saveGeometry')return mapService.savePastureGeometry(input,input.options??{});
    if(operation==='savePoint')return mapService.savePoint(input,input.options??{});
    if(operation==='removeGeometry')return mapService.removePastureGeometry(input.id,input.options??{});
    if(operation==='removePoint')return mapService.removePoint(input.id,input.options??{});
    if(['refreshCatalog','planOffline','installFarmMap','verifyFarmMap','removeFarmMap'].includes(operation))throw unsupported();
    throw new Error(`Unknown map operation: ${operation}`);
  };
}

export function attachBrowserMaps({coreBackend,presentation,persistence}={}){
  if(!coreBackend||!presentation||!persistence)throw new TypeError('Browser backend, presentation and persistence are required.');
  const mapService=createCattleMapService(persistence);
  return Object.freeze({...coreBackend,maps:createMapRpc({presentation,mapService,mapPackageManager:null})});
}
