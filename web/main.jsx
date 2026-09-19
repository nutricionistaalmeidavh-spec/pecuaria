import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {getActionForm} from './action-config.js';
import {ActionDialog,DataTable,DesktopShell,StatusBanner} from './components.jsx';
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
  return [];
};
const cardLabel=key=>({lots:'Lotes',activeAnimals:'Animais ativos',averageWeightKg:'Peso médio (kg)',sanitaryEvents:'Eventos sanitários',trades:'Negociações'}[key]??key);
const show=v=>v==null?'—':typeof v==='number'?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v):String(v);

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

  useEffect(()=>{getBackend().then(async value=>{setBackend(value);setHasUsers((await value.authState()).hasUsers)}).catch(error=>setNotice({tone:'error',text:error.message}))},[]);
  useEffect(()=>{if(!backend||!auth)return;backend.describe().then(value=>{setMeta(value);setScreenId(current=>current??value.navigation[0]?.id)}).catch(error=>setNotice({tone:'error',text:error.message}))},[backend,auth]);

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
      setAuth({sessionId:result.session.id,token:result.token});
    }catch(error){setNotice({tone:'error',text:error.message})}
  }

  const screen=meta?.screens.find(item=>item.id===screenId);
  const rows=useMemo(()=>pickRows(data),[data]);
  const activeForm=action?getActionForm(screenId,action):null;

  if(!backend)return <div className="boot">Carregando ArtiSys Pecuária…</div>;
  if(!auth)return <div className="login-page"><form className="login-card" onSubmit={login}><div><span className="eyebrow">Gestão pecuária local</span><h1>ArtiSys Pecuária</h1><p>{hasUsers?'Entre para acessar a fazenda.':'Crie o administrador local deste computador.'}</p></div><label><span>Usuário</span><input data-testid="username" autoComplete="username" value={credentials.username} onChange={e=>setCredentials({...credentials,username:e.target.value})}/></label><label><span>Senha</span><input data-testid="password" type="password" minLength="8" autoComplete={hasUsers?'current-password':'new-password'} value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/></label><button data-testid="auth-submit" className="primary">{hasUsers?'Entrar':'Criar administrador'}</button>{notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}</form></div>;
  if(!meta)return <div className="boot" data-testid="authenticated-loading">Carregando ambiente da fazenda…</div>;

  const navigation=<>{meta.navigation.map(item=><button key={item.id} data-testid={`nav-${item.id}`} className={`nav-item ${item.id===screenId?'on':''}`} onClick={()=>{setScreenId(item.id);setNotice(null)}}>{item.label}</button>)}</>;
  const brand=<div><strong>{meta.brand.productName??meta.brand.name??'ArtiSys Pecuária'}</strong><span>Operação local-first</span></div>;

  return <DesktopShell brand={brand} navigation={navigation} title={screen?.title??'Visão geral'} onLogout={()=>{setAuth(null);setMeta(null);setScreenId(null);setData(null)}}>
    {notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}
    {data?.cards&&<section className="cards">{Object.entries(data.cards).map(([key,value])=><article key={key}><span>{cardLabel(key)}</span><strong>{show(value)}</strong></article>)}</section>}
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Operação</span><h2>{screen?.title}</h2></div><div className="actions">{Object.entries(screen?.actionDefinitions??{}).map(([name,definition])=><button key={name} data-testid={`action-${screenId}-${name}`} onClick={()=>{setAction(name);setNotice(null)}}>{definition.label??name}</button>)}</div></div><DataTable records={rows}/></section>
    <ActionDialog open={Boolean(action)} definition={activeForm} busy={busy} onClose={()=>setAction(null)} onSubmit={async input=>{setBusy(true);setNotice(null);try{await backend.action({screenId,action,input,auth,context:{}});setAction(null);setNotice({tone:'success',text:'Operação concluída com sucesso.'});await load()}catch(error){setNotice({tone:'error',text:error.message})}finally{setBusy(false)}}}/>
  </DesktopShell>;
}

createRoot(document.getElementById('root')).render(<App/>);
