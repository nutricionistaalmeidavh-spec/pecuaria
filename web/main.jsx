import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {getActionForm} from './action-config.js';
import {ActionDialog,AnimalDetail,CorralFlow,DataTable,DesktopShell,StatusBanner,WorkspaceScreen,FinanceMetrics,ReproductionSummary} from './components.jsx';
import {OverviewDashboard} from './dashboard.jsx';
import {Icon} from './icons.jsx';
import './styles.css';

async function getBackend(){
  if(globalThis.artisys)return globalThis.artisys;
  const persistence=createBrowserPersistence({productId:'agro-pecuaria'});
  const recovery=createBrowserRecovery(persistence);
  return createRpcBackend({presentation:createCattlePresentation({persistence,recovery})});
}

const pickRows=data=>{
  if(Array.isArray(data))return data;
  if(Array.isArray(data?.rows))return data.rows;
  if(Array.isArray(data?.records))return data.records;
  if(Array.isArray(data?.events))return data.events;
  if(Array.isArray(data?.protocols))return data.protocols;
  if(Array.isArray(data?.backups))return data.backups;
  if(Array.isArray(data?.devices))return data.devices;
  return [];
};

function UpdatePanel({updates,state,onState}){
  const [busy,setBusy]=useState(false);
  if(!updates||!state)return null;
  const version=state.availableVersion?` ${state.availableVersion}`:'';
  const progress=Math.max(0,Math.min(100,Math.round(state.progress?.percent??0)));
  const run=async fn=>{setBusy(true);try{onState(await fn())}finally{setBusy(false)}};
  if(state.status==='available')return <section className="panel" data-testid="update-available"><div className="panel-heading"><div><span className="eyebrow">Atualização disponível</span><h2>Nova versão{version}</h2><p>O download só começa quando você autorizar.</p></div><div className="actions"><button className="primary" disabled={busy} onClick={()=>void run(updates.download)}>Baixar atualização</button></div></div></section>;
  if(state.status==='downloading')return <StatusBanner tone="info">Baixando atualização… {progress}%</StatusBanner>;
  if(state.status==='downloaded')return <section className="panel" data-testid="update-downloaded"><div className="panel-heading"><div><span className="eyebrow">Atualização pronta</span><h2>Versão{version} baixada</h2><p>A instalação só ocorre quando você escolher reiniciar.</p></div><div className="actions"><button className="primary" disabled={busy} onClick={()=>void run(updates.install)}>Instalar e reiniciar</button></div></div></section>;
  return null;
}

