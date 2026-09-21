export function createMapRpc({presentation,mapService,mapCatalog=null}={}){
  if(!presentation?.services?.security)throw new TypeError('Presentation security service is required.');
  if(!mapService?.snapshot)throw new TypeError('Cattle map service is required.');
  const security=presentation.services.security;
  const authenticate=(auth,permission)=>security.authorize({sessionId:auth?.sessionId,token:auth?.token,permission});
  const audit=(actorId,action,entityType,entityId,metadata={})=>presentation.services.audit?.append?.({actorId,action,entityType,entityId,metadata});
  return async function maps({auth,operation='state',input={}}={}){
    if(operation==='state'){
      await authenticate(auth,'cattle:read');
      const [map,catalog]=await Promise.all([mapService.snapshot(),mapCatalog?.snapshot?.()??null]);
      return Object.freeze({map,catalog});
    }
    if(operation==='refreshCatalog'){
      const authorized=await authenticate(auth,'settings:write');
      if(!mapCatalog?.refresh)throw new Error('Map catalog is unavailable in this runtime.');
      const manifest=await mapCatalog.refresh();
      await audit(authorized.user.id,'maps.catalog.refresh','map-catalog',manifest.releaseVersion,{repository:'nutricionistaalmeidavh-spec/mapasbrasilrelease'});
      return Object.freeze({catalog:await mapCatalog.snapshot()});
    }
    if(operation==='planOffline'){
      await authenticate(auth,'cattle:read');
      if(!mapCatalog?.plan)throw new Error('Offline map planning is unavailable in this runtime.');
      const snapshot=await mapService.snapshot();
      const bounds=input.bounds??snapshot.bounds;
      if(!bounds)throw new Error('Cadastre ao menos uma geometria WGS84 para planejar o mapa offline.');
      return mapCatalog.plan({...input,bounds});
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
