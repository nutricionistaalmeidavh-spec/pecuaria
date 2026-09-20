import React,{useState} from 'react';

const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const date=value=>{if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')};

export function AdvancedReproductionCapture({animals=[],onRecord}){
  const [values,setValues]=useState({animalId:'',occurredAt:'',method:'iatf',bullOrSemen:'',protocol:'',breedingSeason:'',expectedCalvingAt:'',notes:''});
  const set=(name,value)=>setValues(current=>({...current,[name]:value}));
  const canSubmit=values.animalId&&values.occurredAt;
  const submit=async()=>{
    const metadata={
      method:values.method||null,
      bullOrSemen:values.bullOrSemen.trim()||null,
      protocol:values.protocol.trim()||null,
      breedingSeason:values.breedingSeason.trim()||null,
      expectedCalvingAt:values.expectedCalvingAt?new Date(values.expectedCalvingAt).toISOString():null,
      result:null,
      notes:values.notes.trim()||null
    };
    await onRecord({id:`repro-${crypto.randomUUID()}`,animalId:values.animalId,type:'service',occurredAt:new Date(values.occurredAt).toISOString(),relatedAnimalId:null,metadata});
    setValues(current=>({...current,animalId:'',occurredAt:'',bullOrSemen:'',notes:''}));
  };
  return <section className="panel" data-testid="advanced-reproduction-capture"><div className="panel-heading"><div><span className="eyebrow">Estação de monta / IATF</span><h2>Registrar serviço reprodutivo avançado</h2><p>Vincule matriz, método, protocolo, estação e touro/sêmen ao mesmo evento reprodutivo.</p></div></div><div className="form-grid"><label><span>Matriz</span><select value={values.animalId} onChange={e=>set('animalId',e.target.value)}><option value="">Selecione</option>{animals.map(animal=><option key={animal.id} value={animal.id}>{animal.tag??animal.name??animal.id}</option>)}</select></label><label><span>Data/hora</span><input type="datetime-local" value={values.occurredAt} onChange={e=>set('occurredAt',e.target.value)}/></label><label><span>Método</span><select value={values.method} onChange={e=>set('method',e.target.value)}><option value="natural">Monta natural</option><option value="ia">IA</option><option value="iatf">IATF</option><option value="fiv">FIV</option><option value="te">TE</option></select></label><label><span>Protocolo</span><input value={values.protocol} onChange={e=>set('protocol',e.target.value)} placeholder="Ex.: IATF 8 dias"/></label><label><span>Estação de monta</span><input value={values.breedingSeason} onChange={e=>set('breedingSeason',e.target.value)} placeholder="Ex.: 2026/2027"/></label><label><span>Touro / sêmen</span><input value={values.bullOrSemen} onChange={e=>set('bullOrSemen',e.target.value)}/></label><label><span>Previsão de parto</span><input type="datetime-local" value={values.expectedCalvingAt} onChange={e=>set('expectedCalvingAt',e.target.value)}/></label><label><span>Observações</span><textarea rows="3" value={values.notes} onChange={e=>set('notes',e.target.value)}/></label></div><div className="actions"><button type="button" className="primary" disabled={!canSubmit} onClick={submit}>Registrar serviço</button></div></section>;
}

export function SanitaryApplicationsPanel({events=[]}){
  const rows=(events??[]).map(record=>record?.payload??record).slice().sort((a,b)=>String(b.occurredAt??b.performedAt??'').localeCompare(String(a.occurredAt??a.performedAt??''))).slice(0,20);
  if(!rows.length)return null;
  return <section className="panel" data-testid="sanitary-applications-detail"><div className="panel-heading"><div><span className="eyebrow">Aplicações registradas</span><h2>Detalhamento sanitário</h2><p>Produto, partida, princípio ativo, dose, próxima aplicação, carência e custo permanecem visíveis.</p></div></div><div className="activity-list">{rows.map(row=><article className="activity-row" key={row.id}><span className="activity-copy"><strong>{row.animalId} · {row.protocolId??'Sem protocolo'}</strong><small>Produto: {row.productItemId??'—'} · Partida: {row.productBatch??'—'} · Princípio ativo: {row.activeIngredient??'—'}</small><small>Dose: {row.dose??'—'} {row.unit??''} · Aplicação: {date(row.occurredAt??row.performedAt)} · Próxima: {date(row.nextDueAt)} · Carência até: {date(row.withdrawalUntil)}</small></span><strong>{money(row.costMinor)}</strong></article>)}</div></section>;
}