function App(){
  const [backend,setBackend]=useState(null);
  const [auth,setAuth]=useState(null);
  const [meta,setMeta]=useState(null);
  const [screenId,setScreenId]=useState(null);
  const [data,setData]=useState(null);
  const [action,setAction]=useState(null);
  const [busy,setBusy]=useState(false);
  const [credentials,setCredentials]=useState({username:'admin',password:''});
  const [hasUsers,setHasUsers]=useState(true);
  const [notice,setNotice]=useState(null);
  const [updateState,setUpdateState]=useState(null);
  const [searchResults,setSearchResults]=useState(null);
  const [alertResults,setAlertResults]=useState(null);
  const [references,setReferences]=useState({});
  const [animalDetail,setAnimalDetail]=useState(null);
  const updates=globalThis.artisys?.updates??null;

  useEffect(()=>{getBackend().then(async value=>{setBackend(value);setHasUsers((await value.authState()).hasUsers)}).catch(error=>setNotice({tone:'error',text:error.message}))},[]);
  useEffect(()=>{if(!updates)return;let active=true;updates.state().then(state=>{if(active)setUpdateState(state)}).catch(()=>{});const unsubscribe=updates.onStatus(state=>{if(active)setUpdateState(state)});return()=>{active=false;unsubscribe?.()}},[updates]);
  useEffect(()=>{if(!backend||!auth)return;backend.describe(auth).then(value=>{setMeta(value);setScreenId(current=>current??value.navigation[0]?.id)}).catch(error=>setNotice({tone:'error',text:error.message}))},[backend,auth]);

  async function load(id=screenId){
    if(!backend||!auth||!id)return;
    try{setData(await backend.load({screenId:id,auth,context:{}}))}catch(error){setNotice({tone:'error',text:error.message})}
  }
  useEffect(()=>{void load(screenId)},[screenId,meta]);

  async function login(event){
    event.preventDefault();setNotice(null);
    try{
      if(!hasUsers)await backend.bootstrap(credentials);
      const result=await backend.login(credentials);
      setMeta(null);
      setScreenId(null);
      const nextAuth={sessionId:result.session.id,token:result.token};setAuth(nextAuth);backend.references({auth:nextAuth}).then(setReferences).catch(()=>{});
    }catch(error){setNotice({tone:'error',text:error.message})}
  }

  const screen=meta?.screens.find(item=>item.id===screenId);
  const screenNavigation=meta?.navigation.find(item=>item.id===screenId);
  const rows=useMemo(()=>pickRows(data),[data]);
  const activeForm=action?getActionForm(screenId,action):null;

  if(!backend)return <div className="boot">Carregando ArtiSys Pecuária…</div>;
  if(!auth)return <div className="login-page"><form className="login-card" onSubmit={login}><div><span className="eyebrow">Gestão pecuária local</span><h1>ArtiSys Pecuária</h1><p>{hasUsers?'Entre para acessar a fazenda.':'Crie o administrador local deste computador.'}</p></div><label><span>Usuário</span><input data-testid="username" autoComplete="username" value={credentials.username} onChange={e=>setCredentials({...credentials,username:e.target.value})}/></label><label><span>Senha</span><input data-testid="password" type="password" minLength="8" autoComplete={hasUsers?'current-password':'new-password'} value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/></label><button data-testid="auth-submit" className="primary">{hasUsers?'Entrar':'Criar administrador'}</button>{notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}</form></div>;
  if(!meta)return <div className="boot" data-testid="authenticated-loading">Carregando ambiente da fazenda…</div>;

  const navigate=(id,targetId=null)=>{setScreenId(id);setNotice(null);setAnimalDetail(null);if(targetId&&id==='animals')backend.load({screenId:'animals',auth,context:{animalId:targetId}}).then(x=>setAnimalDetail(x.detail)).catch(()=>{});};
  const openEntity=result=>{const collection=String(result?.collection??result?.entityType??'');const id=result?.id??result?.entityId??result?.animalId??null;if(collection.includes('animal'))return navigate('animals',id);if(collection.includes('lot'))return navigate('lots');if(collection.includes('inventory'))return navigate('inventory');if(collection.includes('traceability'))return navigate('traceability');if(collection.includes('task'))return navigate('tasks');return null;};
  const runAction=async(screenId,action,input)=>backend.action({screenId,action,input,auth,context:{}});
  const navigation=<>{meta.navigation.map(item=><button key={item.id} data-testid={`nav-${item.id}`} className={`nav-item ${item.id===screenId?'on':''}`} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={19}/><span>{item.label}</span></button>)}</>;
  const brand=<div className="brand-lockup"><span className="brand-mark"><Icon name="beef" size={26}/></span><span><strong>{meta.brand.productName??meta.brand.name??'ArtiSys Pecuária'}</strong><small>Pecuária</small></span></div>;

  return <DesktopShell brand={brand} navigation={navigation} title={screen?.title??'Dashboard'} notificationCount={screenId==='overview'?(data?.alerts?.length??0):0}
    onSearch={async term=>{try{setSearchResults(await backend.search({term,auth}));setAlertResults(null)}catch(error){setNotice({tone:'error',text:error.message})}}}
    onNotifications={async()=>{try{setAlertResults(await backend.alerts({auth}));setSearchResults(null)}catch(error){setNotice({tone:'error',text:error.message})}}}
    onLogout={()=>{setAuth(null);setMeta(null);setScreenId(null);setData(null)}}>
    {notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}
    {searchResults&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Busca global</span><h2>Resultados</h2><p>{searchResults.length} registro(s) encontrado(s).</p></div><button className="ghost" onClick={()=>setSearchResults(null)}>Fechar</button></div><DataTable records={searchResults}/><div className="actions">{searchResults.map((r,i)=><button data-testid={`search-open-${i}`} key={r.id??i} onClick={()=>{openEntity(r);setSearchResults(null)}}>Abrir registro</button>)}</div></section>}
    {alertResults&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Central de alertas</span><h2>Pendências</h2><p>{alertResults.length} alerta(s) operacional(is).</p></div><button className="ghost" onClick={()=>setAlertResults(null)}>Fechar</button></div><DataTable records={alertResults}/><div className="actions">{alertResults.filter(a=>a.target).map(a=><button key={a.id} onClick={()=>{navigate(a.target,a.targetId);setAlertResults(null)}}>Abrir {a.target}</button>)}</div></section>}
    <UpdatePanel updates={updates} state={updateState} onState={setUpdateState}/>
    {screenId==='settings'&&updates&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Aplicativo</span><h2>Atualizações</h2><p>Versão instalada: {updateState?.currentVersion??'—'}.</p></div><div className="actions"><button data-testid="check-updates" onClick={async()=>{setUpdateState(await updates.check())}}>Verificar atualizações</button></div></div>{updateState?.status==='current'&&<StatusBanner tone="success">Você está usando a versão mais recente.</StatusBanner>}{updateState?.status==='error'&&<StatusBanner tone="error">Não foi possível verificar atualizações agora. O sistema continua disponível offline.</StatusBanner>}</section>}
    {screenId==='overview'?<OverviewDashboard data={data} onNavigate={navigate}/>:<>{screenId==='finance'&&<FinanceMetrics metrics={data?.metrics}/>} {screenId==='reproduction'&&<ReproductionSummary records={rows}/>} {screenId==='weights'&&<CorralFlow animals={references.animals??[]} onRecord={async input=>{await runAction('weights','record',input);await load('weights');backend.references({auth}).then(setReferences)}}/>}{screenId==='animals'&&animalDetail&&<AnimalDetail detail={animalDetail} onClose={()=>setAnimalDetail(null)}/>}<WorkspaceScreen screenId={screenId} screen={screen} icon={screenNavigation?.icon} records={rows} secondaryRecords={screenId==='inventory'?data?.movements:screenId==='pastures'?data?.occupancy:null} secondaryTitle={screenId==='inventory'?'Histórico de movimentações':screenId==='pastures'?'Histórico de ocupação':null} allowedActions={meta?.access?.[screenId]?.actions??[]}  onAction={async name=>{if(screenId==='animals'&&name==='view360')return;setAction(name);setNotice(null)}}/>{screenId==='animals'&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Ficha individual</span><h2>Abrir animal 360º</h2></div></div><div className="form-grid"><label><span>Animal</span><select defaultValue="" onChange={async e=>{if(!e.target.value)return;const detailData=await backend.load({screenId:'animals',auth,context:{animalId:e.target.value}});setAnimalDetail(detailData.detail)}}><option value="">Selecione</option>{(references.animals??[]).map(a=><option key={a.id} value={a.id}>{a.tag??a.name??a.id}</option>)}</select></label></div></section>}</>}
    <ActionDialog open={Boolean(action)} definition={activeForm} references={references} busy={busy} onClose={()=>setAction(null)} onSubmit={async input=>{setBusy(true);setNotice(null);try{await backend.action({screenId,action,input,auth,context:{}});setAction(null);setNotice({tone:'success',text:'Operação concluída com sucesso.'});await load();backend.references({auth}).then(setReferences).catch(()=>{})}catch(error){setNotice({tone:'error',text:error.message})}finally{setBusy(false)}}}/>
  </DesktopShell>;
}

createRoot(document.getElementById('root')).render(<App/>);
