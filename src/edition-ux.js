const freezeList=items=>Object.freeze([...items]);

const ESSENTIAL_SECTIONS=freezeList([
  'dashboard','lots','animals','weights','sanitary','data-basic','backup'
]);
const MANAGEMENT_SECTIONS=freezeList([
  ...ESSENTIAL_SECTIONS,
  'animals-batch','sanitary-batch','reproduction','trades','finance-production','reports',
  'traceability','inventory','pastures','nutrition','tasks','data-import','sales-simulation'
]);
const PRO_SECTIONS=freezeList([
  ...MANAGEMENT_SECTIONS,
  'animal-body-condition','finance-admin','reproduction-pro','pastures-advanced','maps',
  'field-offline','iot','user-admin','audit'
]);

export const EDITION_UX=Object.freeze({
  essential:Object.freeze({
    id:'essential',label:'Essencial',shortLabel:'Essencial',
    tagline:'Controle essencial do rebanho',
    density:'focused',showUpgradeHint:true,sections:ESSENTIAL_SECTIONS
  }),
  management:Object.freeze({
    id:'management',label:'Gestão',shortLabel:'Gestão',
    tagline:'Gestão produtiva integrada',
    density:'balanced',showUpgradeHint:true,sections:MANAGEMENT_SECTIONS
  }),
  pro:Object.freeze({
    id:'pro',label:'Pro',shortLabel:'Pro',
    tagline:'Operação pecuária profissional',
    density:'complete',showUpgradeHint:false,sections:PRO_SECTIONS
  })
});

export function editionUxProfile(edition='pro'){
  const profile=EDITION_UX[edition];
  if(!profile){
    const error=new Error(`Unknown edition UX profile: ${edition}`);
    error.code='UNKNOWN_EDITION';
    throw error;
  }
  return profile;
}

export function uxSectionEnabled(edition,section){
  return editionUxProfile(edition).sections.includes(section);
}
