const PREFIX='artisys-pecuaria:p2';
const PREFS_PREFIX=`${PREFIX}:prefs:`;
const TELEMETRY_KEY=`${PREFIX}:telemetry`;
const TELEMETRY_LIMIT=200;

const defaults={
  density:'auto',
  dashboardFavorites:['animals','weights','sanitary'],
  fieldFavorites:['Peso','Mover','Sanidade']
};

const parse=(value,fallback)=>{try{return JSON.parse(value??'null')??fallback}catch{return fallback}};
const unique=items=>[...new Set((items??[]).filter(Boolean).map(String))];
const storage=()=>typeof localStorage==='undefined'?null:localStorage;

export function currentP2ProfileKey(){
  if(typeof document==='undefined')return'default';
  const ids=[...document.querySelectorAll('[data-testid^="nav-"]')].map(node=>node.getAttribute('data-testid')?.replace('nav-','')).filter(Boolean).sort();
  return ids.length?`access-${ids.join('.')}`:'default';
}

export function loadP2Preferences(profileKey=currentP2ProfileKey()){
  const raw=parse(storage()?.getItem(`${PREFS_PREFIX}${profileKey}`),{});
  return{
    density:['auto','comfortable','compact'].includes(raw.density)?raw.density:defaults.density,
    dashboardFavorites:unique(raw.dashboardFavorites?.length?raw.dashboardFavorites:defaults.dashboardFavorites),
    fieldFavorites:unique(raw.fieldFavorites?.length?raw.fieldFavorites:defaults.fieldFavorites)
  };
}

export function saveP2Preferences(profileKey=currentP2ProfileKey(),input={}){
  const next={...loadP2Preferences(profileKey),...input};
  next.dashboardFavorites=unique(next.dashboardFavorites);
  next.fieldFavorites=unique(next.fieldFavorites);
  storage()?.setItem(`${PREFS_PREFIX}${profileKey}`,JSON.stringify(next));
  applyP2Density(next.density);
  return next;
}

export function applyP2Density(density='auto'){
  if(typeof document==='undefined')return density;
  const normalized=['auto','comfortable','compact'].includes(density)?density:'auto';
  document.documentElement.dataset.density=normalized;
  return normalized;
}

export function getLocalTelemetryState(){
  const stored=parse(storage()?.getItem(TELEMETRY_KEY),{});
  return{
    enabled:stored.enabled===true,
    events:Array.isArray(stored.events)?stored.events.slice(-TELEMETRY_LIMIT):[]
  };
}

export function setLocalTelemetryEnabled(enabled){
  const state=getLocalTelemetryState();
  const next={...state,enabled:Boolean(enabled)};
  storage()?.setItem(TELEMETRY_KEY,JSON.stringify(next));
  return next;
}

export function clearLocalTelemetry(){
  const state=getLocalTelemetryState();
  const next={enabled:state.enabled,events:[]};
  storage()?.setItem(TELEMETRY_KEY,JSON.stringify(next));
  return next;
}

const safeDetail=detail=>{
  const source=detail&&typeof detail==='object'?detail:{};
  return Object.fromEntries(Object.entries(source).filter(([key,value])=>{
    if(/password|token|secret|credential|payload|input|document|email|phone|name/i.test(key))return false;
    return ['string','number','boolean'].includes(typeof value)&&String(value).length<=120;
  }));
};

export function recordLocalTelemetry(type,detail={}){
  const state=getLocalTelemetryState();
  if(!state.enabled)return false;
  const event={id:crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`,type:String(type),occurredAt:new Date().toISOString(),detail:safeDetail(detail)};
  const next={enabled:true,events:[...state.events,event].slice(-TELEMETRY_LIMIT)};
  storage()?.setItem(TELEMETRY_KEY,JSON.stringify(next));
  return true;
}

export function exportLocalTelemetry(){
  const state=getLocalTelemetryState();
  return{format:'artisys-pecuaria-local-telemetry',version:1,createdAt:new Date().toISOString(),events:state.events};
}

export function installLocalTelemetryErrorCapture(){
  if(typeof window==='undefined'||window.__artisysP2TelemetryInstalled)return;
  window.__artisysP2TelemetryInstalled=true;
  window.addEventListener('error',event=>recordLocalTelemetry('ui.error',{message:String(event?.message??'erro de interface').slice(0,120)}));
  window.addEventListener('unhandledrejection',event=>recordLocalTelemetry('ui.unhandled-rejection',{message:String(event?.reason?.message??event?.reason??'rejeição não tratada').slice(0,120)}));
}

installLocalTelemetryErrorCapture();
