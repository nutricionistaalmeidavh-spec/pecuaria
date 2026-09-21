import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserPersistence,createBrowserRecovery} from '../shared/packages/vertical-persistence/src/browser.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from '../runtime/backend.mjs';
import {getActionForm} from './action-config.js';
import {ActionDialog,AnimalDetail,CorralFlow,DataTable,DesktopShell,StatusBanner,WorkspaceScreen,FinanceMetrics,ReproductionSummary} from './components.jsx';
import {OverviewDashboard} from './dashboard.jsx';
import {ActionResultPanel,PastureDecisionPanel,ReproductionDecisionPanel,SanitaryAnalyticsPanel,ProductiveIntelligencePanel,FinanceDecisionPanel,CommercialSummaryPanel,CommercialSimulator,AdvancedReportsPanel,IoTDetailsPanel} from './depth-components.jsx';
import {SanitaryApplicationsPanel} from './depth-operations.jsx';
import {ProfessionalReproductionPanel,UserAdministrationPanel} from './pro-management.jsx';
import {FieldMobileWorkspace} from './field-mobile.jsx';
import {FinanceAdminWorkspace} from './finance-admin.jsx';
import {PastureManagementWorkspace} from './pasture-management.jsx';
import {Icon} from './icons.jsx';
import './styles.css';

async function getBackend(){
  if(globalThis.artisys)return globalThis.artisys;
  const persistence=createBrowserPersistence({productId:'agro-pecuaria'});
  const recovery=createBrowserRecovery(persistence);
  return createRpcBackend({presentation:createCattlePresentation({persistence,recovery}),persistence});
}

const pickRows=data=>{
  if(Array.isArray(data))return data;
  if(Array.isArray(data?.rows))return data.rows;
  if(Array.isArray(data?.records))return data.records;
  if(Array.isArray(data?.events))return data.events;
  if(Array.isArray(data?.issued))return data.issued;
  if(Array.isArray(data?.protocols))return data.protocols;
  if(Array.isArray(data?.backups))return data.backups;
  if(Array.isArray(data?.devices))return data.devices;
  return [];
};

const safeName=value=>String(value??'arquivo').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'arquivo';
const today=()=>new Date().toISOString().slice(0,10);

