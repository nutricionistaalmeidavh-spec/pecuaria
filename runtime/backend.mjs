const clean=screen=>({id:screen.id,title:screen.title,kind:screen.kind,actionDefinitions:screen.actionDefinitions??{}});

export function createRpcBackend({presentation}){
  const security=presentation.services.security;
  async function session(auth,permission=null){
    const args={sessionId:auth?.sessionId,token:auth?.token};
    return permission?security.authorize({...args,permission}):security.authenticateSession(args);
  }
  const permission=(screenId,mode,action=null)=>security.permissionFor?.({screenId,mode,action})??null;
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
