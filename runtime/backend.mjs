import {createReproductionManagementService} from '../src/reproduction-management.js';
import {createFieldSyncService} from '../src/field-sync.js';

const clean=screen=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});

export function createRpcBackend({presentation,persistence=null}){
  const security=presentation.services.security;
  const reproductionManagement=persistence?createReproductionManagementService(persistence,{audit:presentation.services.audit}):null;
  const fieldSynchronization=persistence?createFieldSyncService(persistence,{productId:security.productId}):null;
  async function session(auth,permission=null){
    const args={sessionId:auth?.sessionId,token:auth?.token};
    return permission?security.authorize({...args,permission}):security.authenticateSession(args);
  }
  const permission=(screenId,mode,action=null)=>security.permissionFor?.({screenId,mode,action})??null;
  const insightPermission=scope=>scope==='finance'?'finance:read':'cattle:read';
  const authArgs=auth=>({sessionId:auth?.sessionId,token:auth?.token});
  return Object.freeze({
    async describe(auth=null){
      const access={};
      if(auth){for(const id of presentation.screenIds()){access[id]={read:true,actions:[]};try{await session(auth,permission(id,'read'));}catch{access[id].read=false;}for(const action of Object.keys(presentation.screen(id).actions??{})){try{await session(auth,permission(id,'write',action));access[id].actions.push(action);}catch{}}}}
      return{
        productId:security.productId,
        brand:presentation.shell.brand,
        navigation:presentation.shell.navigation,
        screens:presentation.screenIds().map(id=>clean(presentation.screen(id))),
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
    async search({term,auth,collections=null,limit=25}){await session(auth);return presentation.services.search.query({term,collections,limit});},
    async alerts({auth}){await session(auth);return presentation.services.alerts.list();},
    async audit({auth,filter={}}){return security.listAudit({...authArgs(auth),...filter});},
    async insights({scope,auth,options={}}){await session(auth,insightPermission(scope));return presentation.services.reporting.insights(scope,options);},
    async simulateSale({auth,...input}){await session(auth,'finance:read');return presentation.services.reporting.simulateSale(input);},
    async reproductionAdmin({auth,operation='state',input={}}={}){
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
        const result=await fieldSynchronization.importBundle(input.bundle,{apply:command=>presentation.action(command.screenId,command.action,command.input,{actorId:authorized.user.id,fieldSync:true})});
        await presentation.services.audit?.append?.({actorId:authorized.user.id,action:'field.sync.import',entityType:'field-device',entityId:result.state.deviceId,metadata:{applied:result.operations.applied,skipped:result.operations.skipped,conflicts:result.operations.conflicts,snapshotApplied:result.snapshot.applied}});
        return result;
      }
      throw new Error(`Unknown field synchronization operation: ${operation}`);
    },
    async references({auth}){await session(auth);const [lots,animals,data,sanitary,inventory,pastures,nutrition]=await Promise.all([presentation.load('lots',{}),presentation.load('animals',{}),presentation.load('data',{}),presentation.load('sanitary',{}),presentation.load('inventory',{}),presentation.load('pastures',{}),presentation.load('nutrition',{})]);const unwrap=rows=>(rows??[]).map(r=>r.payload??r);const catalog=unwrap(data.rows);return{lots:unwrap(lots.rows),animals:unwrap(animals.rows),farms:catalog.filter(x=>x.registration!==undefined||x.location!==undefined),breeds:catalog.filter(x=>x.species!==undefined),categories:catalog.filter(x=>x.purpose!==undefined&&x.species===undefined&&x.registration===undefined),parties:unwrap(data.parties),protocols:unwrap(sanitary.protocols),inventory:unwrap(inventory.rows),pastures:unwrap(pastures.rows),nutrition:unwrap(nutrition.rows)};},
    async load({screenId,auth,context={}}){
      await session(auth,permission(screenId,'read'));
      return presentation.load(screenId,context);
    },
    async action({screenId,action,input={},auth,context={}}){
      const authorized=await session(auth,permission(screenId,'write',action));
      return presentation.action(screenId,action,input,{...context,actorId:authorized.user.id});
    }
  });
}
