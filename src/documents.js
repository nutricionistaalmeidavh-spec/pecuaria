import {createProductDocumentService} from '../shared/packages/product-documents/src/index.js';

export const DOCUMENT_DEFINITIONS=Object.freeze({
  'animal-history':Object.freeze({title:'Histórico do animal',columns:Object.freeze(['animalId','tag','eventType','occurredAt','details'])}),
  'lot-kpis':Object.freeze({title:'Indicadores do lote',columns:Object.freeze(['lotId','lotName','activeAnimals','averageWeightKg','averageDailyGainKg','costMinor','incomeMinor'])}),
  'sanitary':Object.freeze({title:'Manejo sanitário',columns:Object.freeze(['id','animalId','protocolId','performedAt','nextDueAt','withdrawalUntil','productItemId','productBatch','costMinor'])}),
  'inventory':Object.freeze({title:'Estoque e insumos',columns:Object.freeze(['id','name','kind','quantity','minQuantity','unit','batch','expiresAt','costMinor'])}),
  'traceability':Object.freeze({title:'Rastreabilidade',columns:Object.freeze(['id','animalId','officialId','type','documentNumber','issuer','issuedAt','expiresAt'])}),
  'pasture':Object.freeze({title:'Pastagens e áreas',columns:Object.freeze(['id','name','areaHa','capacityAu','status','forage','activeOccupancies'])}),
  'tasks':Object.freeze({title:'Agenda de manejo',columns:Object.freeze(['id','title','kind','dueAt','status','animalId','lotId'])}),
  'reproduction':Object.freeze({title:'Reprodução',columns:Object.freeze(['id','animalId','type','occurredAt','method','bullOrSemen','result','expectedCalvingAt','protocol'])}),
  'commercial':Object.freeze({title:'Comercial e vendas',columns:Object.freeze(['id','type','partyId','occurredAt','animals','liveWeightKg','carcassWeightKg','carcassYieldPct','carcassArrobas','grossMinor','netMinor'])}),
  'nutrition':Object.freeze({title:'Nutrição',columns:Object.freeze(['id','name','lotId','feedItemId','headCount','dailyKgPerHead','dailyKg','dailyCostMinor','startsAt','endsAt'])}),
  'finance':Object.freeze({title:'Financeiro pecuário',columns:Object.freeze(['id','direction','lotId','amountMinor','description','category','tradeId'])}),
  'performance':Object.freeze({title:'Desempenho produtivo',columns:Object.freeze(['animalId','tag','lotId','latestWeightKg','latestWeightAt','dailyGainKg','projectedWeight30d'])})
});

export const createDocumentService=(persistence=null)=>createProductDocumentService({productId:'agro-pecuaria',definitions:DOCUMENT_DEFINITIONS,persistence});
