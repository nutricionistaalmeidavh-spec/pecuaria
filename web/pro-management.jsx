import React,{useMemo,useState} from 'react';
import {DataTable} from './components.jsx';

const unwrap=records=>(records??[]).map(record=>record?.payload??record);
const uid=prefix=>`${prefix}-${crypto.randomUUID()}`;
const num=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(Number(value));

export function ProfessionalReproductionPanel({state,animals=[],onAction}){
  const genetics=unwrap(state?.genetics),doseStocks=unwrap(state?.doseStocks),seasons=unwrap(state?.seasons),efficiency=state?.efficiency??{};
  const semen=genetics.filter(row=>row.type==='semen'&&row.active!==false);
  const females=animals.filter(row=>row.status==='active'&&row.sex==='female');
  const [genetic,setGenetic]=useState({type:'bull',name:'',registry:'',breed:'',supplier:''});
  const [dose,setDose]=useState({geneticsId:'',batch:'',quantityDoses:'',minDoses:'',expiresAt:'',costPerDoseMinor:''});
  const [season,setSeason]=useState({name:'',startAt:'',endAt:'',status:'planned',targetConceptionPct:''});
  const [service,setService]=useState({animalId:'',occurredAt:'',method:'iatf',protocol:'',geneticsId:'',doseStockId:'',breedingSeasonId:'',expectedCalvingAt:''});
  if(!state)return null;
  const run=async(operation,input)=>onAction?.(operation,input);
  const efficiencyRows=useMemo(()=>[
    ...(efficiency.byProtocol??[]).map(row=>({...row,dimension:'Protocolo'})),
    ...(efficiency.byGenetics??[]).map(row=>({...row,dimension:'Reprodutor'})),
    ...(efficiency.bySeason??[]).map(row=>({...row,dimension:'Estação'}))
  ],[efficiency]);
  return <section className="panel" data-testid="professional-reproduction">
    <div className="panel-heading"><div><span className="eyebrow">Reprodução profissional</span><h2>Genética, doses e estação de monta</h2><p>Cadastre touros/sêmen, controle Estoque de doses e acompanhe Eficiência por protocolo, Eficiência por reprodutor e Eficiência por estação.</p></div></div>

    <section data-testid="genetics-register"><h3>Cadastro de touros/sêmen</h3><div className="form-grid">
      <label><span>Tipo</span><select value={genetic.type} onChange={e=>setGenetic({...genetic,type:e.target.value})}><option value="bull">Touro</option><option value="semen">Sêmen</option></select></label>
      <label><span>Nome</span><input value={genetic.name} onChange={e=>setGenetic({...genetic,name:e.target.value})}/></label>
      <label><span>Registro</span><input value={genetic.registry} onChange={e=>setGenetic({...genetic,registry:e.target.value})}/></label>
      <label><span>Raça</span><input value={genetic.breed} onChange={e=>setGenetic({...genetic,breed:e.target.value})}/></label>
      <label><span>Fornecedor</span><input value={genetic.supplier} onChange={e=>setGenetic({...genetic,supplier:e.target.value})}/></label>
    </div><div className="actions"><button className="primary" disabled={!genetic.name.trim()} onClick={async()=>{await run('saveGenetics',{id:uid('gen'),...genetic,active:true});setGenetic({...genetic,name:'',registry:''})}}>Salvar genética</button></div><DataTable records={genetics}/></section>

    <section data-testid="semen-dose-stock"><h3>Estoque de doses</h3><div className="form-grid">
      <label><span>Sêmen</span><select value={dose.geneticsId} onChange={e=>setDose({...dose,geneticsId:e.target.value})}><option value="">Selecione</option>{semen.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label><span>Lote/partida</span><input value={dose.batch} onChange={e=>setDose({...dose,batch:e.target.value})}/></label>
      <label><span>Doses</span><input type="number" min="0" value={dose.quantityDoses} onChange={e=>setDose({...dose,quantityDoses:e.target.value})}/></label>
      <label><span>Estoque mínimo</span><input type="number" min="0" value={dose.minDoses} onChange={e=>setDose({...dose,minDoses:e.target.value})}/></label>
      <label><span>Validade</span><input type="date" value={dose.expiresAt} onChange={e=>setDose({...dose,expiresAt:e.target.value})}/></label>
      <label><span>Custo/dose (centavos)</span><input type="number" min="0" value={dose.costPerDoseMinor} onChange={e=>setDose({...dose,costPerDoseMinor:e.target.value})}/></label>
    </div><div className="actions"><button className="primary" disabled={!dose.geneticsId||!dose.batch||dose.quantityDoses===''} onClick={async()=>{await run('saveDoseStock',{id:uid('dose'),...dose,quantityDoses:Number(dose.quantityDoses),minDoses:Number(dose.minDoses||0),costPerDoseMinor:Number(dose.costPerDoseMinor||0),expiresAt:dose.expiresAt?new Date(`${dose.expiresAt}T00:00:00`).toISOString():null,active:true});setDose({...dose,batch:'',quantityDoses:''})}}>Adicionar lote de doses</button></div><DataTable records={doseStocks}/>{(state.stockAlerts??[]).length>0&&<p><strong>Atenção:</strong> {state.stockAlerts.length} lote(s) no mínimo ou próximo(s) da validade.</p>}</section>

    <section data-testid="breeding-season"><h3>Estação de monta</h3><div className="form-grid">
      <label><span>Nome</span><input value={season.name} onChange={e=>setSeason({...season,name:e.target.value})}/></label>
      <label><span>Início</span><input type="date" value={season.startAt} onChange={e=>setSeason({...season,startAt:e.target.value})}/></label>
      <label><span>Fim</span><input type="date" value={season.endAt} onChange={e=>setSeason({...season,endAt:e.target.value})}/></label>
      <label><span>Status</span><select value={season.status} onChange={e=>setSeason({...season,status:e.target.value})}><option value="planned">Planejada</option><option value="active">Ativa</option><option value="closed">Encerrada</option></select></label>
      <label><span>Meta concepção (%)</span><input type="number" min="0" max="100" value={season.targetConceptionPct} onChange={e=>setSeason({...season,targetConceptionPct:e.target.value})}/></label>
    </div><div className="actions"><button className="primary" disabled={!season.name||!season.startAt||!season.endAt} onClick={async()=>{await run('saveBreedingSeason',{id:uid('season'),...season,startAt:new Date(`${season.startAt}T00:00:00`).toISOString(),endAt:new Date(`${season.endAt}T23:59:59`).toISOString(),targetConceptionPct:season.targetConceptionPct===''?null:Number(season.targetConceptionPct)});setSeason({...season,name:''})}}>Salvar estação</button></div><DataTable records={seasons}/></section>

    <section><h3>Registrar serviço com rastreabilidade</h3><div className="form-grid">
      <label><span>Matriz</span><select value={service.animalId} onChange={e=>setService({...service,animalId:e.target.value})}><option value="">Selecione</option>{females.map(row=><option key={row.id} value={row.id}>{row.tag??row.name??row.id}</option>)}</select></label>
      <label><span>Data/hora</span><input type="datetime-local" value={service.occurredAt} onChange={e=>setService({...service,occurredAt:e.target.value})}/></label>
      <label><span>Método</span><select value={service.method} onChange={e=>setService({...service,method:e.target.value})}><option value="natural">Monta natural</option><option value="ia">IA</option><option value="iatf">IATF</option><option value="fiv">FIV</option><option value="te">TE</option></select></label>
      <label><span>Protocolo</span><input value={service.protocol} onChange={e=>setService({...service,protocol:e.target.value})}/></label>
      <label><span>Touro / sêmen</span><select value={service.geneticsId} onChange={e=>setService({...service,geneticsId:e.target.value,doseStockId:''})}><option value="">Selecione</option>{genetics.filter(row=>row.active!==false).map(row=><option key={row.id} value={row.id}>{row.name} · {row.type==='bull'?'Touro':'Sêmen'}</option>)}</select></label>
      <label><span>Lote de doses</span><select value={service.doseStockId} onChange={e=>setService({...service,doseStockId:e.target.value})}><option value="">Não se aplica</option>{doseStocks.filter(row=>row.active!==false&&row.geneticsId===service.geneticsId&&row.quantityDoses>0).map(row=><option key={row.id} value={row.id}>{row.batch} · {row.quantityDoses} dose(s)</option>)}</select></label>
      <label><span>Estação</span><select value={service.breedingSeasonId} onChange={e=>setService({...service,breedingSeasonId:e.target.value})}><option value="">Selecione</option>{seasons.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label><span>Previsão de parto</span><input type="datetime-local" value={service.expectedCalvingAt} onChange={e=>setService({...service,expectedCalvingAt:e.target.value})}/></label>
    </div><div className="actions"><button className="primary" disabled={!service.animalId||!service.occurredAt||!service.geneticsId||!service.breedingSeasonId} onClick={async()=>{await run('recordService',{id:uid('repro'),...service,occurredAt:new Date(service.occurredAt).toISOString(),expectedCalvingAt:service.expectedCalvingAt?new Date(service.expectedCalvingAt).toISOString():null,dosesUsed:1});setService({...service,animalId:'',occurredAt:''})}}>Registrar serviço profissional</button></div></section>

    <section data-testid="reproduction-efficiency"><h3>Eficiência reprodutiva</h3><div className="stat-grid"><article><span>Serviços</span><strong>{efficiency.summary?.services??0}</strong></article><article><span>Prenhezes vinculadas</span><strong>{efficiency.summary?.pregnant??0}</strong></article><article><span>Concepção</span><strong>{num(efficiency.summary?.conceptionRatePct)}%</strong></article></div><p>Eficiência por protocolo · Eficiência por reprodutor · Eficiência por estação</p><DataTable records={efficiencyRows}/></section>
  </section>;
}

export function UserAdministrationPanel({state,onAction}){
  const users=state?.users??[],profiles=state?.profiles??[];
  const [create,setCreate]=useState({username:'',password:'',role:'field-operator'});
  const [selectedId,setSelectedId]=useState('');
  const [edit,setEdit]=useState({roles:[],active:true,password:''});
  if(!state)return null;
  const selected=users.find(user=>user.id===selectedId)??null;
  const selectUser=id=>{const user=users.find(row=>row.id===id);setSelectedId(id);setEdit({roles:user?.roles??[],active:user?.active!==false,password:''})};
  const matrix=profiles.map(profile=>({perfil:profile.id,permissoes:(profile.permissions??[]).join(', ')}));
  return <section className="panel" data-testid="user-administration">
    <div className="panel-heading"><div><span className="eyebrow">Administração local</span><h2>Usuários, perfis e auditoria</h2><p>Criação/edição de usuários com Perfis e permissões aplicados localmente.</p></div></div>
    <h3>Criar usuário</h3><div className="form-grid"><label><span>Usuário</span><input value={create.username} onChange={e=>setCreate({...create,username:e.target.value})}/></label><label><span>Senha inicial</span><input type="password" minLength="8" value={create.password} onChange={e=>setCreate({...create,password:e.target.value})}/></label><label><span>Perfil</span><select value={create.role} onChange={e=>setCreate({...create,role:e.target.value})}>{profiles.map(row=><option key={row.id} value={row.id}>{row.id}</option>)}</select></label></div><div className="actions"><button className="primary" disabled={!create.username||create.password.length<8} onClick={async()=>{await onAction?.('create',{username:create.username,password:create.password,roles:[create.role],active:true});setCreate({...create,username:'',password:''})}}>Criar usuário</button></div>
    <DataTable records={users}/>
    <h3>Editar usuário</h3><div className="form-grid"><label><span>Usuário</span><select value={selectedId} onChange={e=>selectUser(e.target.value)}><option value="">Selecione</option>{users.map(user=><option key={user.id} value={user.id}>{user.username}</option>)}</select></label>{selected&&<><label><span>Perfil</span><select value={edit.roles[0]??''} onChange={e=>setEdit({...edit,roles:[e.target.value]})}>{profiles.map(row=><option key={row.id} value={row.id}>{row.id}</option>)}</select></label><label><span>Status</span><select value={edit.active?'active':'inactive'} onChange={e=>setEdit({...edit,active:e.target.value==='active'})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label><label><span>Nova senha</span><input type="password" minLength="8" value={edit.password} onChange={e=>setEdit({...edit,password:e.target.value})} placeholder="Opcional"/></label></>}</div>{selected&&<div className="actions"><button onClick={()=>onAction?.('update',{id:selected.id,changes:{roles:edit.roles,active:edit.active}})}>Salvar usuário</button><button disabled={edit.password.length>0&&edit.password.length<8||!edit.password} onClick={async()=>{await onAction?.('resetPassword',{id:selected.id,password:edit.password});setEdit({...edit,password:''})}}>Redefinir senha</button></div>}
    <section data-testid="permission-matrix"><h3>Matriz de permissões</h3><p>Perfis e permissões</p><DataTable records={matrix}/></section>
    <h3>Auditoria integrada</h3><DataTable records={state.audit??[]}/>
  </section>;
}
