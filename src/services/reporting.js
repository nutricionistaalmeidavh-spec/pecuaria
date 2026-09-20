import {createCattleReportingService as createBaseReportingService} from './reporting-base.js';
import {createDeepFinanceInsights} from './finance-depth.js';
import {createDeepPastureInsights} from './pasture-history.js';

export function createCattleReportingService(persistence){
  const base=createBaseReportingService(persistence);
  const financeInsights=createDeepFinanceInsights(persistence);
  const pastureInsights=createDeepPastureInsights(persistence);
  const insights=async(scope,options={})=>{
    if(scope==='finance')return financeInsights(options);
    if(scope==='pastures')return pastureInsights(options);
    return base.insights(scope,options);
  };
  return Object.freeze({...base,insights,financeInsights,pastureInsights});
}
