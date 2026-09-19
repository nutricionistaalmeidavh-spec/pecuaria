import React from 'react';
import {Icon} from './icons.jsx';

const number=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
const money=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);

const kpiDefinitions=[
  {key:'activeAnimals',label:'Animais ativos',icon:'beef',suffix:''},
  {key:'averageWeightKg',label:'Peso médio',icon:'scale',suffix:' kg'},
  {key:'lots',label:'Lotes ativos',icon:'layers-3',suffix:''},
  {key:'alerts',label:'Alertas',icon:'alert',suffix:''}
];

function KpiCard({definition,value}){
  return <article className="kpi-card" data-testid={`kpi-${definition.key}`}>
    <span className={`kpi-icon ${definition.key==='alerts'&&value>0?'attention':''}`}><Icon name={definition.icon} size={20}/></span>
    <div><span>{definition.label}</span><strong>{number(value)}{value!=null?definition.suffix:''}</strong></div>
  </article>;
}

function SecondaryCard({icon,title,value,description,onClick}){
  return <button className="secondary-card" type="button" onClick={onClick}>
    <span className="secondary-icon"><Icon name={icon} size={20}/></span>
    <span className="secondary-copy"><strong>{title}</strong><small>{description}</small></span>
    {value!=null&&<span className="secondary-value">{value}</span>}
  </button>;
}

export function OverviewDashboard({data,onNavigate}){
  const primary=data?.primaryKpis??{
    activeAnimals:data?.cards?.activeAnimals??0,
    averageWeightKg:data?.cards?.averageWeightKg??null,
    lots:data?.cards?.lots??0,
    alerts:data?.alerts?.length??0
  };
  const cards=data?.cards??{};
  const result=(cards.incomeMinor??0)-(cards.costMinor??0);
  return <div className="dashboard-overview" data-testid="dashboard-overview">
    <section className="primary-kpis" data-testid="primary-kpis">
      {kpiDefinitions.map(definition=><KpiCard key={definition.key} definition={definition} value={primary[definition.key]}/>) }
    </section>

    <section className="dashboard-main-grid">
      <article className="dashboard-hero" data-testid="dashboard-hero">
        <img className="dashboard-photo" src="./pecuaria-hero.webp" alt="Rebanho em fazenda com gestão digital"/>
        <div className="hero-shade"/>
        <div className="hero-content">
          <span className="eyebrow hero-eyebrow">Gestão pecuária</span>
          <h2>Gestão do seu rebanho</h2>
          <p>Acompanhe animais, lotes, pesagens e manejo em um só lugar.</p>
          <button className="hero-action" type="button" onClick={()=>onNavigate('animals')}>Ver animais</button>
        </div>
      </article>

      <aside className="dashboard-alert-card">
        <div className="section-title"><span><Icon name="shield-plus" size={20}/></span><div><strong>Sanidade</strong><small>Prioridades do rebanho</small></div></div>
        <div className="alert-number">{number(primary.alerts)}</div>
        <p>{primary.alerts===1?'alerta requer atenção':'alertas requerem atenção'}</p>
        <button type="button" className="text-action" onClick={()=>onNavigate('sanitary')}>Abrir sanidade</button>
      </aside>
    </section>

    <section className="dashboard-secondary" data-testid="dashboard-secondary">
      <SecondaryCard icon="scale" title="Pesagem" value={cards.averageWeightKg==null?null:`${number(cards.averageWeightKg)} kg`} description="Histórico e desempenho" onClick={()=>onNavigate('weights')}/>
      <SecondaryCard icon="heart" title="Reprodução" description="Ciclos e eventos reprodutivos" onClick={()=>onNavigate('reproduction')}/>
      <SecondaryCard icon="sprout" title="Lotes" value={number(cards.lots??0)} description="Organização do rebanho" onClick={()=>onNavigate('lots')}/>
      <SecondaryCard icon="wallet-cards" title="Resultado" value={money(result)} description="Receitas menos custos" onClick={()=>onNavigate('finance')}/>
    </section>
  </div>;
}
