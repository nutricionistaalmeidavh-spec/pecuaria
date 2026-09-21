import {createCattleReportingService as createBaseReportingService} from './reporting-base.js';
import {createDeepFinanceInsights} from './finance-depth.js';
import {createDeepPastureInsights} from './pasture-history.js';

const payloads=records=>(records??[]).map(record=>record?.payload??record);
const hoursBetween=(planned,actual)=>{const a=Date.parse(planned),b=Date.parse(actual);return Number.isFinite(a)&&Number.isFinite(b)?Number(((b-a)/3600000).toFixed(1)):null};
const latestByDate=(records,field)=>records.filter(item=>Number.isFinite(Date.parse(item?.[field]))).slice().sort((a,b)=>Date.parse(a[field])-Date.parse(b[field])).at(-1)??null;

export function createCattleReportingService(persistence){
  const base=createBaseReportingService(persistence);
  const financeInsights=createDeepFinanceInsights(persistence);
  const pastureInsights=createDeepPastureInsights(persistence);
  const insights=async(scope,options={})=>{
    if(scope==='finance')return financeInsights(options);
    if(scope==='pastures')return pastureInsights(options);
    return base.insights(scope,options);
  };
  const build=async(type,options={})=>{
    const result=await base.build(type,options);
    if(type!=='pasture')return result;
    const [assessmentRecords,rotationRecords,occupancyRecords]=await Promise.all([
      persistence.listRecords('cattle.pasture-assessments'),
      persistence.listRecords('cattle.pasture-rotation-plan'),
      persistence.listRecords('cattle.pasture-occupancy')
    ]);
    const assessments=payloads(assessmentRecords),rotations=payloads(rotationRecords),occupancy=payloads(occupancyRecords);
    const enriched=result.rows.map(row=>{
      const latestAssessment=latestByDate(assessments.filter(item=>item.pastureId===row.id),'occurredAt');
      const rotation=latestByDate(rotations.filter(item=>item.pastureId===row.id),'plannedEnterAt');
      const actual=rotation?occupancy.filter(item=>item.pastureId===rotation.pastureId&&item.lotId===rotation.lotId).slice().sort((a,b)=>Math.abs(Date.parse(a.enteredAt)-Date.parse(rotation.plannedEnterAt))-Math.abs(Date.parse(b.enteredAt)-Date.parse(rotation.plannedEnterAt)))[0]??null:null;
      return Object.freeze({...row,
        latestAssessmentAt:latestAssessment?.occurredAt??null,
        latestAssessmentScore:latestAssessment?.score??null,
        latestHeightCm:latestAssessment?.heightCm??null,
        latestForageMassKgHa:latestAssessment?.forageMassKgHa??null,
        latestGroundCoverPct:latestAssessment?.groundCoverPct??null,
        rotationPlanId:rotation?.id??null,
        plannedEnterAt:rotation?.plannedEnterAt??null,
        plannedLeaveAt:rotation?.plannedLeaveAt??null,
        actualEnterAt:actual?.enteredAt??null,
        actualLeaveAt:actual?.leftAt??null,
        enterVarianceHours:hoursBetween(rotation?.plannedEnterAt,actual?.enteredAt),
        leaveVarianceHours:hoursBetween(rotation?.plannedLeaveAt,actual?.leftAt)
      });
    });
    return Object.freeze({...result,rows:Object.freeze(enriched)});
  };
  return Object.freeze({...base,build,insights,financeInsights,pastureInsights});
}
