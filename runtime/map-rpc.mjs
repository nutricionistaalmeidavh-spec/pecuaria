const MAP_REPOSITORY='nutricionistaalmeidavh-spec/mapasbrasilrelease';
const unsupportedProvider=()=>Object.freeze({available:false,platform:'browser',arch:null,repository:MAP_REPOSITORY,catalogVersion:null,catalogAvailable:false,installed:Object.freeze([]),recoveryIssues:Object.freeze([]),profiles:Object.freeze([{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}])});
const unsupported=()=>{const error=new Error('Operações de pacote PMTiles requerem o aplicativo desktop Windows x64.');error.code='MAP_UNSUPPORTED_RUNTIME';error.retryable=false;return error;};

export function createMapRpc({presentation,mapService,mapPackageManager=null}={}){
  if(!presentation?.services?.security)throw new TypeError('Presentation security service is required.');
  if(!mapService?.snapshot)throw new TypeError('Cattle map service is required.');
  const security=presentation.services.security;
  const authenticate=(auth,permission)=>security.authorize({sessionId:auth?.sessionId,token:auth?.token,permission});
  const audit=(actorId,action,entityType,entityId,metadata={})=>presentation.services.audit?.append?.({actorId,action,entityType,entityId,metadata});
  const packageManager=()=>{if(!mapPackageManager)throw unsupported();return mapPackageManager;};

  return async function maps({auth,operation='state',input={}}={}){
    if(operation==='state'){
      await authenticate(auth,'cattle:read');
      const [map,provider]=await Promise.all([mapService.snapshot(),mapPackageManager?.snapshot?.()??unsupportedProvider()]);
      return Object.freeze({map,provider,catalog:provider});
    }
    if(operation==='planOffline'){
      await authenticate(auth,'cattle:read');
      const snapshot=await mapService.snapshot(),bounds=input.bounds??snapshot.bounds;
      if(!bounds)throw Object.assign(new Error('Cadastre ao menos uma geometria WGS84 para planejar o mapa offline.'),{code:'MAP_BOUNDS_REQUIRED'});
      return packageManager().planFarmMap({...input,bounds});
    }
    if(operation==='refreshCatalog'){
      const authorized=await authenticate(auth,'settings:write'),manifest=await packageManager().refreshCatalog();
      await audit(authorized.user.id,'maps.catalog.refresh','map-catalog',manifest.releaseVersion,{repository:MAP_REPOSITORY});
      return Object.freeze({provider:await mapPackageManager.snapshot(),catalog:manifest});
    }
    if(operation==='installFarmMap'){
      const authorized=await authenticate(auth,'settings:write');
      const snapshot=await mapService.snapshot(),bounds=input.bounds??snapshot.bounds;
      if(!bounds)throw Object.assign(new Error('Cadastre ao menos uma geometria WGS84 antes de instalar o mapa offline.'),{code:'MAP_BOUNDS_REQUIRED'});
      const result=await packageManager().installFarmMap({...input,bounds});
      await audit(authorized.user.id,'maps.package.install','map-package',result.id,{farmUnitId:result.farmUnitId,profile:result.profile,catalogVersion:result.catalogVersion});
      return result;
    }
    if(operation==='verifyFarmMap'){
      const authorized=await authenticate(auth,'settings:write'),result=await packageManager().verifyFarmMap(input);
      await audit(authorized.user.id,'maps.package.verify','map-package',input.id,{health:result.health});
      return result;
    }
    if(operation==='removeFarmMap'){
      const authorized=await authenticate(auth,'settings:write'),result=await packageManager().removeFarmMap(input);
      await audit(authorized.user.id,'maps.package.remove','map-package',input.id,{removed:result.removed});
      return result;
    }
    const authorized=await authenticate(auth,'cattle:write');
    if(operation==='saveGeometry'){
      const result=await mapService.savePastureGeometry(input,input.options??{});
      await audit(authorized.user.id,'maps.geometry.save','pasture-map-geometry',input.id??input.pastureId,{pastureId:input.pastureId,farmUnitId:input.farmUnitId});
      return result;
    }
    if(operation==='savePoint'){
      const result=await mapService.savePoint(input,input.options??{});
      await audit(authorized.user.id,'maps.point.save','map-point',input.id,{kind:input.kind,farmUnitId:input.farmUnitId,pastureId:input.pastureId??null});
      return result;
    }
    if(operation==='removeGeometry'){
      const result=await mapService.removePastureGeometry(input.id,input.options??{});
      await audit(authorized.user.id,'maps.geometry.remove','pasture-map-geometry',input.id,{});
      return result;
    }
    if(operation==='removePoint'){
      const result=await mapService.removePoint(input.id,input.options??{});
      await audit(authorized.user.id,'maps.point.remove','map-point',input.id,{});
      return result;
    }
    throw new Error(`Unknown map operation: ${operation}`);
  };
}
