import React from 'react';
import {Icon} from './icons.jsx';

const number=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
const money=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
const date=value=>{if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(parsed)};

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

function CardHeading({icon,title,description,action,onAction}){
  return <header className="dashboard-card-heading">
    <div className="section-title"><span><Icon name={icon} size={20}/></span><div><strong>{title}</strong><small>{description}</small></div></div>
    {action&&<button type="button" className="text-action" onClick={onAction}>{action}</button>}
  </header>;
}

function WeightChart({series=[]}){
  const values=series.map(item=>Number(item.weightKg)).filter(Number.isFinite);
  const min=values.length?Math.min(...values):0;
  const max=values.length?Math.max(...values):1;
  const span=Math.max(1,max-min);
  const width=420,height=150,padX=18,padY=18;
  const points=series.map((item,index)=>{
    const x=series.length<=1?width/2:padX+(index/(series.length-1))*(width-padX*2);
    const y=height-padY-((Number(item.weightKg)-min)/span)*(height-padY*2);
    return{x,y,item};
  });
  const polyline=points.map(point=>`${point.x},${point.y}`).join(' ');
  return <div className="performance-chart" data-testid="performance-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução das pesagens recentes">
      <line x1="18" y1="132" x2="402" y2="132" className="chart-grid-line"/>
      <line x1="18" y1="75" x2="402" y2="75" className="chart-grid-line"/>
      <line x1="18" y1="18" x2="402" y2="18" className="chart-grid-line"/>
      {points.length>1&&<polyline points={polyline} className="weight-line"/>}
      {points.map((point,index)=><circle key={`${point.item.animalId}-${point.item.measuredAt}-${index}`} cx={point.x} cy={point.y} r="4" className="weight-point"><title>{`${point.item.tag||point.item.animalId}: ${number(point.item.weightKg)} kg em ${date(point.item.measuredAt)}`}</title></circle>)}
    </svg>
  </div>;
}

function EmptyHint({children}){return <div className="dashboard-empty">{children}</div>}

function PerformanceCard({performance,onNavigate}){
  const latest=performance?.latestWeights??[];
  return <article className="dashboard-detail-card performance-card" data-testid="performance-card">
    <CardHeading icon="scale" title="Pesagem e desempenho" description="Evolução recente do rebanho" action="Ver histórico" onAction={()=>onNavigate('weights')}/>
    <div className="performance-body">
      <div className="performance-metric"><span>GMD médio</span><strong>{performance?.averageDailyGainKg==null?'—':`${number(performance.averageDailyGainKg)} kg/dia`}</strong><small>ganho médio diário dos animais com histórico válido</small></div>
      <WeightChart series={performance?.series??[]}/>
    </div>
    <div className="recent-weights">
      {latest.length?latest.slice(0,4).map(item=><div key={`${item.animalId}-${item.measuredAt}`} className="weight-row"><span><strong>{item.tag||item.animalId}</strong><small>{date(item.measuredAt)}</small></span><b>{number(item.weightKg)} kg</b></div>):<EmptyHint>Nenhuma pesagem registrada ainda.</EmptyHint>}
    </div>
  </article>;
}

function ReproductionCard({summary,onNavigate}){
  return <article className="dashboard-detail-card reproduction-card" data-testid="reproduction-card">
    <CardHeading icon="heart" title="Reprodução" description="Eventos reprodutivos registrados" action="Abrir" onAction={()=>onNavigate('reproduction')}/>
    <div className="reproduction-total"><strong>{number(summary?.total??0)}</strong><span>eventos</span></div>
    <div className="mini-metrics">
      <div><span>Cobertura/IA</span><strong>{number(summary?.services??0)}</strong></div>
      <div><span>Diagnósticos</span><strong>{number(summary?.pregnancyChecks??0)}</strong></div>
      <div><span>Partos</span><strong>{number(summary?.calvings??0)}</strong></div>
      <div><span>Desmames</span><strong>{number(summary?.weanings??0)}</strong></div>
    </div>
  </article>;
}

