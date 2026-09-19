const enc=new TextEncoder();
const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const rand=n=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const bytes=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));

async function hashPassword(password,salt,iterations=120000){
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations},key,256)));
}

const publicUser=u=>({id:u.id,username:u.username,roles:[...u.roles],active:u.active});

export function createProductSecurity(persistence,{productId,policyDefinition={},presentationAccess={},audit=null}={}){
  const users=`security-users:${productId}`;
  const sessions=`security-sessions:${productId}`;
  const can=(roles,permission)=>!permission||roles.some(role=>(policyDefinition[role]??[]).includes('*')||(policyDefinition[role]??[]).includes(permission));
  const permissionFor=({screenId,mode='read',action=null})=>{
    const rule=presentationAccess.screens?.[screenId]??{};
    return action&&rule.actions?.[action]!==undefined
      ? rule.actions[action]
      : rule[mode]!==undefined
        ? rule[mode]
        : mode==='write'
          ? presentationAccess.defaultWrite
          : presentationAccess.defaultRead;
  };
  const auditAppend=event=>audit?.append?audit.append(event):Promise.resolve(null);

  async function userByName(name){
    return (await persistence.listRecords(users)).find(record=>record.payload.username===String(name).toLowerCase())??null;
  }

  async function authorized({sessionId,token,permission=null}){
    const sessionRecord=await persistence.getRecord(sessions,text(sessionId,'Session id'));
    const suppliedHash=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(token)))));
    if(!sessionRecord||sessionRecord.payload.revokedAt||Date.now()>=Date.parse(sessionRecord.payload.expiresAt)||sessionRecord.payload.tokenHash!==suppliedHash){
      throw Object.assign(new Error('authentication required'),{code:'UNAUTHENTICATED'});
    }
    const userRecord=await persistence.getRecord(users,sessionRecord.payload.userId);
    if(!userRecord?.payload?.active)throw Object.assign(new Error('authentication required'),{code:'UNAUTHENTICATED'});
    if(permission&&!can(userRecord.payload.roles,permission))throw Object.assign(new Error(`permission denied: ${permission}`),{code:'FORBIDDEN'});
    return{
      userRecord,
      sessionRecord,
      user:publicUser(userRecord.payload),
      session:{...sessionRecord.payload,tokenHash:undefined}
    };
  }

  return Object.freeze({
    productId,
    permissionFor,
    async hasUsers(){return(await persistence.listRecords(users)).length>0},
    async bootstrapUser({id,username,password,roles=['admin'],active=true}={}){
      if(await this.hasUsers())throw new Error('bootstrap is only allowed with no users');
      if(String(password).length<8)throw new TypeError('password must have at least 8 characters');
      const salt=rand(16);
      const user={
        id:text(id,'user id'),
        username:text(username,'username').toLowerCase(),
        passwordSalt:salt,
        passwordIterations:120000,
        passwordHash:await hashPassword(password,salt),
        roles:[...new Set(roles)],
        active
      };
      await persistence.putRecord(users,user.id,user,{expectedVersion:0});
      await auditAppend({actorId:user.id,action:'security.user.bootstrap',entityType:'user',entityId:user.id,metadata:{roles:user.roles,active:user.active}});
      return publicUser(user);
    },
    async authenticate({username,password}={}){
      const record=await userByName(username),user=record?.payload;
      if(!user||user.passwordHash!==await hashPassword(String(password),user.passwordSalt,user.passwordIterations)){
        throw Object.assign(new Error('invalid credentials'),{code:'UNAUTHENTICATED'});
      }
      const token=rand(32),issuedAt=new Date().toISOString();
      const session={
        id:crypto.randomUUID(),
        userId:user.id,
        roles:user.roles,
        tokenHash:hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(token)))),
        issuedAt,
        expiresAt:new Date(Date.now()+8*3600000).toISOString(),
        revokedAt:null
      };
      await persistence.putRecord(sessions,session.id,session,{expectedVersion:0});
      await auditAppend({actorId:user.id,action:'security.session.login',entityType:'session',entityId:session.id,metadata:{roles:user.roles}});
      return{token,session:{...session,tokenHash:undefined}};
    },
    authenticateSession:args=>authorized(args).then(value=>({user:value.user,session:value.session})),
    authorize:args=>authorized(args).then(value=>({user:value.user,session:value.session})),
    async revoke(args){
      const authorizedSession=await authorized(args);
      const next={...authorizedSession.sessionRecord.payload,revokedAt:new Date().toISOString()};
      await persistence.putRecord(sessions,next.id,next,{expectedVersion:authorizedSession.sessionRecord.version});
      await auditAppend({actorId:authorizedSession.user.id,action:'security.session.revoke',entityType:'session',entityId:next.id,metadata:{}});
      return{...next,tokenHash:undefined};
    },
    async listAudit({sessionId,token,...filter}={}){
      await authorized({sessionId,token,permission:'audit:read'});
      return audit?.list?audit.list(filter):[];
    }
  });
}
