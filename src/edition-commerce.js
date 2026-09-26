import {EDITIONS} from './editions.js';

const defs=[
  ['PEC-ESSENTIAL','essential','ArtiSys Pecuária Essencial',39],
  ['PEC-MANAGEMENT','management','ArtiSys Pecuária Gestão',120],
  ['PEC-PRO','pro','ArtiSys Pecuária Pro',330]
];

export const COMMERCIAL_CATALOG=Object.freeze(defs.map(([sku,edition,name,priceBrl])=>Object.freeze({
  sku,edition,name,priceBrl,saleModel:'one-time',currency:'BRL',
  features:EDITIONS[edition].features,
  installer:'shared'
})));

const byEdition=new Map(COMMERCIAL_CATALOG.map(item=>[item.edition,item]));
const rank=Object.freeze({essential:0,management:1,pro:2});

export function commercialProduct(edition){
  const product=byEdition.get(edition);
  if(!product){
    const error=new Error(`Unknown commercial edition: ${edition}`);
    error.code='UNKNOWN_EDITION';
    throw error;
  }
  return product;
}

export function upgradeQuote(fromEdition,toEdition){
  const from=commercialProduct(fromEdition),to=commercialProduct(toEdition);
  if(rank[toEdition]<=rank[fromEdition]){
    const error=new Error(`Invalid edition upgrade: ${fromEdition} -> ${toEdition}`);
    error.code='INVALID_EDITION_UPGRADE';
    throw error;
  }
  return Object.freeze({
    fromEdition,toEdition,
    fromSku:from.sku,toSku:to.sku,
    amountBrl:to.priceBrl-from.priceBrl,
    currency:'BRL',saleModel:'one-time',requiresReinstall:false
  });
}

export function checkoutCatalog(){
  return Object.freeze({
    product:'agro-pecuaria',provider:'provider-agnostic',
    products:COMMERCIAL_CATALOG,
    upgrades:Object.freeze([
      upgradeQuote('essential','management'),
      upgradeQuote('management','pro'),
      upgradeQuote('essential','pro')
    ])
  });
}
