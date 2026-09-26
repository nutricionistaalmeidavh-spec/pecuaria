import {isFeatureEnabled,mergeFeatureFlags} from '../shared/packages/feature-flags/src/index.js';

const unique=values=>Object.freeze([...new Set(values)]);

const ESSENTIAL=unique([
  'dashboard.basic','lots.basic','animals.basic','weights.basic','sanitary.basic',
  'data.basic','data.export','settings.backup'
]);
const MANAGEMENT=unique([
  ...ESSENTIAL,
  'animals.batch','sanitary.batch','reproduction.basic','trades.basic','finance.production',
  'reports.basic','traceability.basic','inventory.basic','pastures.basic','nutrition.basic',
  'tasks.basic','data.import','sales.simulation'
]);
const PRO=unique([
  ...MANAGEMENT,
  'animals.body-condition','finance.admin','reproduction.pro','pastures.advanced',
  'field.offline','iot','user.admin','audit'
]);

export const EDITIONS=Object.freeze({
  essential:Object.freeze({id:'essential',label:'Essencial',priceReferenceBrl:39,features:ESSENTIAL}),
  management:Object.freeze({id:'management',label:'Gestão',priceReferenceBrl:120,features:MANAGEMENT}),
  pro:Object.freeze({id:'pro',label:'Pro',priceReferenceBrl:330,features:PRO})
});

const SCREEN_FEATURE=Object.freeze({
  overview:'dashboard.basic',lots:'lots.basic',animals:'animals.basic',weights:'weights.basic',sanitary:'sanitary.basic',
  reproduction:'reproduction.basic',trades:'trades.basic',finance:'finance.production',reports:'reports.basic',
  traceability:'traceability.basic',inventory:'inventory.basic',pastures:'pastures.basic',nutrition:'nutrition.basic',
  tasks:'tasks.basic',data:'data.basic',iot:'iot',settings:'settings.backup'
});

const ACTION_FEATURE=Object.freeze({
  'animals.batchMove':'animals.batch',
  'animals.batchLifecycle':'animals.batch',
  'animals.recordBodyCondition':'animals.body-condition',
  'sanitary.batchRecord':'sanitary.batch',
  'finance.saveAccount':'finance.admin',
  'finance.saveCategory':'finance.admin',
  'finance.saveTitle':'finance.admin',
  'finance.cancelTitle':'finance.admin',
  'finance.settleTitle':'finance.admin',
  'finance.reverseSettlement':'finance.admin',
  'finance.importStatement':'finance.admin',
  'finance.reconcileStatement':'finance.admin',
  'finance.importInvoiceXml':'finance.admin',
  'pastures.recordAssessment':'pastures.advanced',
  'pastures.saveRotationPlan':'pastures.advanced',
  'data.exportCollection':'data.export',
  'data.validateImport':'data.import',
  'data.importCollection':'data.import'
});

const RPC_FEATURE=Object.freeze({
  audit:'audit',
  simulateSale:'sales.simulation',
  reproductionAdmin:'reproduction.pro',
  userAdmin:'user.admin',
  fieldSync:'field.offline',
  maps:'pastures.advanced'
});

function sameFeatures(left,right){
  if(left.length!==right.length)return false;
  const expected=new Set(right);
  return left.every(feature=>expected.has(feature));
}

export function editionFeatures(edition='pro'){
  const found=EDITIONS[edition];
  if(!found){
    const error=new Error(`Unknown product edition: ${edition}`);
    error.code='UNKNOWN_EDITION';
    throw error;
  }
  return found.features;
}

export function inferEdition(features=[]){
  const normalized=unique(features);
  for(const edition of ['essential','management','pro']){
    if(sameFeatures(normalized,EDITIONS[edition].features))return edition;
  }
  return 'custom';
}

export function featureForScreen(screenId){
  return SCREEN_FEATURE[screenId]??null;
}

export function featureForAction(screenId,action){
  return ACTION_FEATURE[`${screenId}.${action}`]??featureForScreen(screenId);
}

export function featureForRpc(name){
  return RPC_FEATURE[name]??null;
}

export function createEditionAccess({edition='pro',features=null,licensed=false,licensePayload=null,defaults={},tenantFlags={},userFlags={}}={}){
  const selected=features==null?editionFeatures(edition):unique(features);
  const resolvedEdition=features==null?edition:inferEdition(selected);
  const featureDefaults=Object.fromEntries(selected.map(feature=>[feature,true]));
  const context={defaults:mergeFeatureFlags(featureDefaults,defaults),tenantFlags,userFlags};
  const has=feature=>isFeatureEnabled(feature,context);
  const screenEnabled=screenId=>{
    const feature=featureForScreen(screenId);
    return Boolean(feature)&&has(feature);
  };
  const actionEnabled=(screenId,action)=>screenEnabled(screenId)&&has(featureForAction(screenId,action));
  const rpcEnabled=name=>{
    const feature=featureForRpc(name);
    return feature?has(feature):true;
  };
  const sanitizeScreenPayload=(screenId,payload)=>{
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return payload;
    const next={...payload};
    if(screenId==='finance'&&!has('finance.admin'))delete next.admin;
    if(screenId==='pastures'&&!has('pastures.advanced'))delete next.management;
    if(screenId==='overview'){
      if(!has('reproduction.basic')){delete next.reproduction;delete next.reproductionMetrics;}
      if(!has('finance.production'))delete next.finance;
    }
    if(screenId==='animals'&&!has('animals.body-condition')&&next.detail){
      next.detail={...next.detail};
      delete next.detail.bodyCondition;
      if(Array.isArray(next.detail.timeline))next.detail.timeline=next.detail.timeline.filter(item=>item?.kind!=='body-condition');
    }
    return next;
  };
  const filterReferences=references=>{
    if(!references||typeof references!=='object')return references;
    const next={...references};
    if(!has('reproduction.basic'))delete next.events;
    if(!has('traceability.basic'))delete next.traceability;
    if(!has('inventory.basic'))delete next.inventory;
    if(!has('pastures.basic')){delete next.pastures;delete next.pastureOccupancy;}
    if(!has('pastures.advanced')){delete next.bodyCondition;delete next.pastureAssessments;delete next.rotationPlans;}
    if(!has('reproduction.pro')){delete next.breedingSeasons;delete next.reproductionGenetics;delete next.reproductionDoseStock;}
    return next;
  };
  return Object.freeze({
    edition:resolvedEdition,
    licensed:Boolean(licensed),
    licensePayload:licensePayload??null,
    features:Object.freeze([...selected]),
    has,screenEnabled,actionEnabled,rpcEnabled,sanitizeScreenPayload,filterReferences
  });
}

export function filterNavigationForEdition(navigation,access){
  return Object.freeze((navigation??[]).filter(item=>access.screenEnabled(item.id)));
}

export function filterScreensForEdition(screens,access){
  const filtered={};
  for(const [screenId,screen] of Object.entries(screens??{})){
    if(!access.screenEnabled(screenId))continue;
    const actions=Object.fromEntries(Object.entries(screen.actions??{}).filter(([action])=>access.actionEnabled(screenId,action)));
    filtered[screenId]={
      ...screen,
      actions,
      load:screen.load?async context=>access.sanitizeScreenPayload(screenId,await screen.load(context)):screen.load
    };
  }
  return Object.freeze(filtered);
}
