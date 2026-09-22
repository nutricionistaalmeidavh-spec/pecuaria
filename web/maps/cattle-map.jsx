import React,{useMemo,useState} from 'react';
import './maps.css';

const LAYER_LABELS=Object.freeze({pastures:'Piquetes',lots:'Lotes',infrastructure:'Infraestrutura',occurrences:'Ocorrências',sensors:'Sensores'});
const POINT_LABELS=Object.freeze({trough:'Cocho',water:'Bebedouro',corral:'Curral',gate:'Porteira',salt:'Saleiro',mineral:'Mineral',scale:'Balança',sensor:'Sensor',occurrence:'Ocorrência',other:'Outro'});
const statusLabel=Object.freeze({available:'Disponível',occupied:'Ocupado',resting:'Descanso',unavailable:'Indisponível'});
const detail=value=>value==null||value===''?'Sem dados':String(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function projector(bounds){
  if(!Array.isArray(bounds)||bounds.length!==4)return()=>({x:500,y:300});
  const [minLon,minLat,maxLon,maxLat]=bounds,width=Math.max(1e-9,maxLon-minLon),height=Math.max(1e-9,maxLat-minLat);
  return(longitude,latitude)=>({x:54+((longitude-minLon)/width)*892,y:556-((latitude-minLat)/height)*512});
}
function ringsOf(geometry){
  const coordinates=geometry?.coordinates??[];
  if(geometry?.type==='Polygon')return coordinates;
  if(geometry?.type==='MultiPolygon')return coordinates.flatMap(polygon=>polygon.slice(0,1));
  return [];
}
function ringPoints(ring,project){return(ring??[]).map(([longitude,latitude])=>{const p=project(longitude,latitude);return`${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ');}
function pointLayer(point){if(point.kind==='occurrence')return'occurrences';if(point.kind==='sensor')return'sensors';return'infrastructure';}
function mapBounds(map){
  if(Array.isArray(map?.bounds))return map.bounds;
  const points=(map?.points??[]).filter(item=>Number.isFinite(Number(item.longitude))&&Number.isFinite(Number(item.latitude)));
  if(!points.length)return null;
  return[Math.min(...points.map(p=>Number(p.longitude))),Math.min(...points.map(p=>Number(p.latitude))),Math.max(...points.map(p=>Number(p.longitude))),Math.max(...points.map(p=>Number(p.latitude)))];
}

export function CattleMap({map,onAddPoint,onEditPasture,onSelectPasture}){
  const pastures=map?.pastures??[],points=map?.points??[],bounds=useMemo(()=>mapBounds(map),[map]);
  const project=useMemo(()=>projector(bounds),[bounds]);
  const [selected,setSelected]=useState(null);
  const [visible,setVisible]=useState({pastures:true,lots:true,infrastructure:true,occurrences:true,sensors:true});
  const selectedPasture=selected?.type==='pasture'?pastures.find(item=>String(item.id)===String(selected.id)):null;
  const selectedPoint=selected?.type==='point'?points.find(item=>String(item.id)===String(selected.id)):null;
  const visiblePoints=points.filter(point=>visible[pointLayer(point)]);
  const hasData=pastures.length>0||visiblePoints.length>0;
  const selectPasture=pasture=>{setSelected({type:'pasture',id:pasture.id});onSelectPasture?.(pasture);};

  return <section className="cattle-map" data-testid="cattle-map">
    <div className="cattle-map-heading"><div><span className="eyebrow">Mapa geográfico local</span><h2>Fazenda, piquetes e infraestrutura</h2><p>Visão espacial WGS84 dos piquetes, lotes atuais e estruturas de campo. Os dados pecuários continuam locais.</p></div><div className="actions"><button type="button" onClick={()=>onAddPoint?.(selectedPasture??null)}>Adicionar infraestrutura</button>{selectedPasture&&<button type="button" onClick={()=>onEditPasture?.(selectedPasture)}>Editar limite</button>}</div></div>
    <div className="cattle-map-layout">
      <aside className="cattle-map-layers" aria-label="Camadas do mapa"><strong>Camadas</strong>{Object.entries(LAYER_LABELS).map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(visible[key])} onChange={event=>setVisible(current=>({...current,[key]:event.target.checked}))}/><span>{label}</span><small>{key==='pastures'?pastures.length:key==='lots'?pastures.filter(p=>p.metadata?.currentLotId).length:points.filter(p=>pointLayer(p)===key).length}</small></label>)}</aside>
      <div className="cattle-map-stage">
        {hasData?<svg viewBox="0 0 1000 610" role="img" aria-label="Mapa de piquetes e infraestrutura pecuária"><defs><pattern id="cattle-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth="1"/></pattern></defs><rect width="1000" height="610" className="map-background"/><rect width="1000" height="610" fill="url(#cattle-grid)"/>{visible.pastures&&pastures.map(pasture=><g key={pasture.id} role="button" tabIndex="0" className={selectedPasture?.id===pasture.id?'pasture-shape selected':'pasture-shape'} onClick={()=>selectPasture(pasture)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')selectPasture(pasture)}}>{ringsOf(pasture.geometry).map((ring,index)=><polygon key={index} points={ringPoints(ring,project)}/>)}{pasture.centroid?(()=>{const p=project(pasture.centroid.longitude,pasture.centroid.latitude);return <text x={p.x} y={p.y} textAnchor="middle">{pasture.name}</text>})():null}</g>)}{visiblePoints.map(point=>{const p=project(point.longitude,point.latitude);return <g key={point.id} role="button" tabIndex="0" className={selectedPoint?.id===point.id?'cattle-marker selected':'cattle-marker'} transform={`translate(${clamp(p.x,20,980)} ${clamp(p.y,20,590)})`} onClick={()=>setSelected({type:'point',id:point.id})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setSelected({type:'point',id:point.id})}}><circle r="13"/><text textAnchor="middle" dominantBaseline="central">{POINT_LABELS[point.kind]?.slice(0,1)??'•'}</text></g>})}</svg>:<div className="map-empty"><strong>Mapeie pelo menos um piquete</strong><span>Cadastre ou importe uma geometria WGS84 para ativar o mapa geográfico.</span></div>}
        <span className="map-mode-badge">Base vetorial local · operação pecuária offline</span>
      </div>
      <aside className="cattle-map-detail">{selectedPasture?<><span className="eyebrow">Piquete selecionado</span><h3>{selectedPasture.name}</h3><dl><div><dt>Área cadastrada</dt><dd>{Number(selectedPasture.areaHa||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha</dd></div><div><dt>Forrageira</dt><dd>{detail(selectedPasture.metadata?.forage)}</dd></div><div><dt>Status</dt><dd>{statusLabel[selectedPasture.metadata?.status]??detail(selectedPasture.metadata?.status)}</dd></div>{visible.lots&&<><div><dt>Lote atual</dt><dd>{detail(selectedPasture.metadata?.currentLotName)}</dd></div><div><dt>UA</dt><dd>{detail(selectedPasture.metadata?.animalUnits)}</dd></div></>}</dl></>:selectedPoint?<><span className="eyebrow">Infraestrutura</span><h3>{selectedPoint.name}</h3><dl><div><dt>Tipo</dt><dd>{POINT_LABELS[selectedPoint.kind]??selectedPoint.kind}</dd></div><div><dt>Piquete</dt><dd>{detail(selectedPoint.pastureId)}</dd></div><div><dt>Coordenada</dt><dd>{Number(selectedPoint.latitude).toFixed(5)}, {Number(selectedPoint.longitude).toFixed(5)}</dd></div></dl></>:<><span className="eyebrow">Ficha rápida</span><h3>Selecione um item</h3><p>Clique ou use o teclado em um piquete ou ponto para consultar os dados operacionais.</p></>}</aside>
    </div>
    <div className="map-accessible-list" data-testid="map-accessible-list" aria-label="Resumo textual do mapa">{pastures.map(pasture=><article key={`a-${pasture.id}`}><strong>{pasture.name}</strong><span>{statusLabel[pasture.metadata?.status]??detail(pasture.metadata?.status)} · {Number(pasture.areaHa||0).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha · Lote: {detail(pasture.metadata?.currentLotName)} · UA: {detail(pasture.metadata?.animalUnits)}</span></article>)}{points.map(point=><article key={`p-${point.id}`}><strong>{point.name}</strong><span>{POINT_LABELS[point.kind]??point.kind} · {point.pastureId??'Sem piquete vinculado'}</span></article>)}</div>
  </section>;
}
