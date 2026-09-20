const finitePositive=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new TypeError(`${label} must be positive.`);return n};
const finiteNonNegative=(value,label)=>{const n=Number(value??0);if(!Number.isFinite(n)||n<0)throw new TypeError(`${label} must be zero or positive.`);return n};
const money=(value,label)=>{const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0)throw new TypeError(`${label} must be a non-negative integer in minor units.`);return n};
const round=value=>Math.round((value+Number.EPSILON)*1000000)/1000000;

export function calculateCattleSettlement({
  liveWeightKg,
  carcassWeightKg=null,
  carcassYieldPct=null,
  pricePerCarcassArrobaMinor,
  deductionsMinor=0,
  freightMinor=0,
  commissionMinor=0
}={}){
  const liveKg=finitePositive(liveWeightKg,'Live weight');
  const price=money(pricePerCarcassArrobaMinor,'Price per carcass arroba');
  if(price<=0)throw new TypeError('Price per carcass arroba must be positive.');

  let carcassKg;
  let yieldPct;
  if(carcassWeightKg!=null&&carcassWeightKg!==''){
    carcassKg=finitePositive(carcassWeightKg,'Carcass weight');
    yieldPct=(carcassKg/liveKg)*100;
    if(carcassYieldPct!=null&&carcassYieldPct!==''){
      const supplied=finitePositive(carcassYieldPct,'Carcass yield');
      if(Math.abs(supplied-yieldPct)>0.5)throw new Error('Carcass weight and carcass yield are inconsistent.');
    }
  }else{
    yieldPct=finitePositive(carcassYieldPct,'Carcass yield');
    if(yieldPct>100)throw new RangeError('Carcass yield cannot exceed 100%.');
    carcassKg=liveKg*(yieldPct/100);
  }

  const liveArrobas=liveKg/15;
  const carcassArrobas=carcassKg/15;
  const grossMinor=Math.round(carcassArrobas*price);
  const deductions=money(deductionsMinor,'Deductions');
  const freight=money(freightMinor,'Freight');
  const commission=money(commissionMinor,'Commission');
  const totalDeductionsMinor=deductions+freight+commission;
  const netMinor=grossMinor-totalDeductionsMinor;
  if(netMinor<=0)throw new Error('Commercial settlement net amount must be positive.');

  return Object.freeze({
    arrobaBasis:'carcass',
    liveWeightKg:round(liveKg),
    liveArrobas:round(liveArrobas),
    carcassWeightKg:round(carcassKg),
    carcassYieldPct:round(yieldPct),
    carcassArrobas:round(carcassArrobas),
    pricePerCarcassArrobaMinor:price,
    deductionsMinor:deductions,
    freightMinor:freight,
    commissionMinor:commission,
    totalDeductionsMinor,
    grossMinor,
    netMinor
  });
}

export function hasCommercialSettlementInput(input={}){
  return [input.liveWeightKg,input.carcassWeightKg,input.carcassYieldPct,input.pricePerCarcassArrobaMinor].some(value=>value!=null&&value!=='');
}
