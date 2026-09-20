import {createReproductionManagementService} from '../src/reproduction-management.js';

const clean=screen=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});

export function createRpcBackend({presentation,persistence=null}){
  const security=presentation.services.security;
  const reproductionManagement=persistence?createReproductionManagementService(persistence,{audit:presentation.services.audit}):null;
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