function downloadActionResult(result){
  if(!result)return null;
  if(result.format==='artisys-pecuaria-export'){
    const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`artisys-${safeName(result.collection)}-${today()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    return{format:result.format,collection:result.collection,recordCount:result.records?.length??0,downloaded:true};
  }
  if(result.content!=null&&['csv','pdf'].includes(result.format)){
    const mime=result.mimeType??(result.format==='pdf'?'application/pdf':'text/csv;charset=utf-8');
    const blob=new Blob([result.content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${safeName(result.type??'relatorio')}-${today()}.${result.format}`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    return{type:result.type,format:result.format,rowCount:result.rowCount??null,size:result.size??blob.size,downloaded:true};
  }
  return null;
}

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
  const [financeLotId,setFinanceLotId]=useState('');
  const [actionResult,setActionResult]=useState(null);
  const [auditResults,setAuditResults]=useState(null);
  const [depthInsights,setDepthInsights]=useState(null);
  const [simulationResult,setSimulationResult]=useState(null);
  const [reproductionAdminState,setReproductionAdminState]=useState(null);
  const [userAdminState,setUserAdminState]=useState(null);
  const [fieldSyncState,setFieldSyncState]=useState(null);
  const updates=globalThis.artisys?.updates??null;

  useEffect(()=>{getBackend().then(async value=>{setBackend(value);setHasUsers((await value.authState()).hasUsers)}).catch(error=>setNotice({tone:'error',text:error.message}))},[]);
  useEffect(()=>{if(!updates)return;let active=true;updates.state().then(state=>{if(active)setUpdateState(state)}).catch(()=>{});const unsubscribe=updates.onStatus(state=>{if(active)setUpdateState(state)});return()=>{active=false;unsubscribe?.()}},[updates]);
  useEffect(()=>{if(!backend||!auth)return;backend.describe(auth).then(value=>{setMeta(value);setScreenId(current=>current??value.navigation[0]?.id)}).catch(error=>setNotice({tone:'error',text:error.message}))},[backend,auth]);

  async function load(id=screenId,context=null){
    if(!backend||!auth||!id)return;
    const resolvedContext=context??(id==='finance'&&financeLotId?{lotId:financeLotId}:{});
    try{setData(await backend.load({screenId:id,auth,context:resolvedContext}))}catch(error){setNotice({tone:'error',text:error.message})}
  }
  useEffect(()=>{void load(screenId)},[screenId,meta,financeLotId]);

  useEffect(()=>{
    if(!backend||!auth||!screenId)return;
    const scope={pastures:'pastures',reproduction:'reproduction',sanitary:'sanitary',weights:'performance',finance:'finance',trades:'commercial'}[screenId];
    if(!scope){setDepthInsights(null);return;}
    let active=true;
    backend.insights({scope,auth,options:{}}).then(value=>{if(active)setDepthInsights(value)}).catch(error=>{if(active){setDepthInsights(null);setNotice({tone:'error',text:error.message})}});
    return()=>{active=false};
  },[backend,auth,screenId,data]);

  useEffect(()=>{
    if(!backend||!auth||screenId!=='reproduction'){setReproductionAdminState(null);return;}
    let active=true;backend.reproductionAdmin({auth,operation:'state'}).then(value=>{if(active)setReproductionAdminState(value)}).catch(error=>{if(active)setNotice({tone:'error',text:error.message})});return()=>{active=false};
  },[backend,auth,screenId,data]);

  useEffect(()=>{
    if(!backend||!auth||screenId!=='settings'){setUserAdminState(null);return;}
    let active=true;backend.userAdmin({auth,operation:'state'}).then(value=>{if(active)setUserAdminState(value)}).catch(()=>{if(active)setUserAdminState(null)});return()=>{active=false};
  },[backend,auth,screenId]);

  useEffect(()=>{
    if(!backend||!auth||screenId!=='tasks'){setFieldSyncState(null);return;}
    let active=true;backend.fieldSync({auth,operation:'state'}).then(value=>{if(active)setFieldSyncState(value)}).catch(error=>{if(active)setNotice({tone:'error',text:error.message})});return()=>{active=false};
  },[backend,auth,screenId,data]);

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

  function surfaceResult(result,{screen=screenId,name=action}={}){
    const downloaded=downloadActionResult(result);
    if(downloaded){setActionResult(downloaded);return;}
    const shouldShow=(screen==='data'&&name==='validateImport')||(screen==='iot'&&['testDevice','startDevice','stopDevice','simulateRfid','simulateWeight'].includes(name))||(screen==='finance'&&['importStatement','importInvoiceXml'].includes(name));
    if(shouldShow&&result!=null)setActionResult(result);
  }

  if(!backend)return <div className="boot">Carregando ArtiSys Pecuária…</div>;
  if(!auth)return <div className="login-page"><form className="login-card" onSubmit={login}><div><span className="eyebrow">Gestão pecuária local</span><h1>ArtiSys Pecuária</h1><p>{hasUsers?'Entre para acessar a fazenda.':'Crie o administrador local deste computador.'}</p></div><label><span>Usuário</span><input data-testid="username" autoComplete="username" value={credentials.username} onChange={e=>setCredentials({...credentials,username:e.target.value})}/></label><label><span>Senha</span><input data-testid="password" type="password" minLength="8" autoComplete={hasUsers?'current-password':'new-password'} value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/></label><button data-testid="auth-submit" className="primary">{hasUsers?'Entrar':'Criar administrador'}</button>{notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}</form></div>;
  if(!meta)return <div className="boot" data-testid="authenticated-loading">Carregando ambiente da fazenda…</div>;

  const navigate=(id,targetId=null)=>{setScreenId(id);setNotice(null);setAnimalDetail(null);setActionResult(null);setSimulationResult(null);if(targetId&&id==='animals')backend.load({screenId:'animals',auth,context:{animalId:targetId}}).then(x=>setAnimalDetail(x.detail)).catch(()=>{});};
  const openEntity=result=>{
    const collection=String(result?.collection??result?.entityType??''),id=result?.id??result?.entityId??result?.animalId??null,payload=result?.payload??{};
    if(collection.includes('animal'))return navigate('animals',id);
    if(collection.includes('lot'))return navigate('lots');
    if(collection.includes('sanitary-protocol'))return navigate('sanitary');
    if(collection.includes('event'))return navigate(payload.kind==='reproduction'?'reproduction':'sanitary');
    if(collection.includes('trade'))return navigate('trades');
    if(collection.includes('finance'))return navigate('finance');
    if(collection.includes('inventory'))return navigate('inventory');
    if(collection.includes('traceability'))return navigate('traceability');
    if(collection.includes('pasture'))return navigate('pastures');
    if(collection.includes('nutrition'))return navigate('nutrition');
    if(collection.includes('task'))return navigate('tasks');
    if(['party','farm','breed','categor'].some(key=>collection.includes(key)))return navigate('data');
    if(collection.includes('iot'))return navigate('iot');
    return null;
  };
  const runAction=async(id,name,input)=>backend.action({screenId:id,action:name,input,auth,context:{}});
  const runReproductionAdmin=async(operation,input)=>{try{await backend.reproductionAdmin({auth,operation,input});setReproductionAdminState(await backend.reproductionAdmin({auth,operation:'state'}));if(operation==='recordService')await load('reproduction');setNotice({tone:'success',text:'Gestão reprodutiva atualizada.'})}catch(error){setNotice({tone:'error',text:error.message});throw error}};
  const runUserAdmin=async(operation,input)=>{try{await backend.userAdmin({auth,operation,input});setUserAdminState(await backend.userAdmin({auth,operation:'state'}));setNotice({tone:'success',text:'Administração de usuários atualizada.'})}catch(error){setNotice({tone:'error',text:error.message});throw error}};
  const runFieldSync=async(operation,input={})=>{try{const result=await backend.fieldSync({auth,operation,input});const nextState=result?.state??(operation==='state'?result:await backend.fieldSync({auth,operation:'state'}));setFieldSyncState(nextState);if(operation==='quick'||operation==='importBundle'){await load('tasks');backend.references({auth}).then(setReferences).catch(()=>{})}if(operation==='quick')setNotice({tone:'success',text:nextState?.pending?`Manejo salvo localmente. ${nextState.pending} operação(ões) aguardando sincronização.`:'Manejo salvo localmente.'});if(operation==='importBundle')setNotice({tone:'success',text:`Pacote local importado: ${result.operations?.applied??0} operação(ões) aplicada(s).`});if(operation==='configure')setNotice({tone:'success',text:'Sincronização local configurada.'});return result}catch(error){setNotice({tone:'error',text:error.message});throw error}};
  const navigation=<>{meta.navigation.map(item=><button key={item.id} data-testid={`nav-${item.id}`} className={`nav-item ${item.id===screenId?'on':''}`} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={19}/><span>{item.label}</span></button>)}</>;
  const brand=<div className="brand-lockup"><span className="brand-mark"><Icon name="beef" size={26}/></span><span><strong>{meta.brand.productName??meta.brand.name??'ArtiSys Pecuária'}</strong><small>Pecuária</small></span></div>;
  const secondaryRecords=screenId==='inventory'?data?.movements:screenId==='pastures'?data?.occupancy:screenId==='sanitary'?data?.protocols:null;
  const secondaryTitle=screenId==='inventory'?'Histórico de movimentações':screenId==='pastures'?'Histórico de ocupação':screenId==='sanitary'?'Protocolos sanitários':null;
  const reproductionFemales=(references.animals??[]).filter(animal=>animal.status==='active'&&animal.sex==='female');

  return <DesktopShell brand={brand} navigation={navigation} title={screen?.title??'Dashboard'} notificationCount={screenId==='overview'?(data?.alerts?.length??0):0}
    onSearch={async term=>{try{setSearchResults(await backend.search({term,auth}));setAlertResults(null)}catch(error){setNotice({tone:'error',text:error.message})}}}
    onNotifications={async()=>{try{setAlertResults(await backend.alerts({auth}));setSearchResults(null)}catch(error){setNotice({tone:'error',text:error.message})}}}
    onLogout={async()=>{try{await backend.logout(auth)}catch{}finally{setAuth(null);setMeta(null);setScreenId(null);setData(null);setReferences({});setActionResult(null);setAuditResults(null);setDepthInsights(null);setSimulationResult(null);setReproductionAdminState(null);setUserAdminState(null);setFieldSyncState(null)}}}>
    {notice&&<StatusBanner tone={notice.tone}>{notice.text}</StatusBanner>}
    {actionResult&&<ActionResultPanel result={actionResult} onClose={()=>setActionResult(null)}/>} 
    {searchResults&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Busca global</span><h2>Resultados</h2><p>{searchResults.length} registro(s) encontrado(s).</p></div><button className="ghost" onClick={()=>setSearchResults(null)}>Fechar</button></div><DataTable records={searchResults}/><div className="actions">{searchResults.map((r,i)=><button data-testid={`search-open-${i}`} key={r.id??i} onClick={()=>{openEntity(r);setSearchResults(null)}}>Abrir registro</button>)}</div></section>}
    {alertResults&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Central de alertas</span><h2>Pendências</h2><p>{alertResults.length} alerta(s) operacional(is).</p></div><button className="ghost" onClick={()=>setAlertResults(null)}>Fechar</button></div><DataTable records={alertResults}/><div className="actions">{alertResults.filter(a=>a.target).map(a=><button key={a.id} onClick={()=>{navigate(a.target,a.targetId);setAlertResults(null)}}>Abrir {a.target}</button>)}</div></section>}
    <UpdatePanel updates={updates} state={updateState} onState={setUpdateState}/>
    {screenId==='settings'&&updates&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Aplicativo</span><h2>Atualizações</h2><p>Versão instalada: {updateState?.currentVersion??'—'}.</p></div><div className="actions"><button data-testid="check-updates" onClick={async()=>{setUpdateState(await updates.check())}}>Verificar atualizações</button></div></div>{updateState?.status==='current'&&<StatusBanner tone="success">Você está usando a versão mais recente.</StatusBanner>}{updateState?.status==='error'&&<StatusBanner tone="error">Não foi possível verificar atualizações agora. O sistema continua disponível offline.</StatusBanner>}</section>}
    {screenId==='settings'&&userAdminState&&<UserAdministrationPanel state={userAdminState} onAction={runUserAdmin}/>} 
    {screenId==='settings'&&<section className="panel" data-testid="audit-panel"><div className="panel-heading"><div><span className="eyebrow">Segurança</span><h2>Trilha de auditoria</h2><p>Consulta local das operações registradas para perfis autorizados.</p></div><div className="actions"><button type="button" onClick={async()=>{try{setAuditResults(await backend.audit({auth,filter:{limit:100}}))}catch(error){setNotice({tone:'error',text:error.message})}}}>Carregar auditoria</button></div></div>{auditResults&&<DataTable records={auditResults}/>}</section>}
    {screenId==='overview'?<OverviewDashboard data={data} onNavigate={navigate}/>:<>
      {screenId==='finance'&&<section className="panel" data-testid="finance-lot-selector"><div className="panel-heading"><div><span className="eyebrow">Resultado por lote</span><h2>Escolha o lote analisado</h2><p>Os indicadores econômicos abaixo são recalculados para o lote selecionado.</p></div></div><div className="form-grid"><label><span>Lote</span><select value={financeLotId} onChange={e=>setFinanceLotId(e.target.value)}><option value="">Selecione um lote</option>{(references.lots??[]).map(lot=><option key={lot.id} value={lot.id}>{lot.name??lot.id}</option>)}</select></label></div></section>}
      {screenId==='finance'&&<FinanceMetrics metrics={data?.metrics}/>} 
      {screenId==='finance'&&<FinanceDecisionPanel insights={depthInsights}/>} 
      {screenId==='finance'&&<FinanceAdminWorkspace data={data} allowedActions={meta?.access?.finance?.actions??[]} onRun={async(name,input)=>{try{const result=await runAction('finance',name,input);surfaceResult(result,{screen:'finance',name});await load('finance');setNotice({tone:'success',text:name==='importInvoiceXml'?'XML lido localmente. Revise a sugestão antes de criar o título.':'Financeiro administrativo atualizado.'});return result}catch(error){setNotice({tone:'error',text:error.message});throw error}}}/>} 
      {screenId==='reproduction'&&<ReproductionSummary records={rows} metrics={data?.metrics}/>} 
      {screenId==='reproduction'&&<ReproductionDecisionPanel insights={depthInsights}/>} 
      {screenId==='reproduction'&&reproductionAdminState&&<ProfessionalReproductionPanel state={reproductionAdminState} animals={reproductionFemales} onAction={runReproductionAdmin}/>} 
      {screenId==='sanitary'&&<SanitaryAnalyticsPanel insights={depthInsights}/>} 
      {screenId==='sanitary'&&<SanitaryApplicationsPanel events={data?.events??[]}/>} 
      {screenId==='pastures'&&<PastureManagementWorkspace data={data?.management}/>} 
      {screenId==='pastures'&&<PastureDecisionPanel insights={depthInsights}/>} 
      {screenId==='weights'&&<ProductiveIntelligencePanel insights={depthInsights}/>} 
      {screenId==='trades'&&<CommercialSummaryPanel insights={depthInsights}/>} 
      {screenId==='trades'&&<CommercialSimulator lots={references.lots??[]} result={simulationResult} onSimulate={async input=>{try{setSimulationResult(await backend.simulateSale({auth,...input}))}catch(error){setNotice({tone:'error',text:error.message})}}}/>} 
      {screenId==='reports'&&<AdvancedReportsPanel lots={references.lots??[]} onGenerate={async({format,...input})=>{try{const result=await backend.action({screenId:'reports',action:format,input,auth,context:{}});surfaceResult(result,{screen:'reports',name:format})}catch(error){setNotice({tone:'error',text:error.message})}}}/>} 
      {screenId==='tasks'&&<FieldMobileWorkspace tasks={rows} animals={references.animals??[]} lots={references.lots??[]} protocols={references.protocols??[]} fieldData={references} syncState={fieldSyncState} onSync={runFieldSync}/>} 
      {screenId==='iot'&&<IoTDetailsPanel data={data}/>} 
      {screenId==='weights'&&<CorralFlow animals={references.animals??[]} onRecord={async input=>{await runAction('weights','record',input);await load('weights');backend.references({auth}).then(setReferences)}}/>}
      {screenId==='animals'&&animalDetail&&<AnimalDetail detail={animalDetail} onClose={()=>setAnimalDetail(null)}/>} 
      <div className={screenId==='tasks'?'field-desktop-only':undefined}><WorkspaceScreen screenId={screenId} screen={screen} icon={screenNavigation?.icon} records={rows} secondaryRecords={secondaryRecords} secondaryTitle={secondaryTitle} allowedActions={meta?.access?.[screenId]?.actions??[]} onAction={async name=>{if(screenId==='animals'&&name==='view360')return;setAction(name);setNotice(null)}}/></div>
      {screenId==='animals'&&<section className="panel"><div className="panel-heading"><div><span className="eyebrow">Ficha individual</span><h2>Abrir animal 360º</h2></div></div><div className="form-grid"><label><span>Animal</span><select defaultValue="" onChange={async e=>{if(!e.target.value)return;const detailData=await backend.load({screenId:'animals',auth,context:{animalId:e.target.value}});setAnimalDetail(detailData.detail)}}><option value="">Selecione</option>{(references.animals??[]).map(a=><option key={a.id} value={a.id}>{a.tag??a.name??a.id}</option>)}</select></label></div></section>}
    </>}
    <ActionDialog open={Boolean(action)} definition={activeForm} actionKey={action?`${screenId}.${action}`:null} references={references} busy={busy} onClose={()=>setAction(null)} onSubmit={async input=>{setBusy(true);setNotice(null);try{const actionName=action,result=await backend.action({screenId,action:actionName,input,auth,context:{}});surfaceResult(result,{screen:screenId,name:actionName});setAction(null);setNotice({tone:'success',text:'Operação concluída com sucesso.'});await load();backend.references({auth}).then(setReferences).catch(()=>{})}catch(error){setNotice({tone:'error',text:error.message})}finally{setBusy(false)}}}/>
  </DesktopShell>;
}

createRoot(document.getElementById('root')).render(<App/>);
