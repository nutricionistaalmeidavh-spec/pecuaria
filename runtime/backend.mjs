import {createReproductionManagementService} from '../src/reproduction-management.js';
import {createFieldSyncService} from '../src/field-sync.js';
import {createEditionAccess,featureForAction,featureForRpc,featureForScreen,featureForSearchCollection} from '../src/editions.js';

const clean=(screen,edition)=>({
  id:screen.id,
  title:screen.title,
  kind:screen.kind,
  actionDefinitions:Object.freeze(Object.fromEntries(
    Object.entries(screen.actionDefinitions??{}).filter(([action])=>edition.actionEnabled(screen.id,action))
  ))
});

function featureError(feature,target){
  const error=new Error(`Feature not licensed: ${feature}${target?` (${target})`:''}.`);
  error.code='FEATURE_NOT_LICENSED';
  error.feature=feature;
  if(target)error.target=target;
  return error;
}

export function createRpcBackend({presentation,persistence=null,editionAccess=null}){
  const security=presentation.services.security;
  const edition=editionAccess??presentation.services.editionAccess??createEditionAccess({edition:'pro'});
  const reproductionManagement=persistence?createReproductionManagementService(persistence,{audit:presentation.services.audit}):null;
  const fieldSynchronization=persistence?createFieldSyncService(persistence,{productId:security.productId}):null;
  async function session(auth,permission=null){
    const args={sessionId:auth?.sessionId,token:auth?.token};
    return permission?security.authorize({...args,permission}):security.authenticateSession(args);
  }
  const permission=(screenId,mode,action=null)=>security.permissionFor?.({screenId,mode,action})??null;
  const insightPermission=scope=>scope==='finance'?'finance:read':'cattle:read';
  const authArgs=auth=>({sessionId:auth?.sessionId,token:auth?.token});
  const requireFeature=(feature,target)=>{if(feature&&!edition.has(feature))throw featureError(feature,target);};
  const requireScreen=screenId=>requireFeature(featureForScreen(screenId)??'unknown-screen',`screen:${screenId}`);
  const requireAction=(screenId,action)=>{requireScreen(screenId);requireFeature(featureForAction(screenId,action)??'unknown-action',`action:${screenId}.${action}`);};
  const requireRpc=name=>requireFeature(featureForRpc(name),`rpc:${name}`);
  const enabledScreenIds=()=>presentation.screenIds().filter(id=>edition.screenEnabled(id));
  return Object.freeze({
    async describe(auth=null){
      const access={};
      if(auth){
        for(const id of enabledScreenIds()){
          access[id]={read:true,actions:[]};
          try{await session(auth,permission(id,'read'));}catch{access[id].read=false;}
          for(const action of Object.keys(presentation.screen(id).actions??{})){
            if(!edition.actionEnabled(id,action))continue;
            try{await session(auth,permission(id,'write',action));access[id].actions.push(action);}catch{}
          }
        }
      }
      return{
        productId:security.productId,
        brand:presentation.shell.brand,
        edition:{id:edition.edition,licensed:edition.licensed,features:edition.features},
        navigation:presentation.shell.navigation.filter(item=>edition.screenEnabled(item.id)&&(auth?access[item.id]?.read:true)),
        screens:enabledScreenIds().map(id=>clean(presentation.screen(id),edition)),
        access
      };
    },
    async authState(){return{hasUsers:await security.hasUsers()}},
    async bootstrap({username,password}){
      return security.bootstrapUser({id:crypto.randomUUID(),username,password,roles:['admin']});
    },
    login:input=>security.authenticate(input),
    validate:auth=>session(auth),
    logout:auth=>security.revoke(auth),
    async search({term,auth,collections=null,limit=25}){
      await session(auth);
      let selected;
      if(collections==null)selected=edition.searchCollections();
      else{
        if(!Array.isArray(collections))selected=collections;
        else{
          for(const collection of collections){
            const feature=featureForSearchCollection(collection);
            if(feature)requireFeature(feature,`search:${collection}`);
          }
          selected=collections;
        }
      }
      const results=await presentation.services.search.query({term,collections:selected,limit});
      return edition.filterSearchResults(results);
    },
    async alerts({auth}){await session(auth);return edition.filterAlerts(await presentation.services.alerts.list());},
    async audit({auth,filter={}}){requireRpc('audit');return security.listAudit({...authArgs(auth),...filter});},
    async insights({scope,auth,options={}}){requireFeature(scope==='finance'?'finance.production':'dashboard.basic',`rpc:insights:${scope}`);await session(auth,insightPermission(scope));return presentation.services.reporting.insights(scope,options);},
    async simulateSale({auth,...input}){requireRpc('simulateSale');await session(auth,'finance:read');return presentation.services.reporting.simulateSale(input);},
    async reproductionAdmin({auth,operation='state',input={}}={}){
      requireRpc('reproductionAdmin');
      if(!reproductionManagement)throw new Error('Reproduction management persistence is unavailable.');
      const write=operation!=='state';
      const authorized=await session(auth,write?'cattle:write':'cattle:read');
      const context={actorId:authorized.user.id};
      if(operation==='state')return reproductionManagement.load();
      if(operation==='saveGenetics')return reproductionManagement.saveGenetics(input,context);
      if(operation==='saveDoseStock')return reproductionManagement.saveDoseStock(input,context);
      if(operation==='adjustDoseStock')return reproductionManagement.adjustDoseStock(input,context);
      if(operation==='saveBreedingSeason')return reproductionManagement.saveBreedingSeason(input,context);
      if(operation==='recordService')return reproductionManagement.recordProfessionalService(input,context);
      throw new Error(`Unknown reproduction administration operation: ${operation}`);
    },
    async userAdmin({auth,operation='state',input={}}={}){
      requireRpc('userAdmin');
      const args=authArgs(auth);
      if(operation==='state'){
        const [users,profiles,audit]=await Promise.all([security.listUsers(args),security.listProfiles(args),security.listAudit({...args,limit:100})]);
        return{users,profiles,audit};
      }
      if(operation==='create')return security.createUser({...args,user:{id:input.id??crypto.randomUUID(),...input}});
      if(operation==='update')return security.updateUser({...args,id:input.id,changes:input.changes??input});
      if(operation==='resetPassword')return security.resetUserPassword({...args,id:input.id,password:input.password});
      throw new Error(`Unknown user administration operation: ${operation}`);
    },
    async fieldSync({auth,operation='state',input={}}={}){
      requireRpc('fieldSync');
      if(!fieldSynchronization)throw new Error('Field synchronization persistence is unavailable.');
      if(operation==='state'){
        await session(auth,'cattle:read');
        return fieldSynchronization.state();
      }
      if(operation==='configure'){
        const authorized=await session(auth,'settings:write');
        const result=await fieldSynchronization.configure(input);
        await presentation.services.audit?.append?.({actorId:authorized.user.id,action:'field.sync.configure',entityType:'field-device',entityId:result.state.deviceId,metadata:{role:result.state.role,deviceName:result.state.deviceName}});
        return result;
      }
      if(operation==='exportBundle'){
        const authorized=await session(auth,'cattle:read');
        const bundle=await fieldSynchronization.exportBundle();
        await presentation.services.audit?.append?.({actorId:authorized.user.id,action:'field.sync.export',entityType:'field-device',entityId:bundle.sourceDeviceId,metadata:{nonce:bundle.nonce}});
        return bundle;
      }
      if(operation==='quick'){
        const authorized=await session(auth,'cattle:write');
        const prepared=await fieldSynchronization.prepareQuick({...input,actorId:authorized.user.id});
        requireAction(prepared.command.screenId,prepared.command.action);
        await session(auth,permission(prepared.command.screenId,'write',prepared.command.action));
        try{
          const result=await presentation.action(prepared.command.screenId,prepared.command.action,prepared.command.input,{actorId:authorized.user.id,fieldOperationId:prepared.operation.id});
          await fieldSynchronization.markQuickApplied(prepared.operation.id);
          return{operationId:prepared.operation.id,result,state:await fieldSynchronization.state()};
        }catch(error){
          await fieldSynchronization.markQuickFailed(prepared.operation.id,error);
          throw error;
        }
      }
      if(operation==='importBundle'){
        const authorized=await session(auth,'cattle:write');
        const result=await fieldSynchronization.importBundle(input.bundle,{apply:async command=>{requireAction(command.screenId,command.action);await session(auth,permission(command.screenId,'write',command.action));return presentation.action(command.screenId,command.action,command.input,{actorId:authorized.user.id,fieldSync:true});}});
        await presentation.services.audit?.append?.({actorId:authorized.user.id,action:'field.sync.import',entityType:'field-device',entityId:result.state.deviceId,metadata:{applied:result.operations.applied,skipped:result.operations.skipped,conflicts:result.operations.conflicts,snapshotApplied:result.snapshot.applied}});
        return result;
      }
      throw new Error(`Unknown field synchronization operation: ${operation}`);
    },
    async references({auth}){
      await session(auth);
      const localRows=async collection=>persistence?.listRecords?((await persistence.listRecords(collection))??[]).map(record=>record?.payload??record):[];
      const [lots,animals,data,sanitary,inventory,pastures,nutrition,events,traceability,bodyCondition,tasks,pastureOccupancy,pastureAssessments,rotationPlans,breedingSeasons,reproductionGenetics,reproductionDoseStock]=await Promise.all([
        presentation.load('lots',{}),presentation.load('animals',{}),presentation.load('data',{}),presentation.load('sanitary',{}),presentation.load('inventory',{}),presentation.load('pastures',{}),presentation.load('nutrition',{}),
        localRows('cattle.events'),localRows('cattle.traceability'),localRows('cattle.body-condition'),localRows('cattle.tasks'),localRows('cattle.pasture-occupancy'),localRows('cattle.pasture-assessments'),localRows('cattle.pasture-rotation-plan'),localRows('cattle.breeding-seasons'),localRows('cattle.reproduction-genetics'),localRows('cattle.reproduction-dose-stock')
      ]);
      const unwrap=rows=>(rows??[]).map(r=>r.payload??r),catalog=unwrap(data.rows);
      return edition.filterReferences({
        lots:unwrap(lots.rows),animals:unwrap(animals.rows),farms:catalog.filter(x=>x.registration!==undefined||x.location!==undefined),breeds:catalog.filter(x=>x.species!==undefined),categories:catalog.filter(x=>x.purpose!==undefined&&x.species===undefined&&x.registration===undefined),parties:unwrap(data.parties),protocols:unwrap(sanitary.protocols),inventory:unwrap(inventory.rows),pastures:unwrap(pastures.rows),nutrition:unwrap(nutrition.rows),
        events,traceability,bodyCondition,tasks,pastureOccupancy,pastureAssessments,rotationPlans,breedingSeasons,reproductionGenetics,reproductionDoseStock
      });
    },
    async load({screenId,auth,context={}}){
      requireScreen(screenId);
      await session(auth,permission(screenId,'read'));
      return edition.sanitizeScreenPayload(screenId,await presentation.load(screenId,context));
    },
    async action({screenId,action,input={},auth,context={}}){
      requireAction(screenId,action);
      const authorized=await session(auth,permission(screenId,'write',action));
      return presentation.action(screenId,action,input,{...context,actorId:authorized.user.id});
    }
  });
}