function LotDistributionCard({lots,onNavigate}){
  const rows=lots??[];
  const max=Math.max(1,...rows.map(item=>item.activeAnimals??0));
  return <article className="dashboard-detail-card lot-distribution-card" data-testid="lot-distribution-card">
    <CardHeading icon="layers-3" title="Distribuição por lotes" description="Animais ativos por grupo" action="Ver lotes" onAction={()=>onNavigate('lots')}/>
    <div className="lot-bars">
      {rows.length?rows.slice(0,5).map(item=><div className="lot-bar-row" key={item.id}><div><span>{item.name}</span><b>{number(item.activeAnimals)}</b></div><div className="lot-bar-track"><span style={{width:`${Math.max(4,((item.activeAnimals??0)/max)*100)}%`}}/></div></div>):<EmptyHint>Nenhum lote cadastrado.</EmptyHint>}
    </div>
  </article>;
}

function FinanceCard({summary,onNavigate}){
  return <article className="dashboard-detail-card finance-card" data-testid="finance-card">
    <CardHeading icon="wallet-cards" title="Financeiro" description="Resultado consolidado" action="Abrir" onAction={()=>onNavigate('finance')}/>
    <div className="finance-result"><span>Resultado</span><strong className={(summary?.resultMinor??0)<0?'negative':''}>{money(summary?.resultMinor??0)}</strong></div>
    <div className="finance-lines"><div><span>Receitas</span><strong>{money(summary?.incomeMinor??0)}</strong></div><div><span>Custos</span><strong>{money(summary?.costMinor??0)}</strong></div></div>
  </article>;
}

function ActivityFeed({items,onNavigate}){
  const rows=items??[];
  return <article className="dashboard-detail-card activity-card" data-testid="activity-feed">
    <CardHeading icon="chart-no-axes-combined" title="Atividades recentes" description="Últimos registros operacionais"/>
    <div className="activity-list">
      {rows.length?rows.map((item,index)=><button type="button" className="activity-row" key={`${item.kind}-${item.occurredAt}-${index}`} onClick={()=>item.target&&onNavigate(item.target)}><span className="activity-icon"><Icon name={item.icon} size={17}/></span><span className="activity-copy"><strong>{item.title}</strong><small>{item.detail||'Registro operacional'}</small></span><time>{date(item.occurredAt)}</time></button>):<EmptyHint>As atividades aparecerão após os primeiros registros.</EmptyHint>}
    </div>
  </article>;
}

export function OverviewDashboard({data,onNavigate}){
  const primary=data?.primaryKpis??{
    activeAnimals:data?.cards?.activeAnimals??0,
    averageWeightKg:data?.cards?.averageWeightKg??null,
    lots:data?.cards?.lots??0,
    alerts:data?.alerts?.length??0
  };
  const sanitary=data?.sanitary??{totalEvents:data?.cards?.sanitaryEvents??0,alerts:primary.alerts};
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

      <aside className="dashboard-alert-card" data-testid="sanitary-card">
        <div className="section-title"><span><Icon name="shield-plus" size={20}/></span><div><strong>Sanidade</strong><small>Prioridades do rebanho</small></div></div>
        <div className="alert-number">{number(sanitary.alerts??0)}</div>
        <p>{sanitary.alerts===1?'alerta requer atenção':'alertas requerem atenção'}</p>
        <div className="sanitary-foot"><span>{number(sanitary.totalEvents??0)} manejos registrados</span><button type="button" className="text-action" onClick={()=>onNavigate('sanitary')}>Abrir sanidade</button></div>
      </aside>
    </section>

    <section className="dashboard-insights-grid" data-testid="dashboard-secondary">
      <PerformanceCard performance={data?.performance} onNavigate={onNavigate}/>
      <ReproductionCard summary={data?.reproduction} onNavigate={onNavigate}/>
    </section>

    <section className="dashboard-bottom-grid">
      <LotDistributionCard lots={data?.lotDistribution} onNavigate={onNavigate}/>
      <FinanceCard summary={data?.finance} onNavigate={onNavigate}/>
      <ActivityFeed items={data?.recentActivity} onNavigate={onNavigate}/>
    </section>
  </div>;
}
