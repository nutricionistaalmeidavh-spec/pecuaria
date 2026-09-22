import React,{useEffect,useMemo,useState} from 'react';
import {Icon} from './icons.jsx';
import {applyP2Density,clearLocalTelemetry,currentP2ProfileKey,exportLocalTelemetry,getLocalTelemetryState,loadP2Preferences,recordLocalTelemetry,saveP2Preferences,setLocalTelemetryEnabled} from './p2-runtime.js';

const dashboardOptions=[
  ['animals','Animais','beef'],['weights','Pesagens','scale'],['sanitary','Sanidade','shield-plus'],['reproduction','Reprodução','heart'],['pastures','Pastagens','map'],['nutrition','Nutrição','wheat'],['finance','Financeiro','wallet-cards'],['reports','Relatórios','file-chart-column'],['tasks','Campo','clipboard-check']
];
const fieldOptions=['Tarefas','Peso','Animal 360º','Mover','Coletivo','Ciclo','Nascimento','Sanidade','Reprodução','Escores','RFID','Rastreio','Pastos','Sincronizar'];

export function useP2Preferences(){
  const [profileKey,setProfileKey]=useState('default');
  const [preferences,setPreferences]=useState(()=>loadP2Preferences('default'));
  useEffect(()=>{
    const key=currentP2ProfileKey();
    setProfileKey(key);
    const next=loadP2Preferences(key);
    setPreferences(next);
    applyP2Density(next.density);
  },[]);
  const update=patch=>{
    const next=saveP2Preferences(profileKey,{...preferences,...patch});
    setPreferences(next);
    recordLocalTelemetry('ui.preference',{surface:'profile',density:next.density});
    return next;
  };
  return{profileKey,preferences,update};
}

export function P2DensityControl({preferences,onChange,compact=false}){
  return <label className={`p2-density-control ${compact?'compact':''}`} data-testid="density-control"><span>Densidade</span><select aria-label="Densidade da interface" value={preferences.density} onChange={event=>onChange({density:event.target.value})}><option value="auto">Automática</option><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>;
}

export function P2DashboardControls({onNavigate}){
  const {profileKey,preferences,update}=useP2Preferences();
  const selected=useMemo(()=>new Set(preferences.dashboardFavorites),[preferences.dashboardFavorites]);
  const toggle=id=>update({dashboardFavorites:selected.has(id)?preferences.dashboardFavorites.filter(item=>item!==id):[...preferences.dashboardFavorites,id]});
  const favorites=dashboardOptions.filter(([id])=>selected.has(id));
  return <section className="p2-preferences-panel" data-testid="p2-preferences" aria-label="Preferências deste perfil">
    <div className="p2-preferences-heading"><div><span className="eyebrow">Preferências do perfil</span><h2>Atalhos e densidade</h2><p>Estas escolhas ficam somente neste computador e neste perfil de acesso.</p></div><P2DensityControl preferences={preferences} onChange={update}/></div>
    <div className="p2-favorites" data-testid="dashboard-favorites" aria-label="Favoritos do dashboard">{favorites.length?favorites.map(([id,label,icon])=><button type="button" key={id} onClick={()=>{recordLocalTelemetry('ui.favorite.open',{surface:'dashboard',target:id});onNavigate(id)}}><Icon name={icon} size={17}/><span>{label}</span></button>):<span className="p2-empty-favorite">Nenhum atalho favorito.</span>}</div>
    <details className="p2-favorite-editor"><summary>Editar favoritos</summary><div className="p2-favorite-options">{dashboardOptions.map(([id,label,icon])=><label key={id}><input type="checkbox" checked={selected.has(id)} onChange={()=>toggle(id)}/><Icon name={icon} size={16}/><span>{label}</span></label>)}</div><small>Perfil local: {profileKey}</small></details>
  </section>;
}

export function P2FieldFavorites({onOpen}){
  const {preferences,update}=useP2Preferences();
  const selected=useMemo(()=>new Set(preferences.fieldFavorites),[preferences.fieldFavorites]);
  const toggle=label=>update({fieldFavorites:selected.has(label)?preferences.fieldFavorites.filter(item=>item!==label):[...preferences.fieldFavorites,label]});
  return <div className="p2-field-favorites" data-testid="field-favorites">
    <div className="p2-field-favorites-row"><span>Favoritos</span>{preferences.fieldFavorites.map(label=><button type="button" key={label} onClick={()=>{recordLocalTelemetry('ui.favorite.open',{surface:'field',target:label});onOpen(label)}}>{label}</button>)}<details><summary aria-label="Editar favoritos de campo">Editar</summary><div className="p2-field-favorite-editor">{fieldOptions.map(label=><label key={label}><input type="checkbox" checked={selected.has(label)} onChange={()=>toggle(label)}/><span>{label}</span></label>)}</div></details></div>
    <P2DensityControl preferences={preferences} onChange={update} compact/>
  </div>;
}

const downloadJson=(filename,value)=>{
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
};

export function P2LocalTelemetryPanel(){
  const [state,setState]=useState(()=>getLocalTelemetryState());
  const last=state.events.at(-1)??null;
  const toggle=()=>{
    const next=setLocalTelemetryEnabled(!state.enabled);
    setState(next);
    if(next.enabled){recordLocalTelemetry('telemetry.enabled',{surface:'settings'});setState(getLocalTelemetryState())}
  };
  return <section className="p2-telemetry" data-testid="local-telemetry-panel"><div className="p2-section-heading"><div><span className="eyebrow">Diagnóstico opcional</span><h3>Telemetria local</h3><p>Registra apenas eventos técnicos de uso e erros neste computador. Nada é enviado para internet ou SaaS.</p></div><button type="button" className={state.enabled?'secondary':'primary'} aria-pressed={state.enabled} onClick={toggle}>{state.enabled?'Desativar registro local':'Ativar registro local'}</button></div><div className="p2-telemetry-summary"><div><span>Status</span><strong>{state.enabled?'Ativa neste computador':'Desativada'}</strong></div><div><span>Eventos armazenados</span><strong>{state.events.length}</strong></div><div><span>Último evento</span><strong>{last?.type??'—'}</strong></div></div><div className="actions"><button type="button" disabled={!state.events.length} onClick={()=>downloadJson(`artisys-telemetria-local-${new Date().toISOString().slice(0,10)}.json`,exportLocalTelemetry())}>Exportar JSON local</button><button type="button" className="ghost" disabled={!state.events.length} onClick={()=>setState(clearLocalTelemetry())}>Limpar eventos</button></div></section>;
}
