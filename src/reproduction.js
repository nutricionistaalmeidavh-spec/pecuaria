const payload=value=>value?.payload??value;
const pct=(num,den)=>den>0?(num/den)*100:null;
const idSet=values=>new Set((values??[]).filter(Boolean));
const positiveResult=value=>['positive','pregnant','yes','sim','positivo','prenhe'].includes(String(value??'').trim().toLowerCase());

export function reproductionMetrics(events=[],{eligibleFemaleIds=[]}={}){
  const rows=(events??[]).map(payload).filter(event=>event?.kind==null||event.kind==='reproduction');
  const eligible=idSet(eligibleFemaleIds);
  const services=rows.filter(event=>event?.type==='service');
  const checks=rows.filter(event=>event?.type==='pregnancy-check');
  const calvings=rows.filter(event=>event?.type==='calving');
  const weanings=rows.filter(event=>event?.type==='weaning');
  const losses=rows.filter(event=>event?.type==='pregnancy-loss'||event?.type==='abortion');

  const serviced=idSet(services.map(event=>event.animalId));
  const pregnant=idSet(checks.filter(event=>positiveResult(event?.metadata?.result)).map(event=>event.animalId));
  const calved=idSet(calvings.map(event=>event.animalId));
  const weaned=idSet(weanings.map(event=>event.animalId));
  const lost=idSet(losses.map(event=>event.animalId));

  const eligibleCount=eligible.size;
  const servicedFemales=serviced.size;
  const pregnantFemales=pregnant.size;
  const calvedFemales=calved.size;
  const weanedFemales=weaned.size;
  const pregnancyLosses=lost.size;

  return Object.freeze({
    total:rows.length,
    services:services.length,
    pregnancyChecks:checks.length,
    calvings:calvings.length,
    weanings:weanings.length,
    pregnancyLosses,
    eligibleFemales:eligibleCount,
    servicedFemales,
    pregnantFemales,
    calvedFemales,
    weanedFemales,
    serviceRatePct:pct(servicedFemales,eligibleCount),
    conceptionRatePct:pct(pregnantFemales,servicedFemales),
    pregnancyRatePct:pct(pregnantFemales,eligibleCount),
    calvingRatePct:pct(calvedFemales,pregnantFemales),
    weaningRatePct:pct(weanedFemales,calvedFemales),
    pregnancyLossRatePct:pct(pregnancyLosses,pregnantFemales)
  });
}
