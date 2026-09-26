export function resolveFeatureFlag(name,{defaults={},tenantFlags={},userFlags={}}={}){
  if(Object.hasOwn(userFlags,name))return userFlags[name];
  if(Object.hasOwn(tenantFlags,name))return tenantFlags[name];
  return defaults[name]??false;
}

export function isFeatureEnabled(name,context={}){
  return resolveFeatureFlag(name,context)===true;
}

export function mergeFeatureFlags(...sources){
  return Object.assign({},...sources.filter(Boolean));
}
