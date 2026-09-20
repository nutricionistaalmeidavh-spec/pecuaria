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
  const profileRows=()=>Object.entries(policyDefinition).map(([id,permissions])=>({id,permissions:[...permissions]}));
  const normalizeRoles=value=>{
    const roles=[...new Set(Array.isArray(value)?value:[])];
    if(!roles.length)throw new TypeError('At least one role is required.');
    for(const role of roles)if(!Object.hasOwn(policyDefinition,role))throw new TypeError(`Unknown role: ${role}`);
    return roles;
  };

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

  async function admin(args){return authorized({...args,permission:'security:admin'})}
  async function ensureUniqueUsername(username,exceptId=null){
    const existing=await userByName(username);
    if(existing&&existing.payload.id!==exceptId)throw new Error('username already exists');
  }
  async function ensureAdminSurvives(current,next){
    if(!current.active||!current.roles.includes('admin'))return;
    if(next.active&&next.roles.includes('admin'))return;
    const activeAdmins=(await persistence.listRecords(users)).filter(record=>record.payload.active&&record.payload.roles.includes('admin')&&record.payload.id!==current.id);
    if(activeAdmins.length===0)throw new Error('last active admin cannot be disabled or demoted');
  }
  async function passwordFields(password){
    if(String(password).length<8)throw new TypeError('password must have at least 8 characters');
    const salt=rand(16);
    return{passwordSalt:salt,passwordIterations:120000,passwordHash:await hashPassword(password,salt)};
  }

  return Object.freeze({
    productId,
    permissionFor,
    async hasUsers(){return(await persistence.listRecords(users)).length>0},
    async bootstrapUser({id,username,password,roles=['admin'],active=true}={}){
      if(await this.hasUsers())throw new Error('bootstrap is only allowed with no users');
      const credentials=await passwordFields(password);
      const user={
        id:text(id,'user id'),
        username:text(username,'username').toLowerCase(),
        ...credentials,
        roles:normalizeRoles(roles),
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
    },
    async listProfiles(args={}){
      await admin(args);
      return profileRows();
    },
    async listUsers(args={}){
      await admin(args);
      return (await persistence.listRecords(users)).map(record=>({...publicUser(record.payload),version:record.version})).sort((a,b)=>a.username.localeCompare(b.username));
    },
    async createUser({sessionId,token,user}={}){
      const actor=await admin({sessionId,token});
      if(!user)throw new TypeError('user is required');
      const username=text(user.username,'username').toLowerCase();
      await ensureUniqueUsername(username);
      const credentials=await passwordFields(user.password);
      const next={id:text(user.id,'user id'),username,...credentials,roles:normalizeRoles(user.roles),active:user.active!==false};
      await persistence.putRecord(users,next.id,next,{expectedVersion:0});
      await auditAppend({actorId:actor.user.id,action:'security.user.create',entityType:'user',entityId:next.id,metadata:{username:next.username,roles:next.roles,active:next.active}});
      return publicUser(next);
    },
    async updateUser({sessionId,token,id,changes={}}={}){
      const actor=await admin({sessionId,token});
      const record=await persistence.getRecord(users,text(id,'user id'));
      if(!record)throw new Error('user not found');
      const current=record.payload;
      const username=changes.username===undefined?current.username:text(changes.username,'username').toLowerCase();
      await ensureUniqueUsername(username,current.id);
      const next={...current,username,roles:changes.roles===undefined?current.roles:normalizeRoles(changes.roles),active:changes.active===undefined?current.active:Boolean(changes.active)};
      await ensureAdminSurvives(current,next);
      await persistence.putRecord(users,next.id,next,{expectedVersion:record.version});
      await auditAppend({actorId:actor.user.id,action:'security.user.update',entityType:'user',entityId:next.id,metadata:{username:next.username,roles:next.roles,active:next.active}});
      return publicUser(next);
    },
    async resetUserPassword({sessionId,token,id,password}={}){
      const actor=await admin({sessionId,token});
      const record=await persistence.getRecord(users,text(id,'user id'));
      if(!record)throw new Error('user not found');
      const credentials=await passwordFields(password);
      const next={...record.payload,...credentials};
      await persistence.putRecord(users,next.id,next,{expectedVersion:record.version});
      await auditAppend({actorId:actor.user.id,action:'security.user.password.reset',entityType:'user',entityId:next.id,metadata:{}});
      return publicUser(next);
    }
  });
}
