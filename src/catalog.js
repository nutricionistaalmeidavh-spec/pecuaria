import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleInvariantService} from './invariants.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const nonNegative=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new TypeError(`${l} must be zero or positive.`);return n};
const positive=(v,l)=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new TypeError(`${l} must be positive.`);return n};

export function createCattleBreed({id,name,species='bovine'}={}){
  return Object.freeze({id:text(id,'Breed id'),name:text(name,'Breed name'),species:text(species,'Species')});
}

export function createFarmUnit({id,name,registration=null,location=null}={}){
  return Object.freeze({id:text(id,'Farm unit id'),name:text(name,'Farm unit name'),registration:registration?.trim?.()||null,location:location?.trim?.()||null});
}

export function createCattleCategory({id,name,purpose}={}){
  return Object.freeze({id:text(id,'Category id'),name:text(name,'Category name'),purpose:text(purpose,'Purpose')});
}

export function createCattleParty({id,name,roles=['other'],document=null,phone=null,email=null,notes=null}={}){
  const allowed=new Set(['buyer','supplier','slaughterhouse','veterinarian','technician','other']);
  const normalized=[];
  for(const role of Array.isArray(roles)?roles:[roles]){
    const value=text(String(role),'Party role');
    if(!allowed.has(value))throw new TypeError(`Unsupported cattle party role: ${value}.`);
    if(!normalized.includes(value))normalized.push(value);
  }
  if(normalized.length===0)normalized.push('other');
  return Object.freeze({
    id:text(id,'Party id'),
    name:text(name,'Party name'),
    roles:Object.freeze(normalized),
    document:document?.trim?.()||null,
    phone:phone?.trim?.()||null,
    email:email?.trim?.()||null,
    notes:notes?.trim?.()||null
  });
}

export function createSanitaryProtocol({id,name,productItemId,dose,unit,intervalDays=null,withdrawalDays=null,activeIngredient=null}={}){
  return Object.freeze({
    id:text(id,'Protocol id'),
    name:text(name,'Protocol name'),
    productItemId:text(productItemId,'Product item id'),
    dose:positive(dose,'Dose'),
    unit:text(unit,'Dose unit'),
    intervalDays:intervalDays==null?null:nonNegative(intervalDays,'Interval days'),
    withdrawalDays:withdrawalDays==null?null:nonNegative(withdrawalDays,'Withdrawal days'),
    activeIngredient:activeIngredient?.trim?.()||null
  });
}

function createBaseRepositories(persistence){
  return Object.freeze({
    farmUnits:createEntityRepository(persistence,{collection:'cattle.farm-units'}),
    lots:createEntityRepository(persistence,{collection:'cattle.lots'}),
    animals:createEntityRepository(persistence,{collection:'cattle.animals'}),
    breeds:createEntityRepository(persistence,{collection:'cattle.breeds'}),
    categories:createEntityRepository(persistence,{collection:'cattle.categories'}),
    parties:createEntityRepository(persistence,{collection:'cattle.parties'}),
    sanitaryProtocols:createEntityRepository(persistence,{collection:'cattle.sanitary-protocols'}),
    events:createEntityRepository(persistence,{collection:'cattle.events'}),
    trades:createEntityRepository(persistence,{collection:'cattle.trades'})
  });
}

export function createCattleRepositories(persistence){
  const base=createBaseRepositories(persistence);
  const saveAnimal=async(entity,options={})=>{
    const saveWithin=async store=>{
      const scoped=createBaseRepositories(store);
      const invariants=createCattleInvariantService({repos:scoped});
      await invariants.assertUniqueAnimalTag({tag:entity?.tag,excludeId:entity?.id??null});
      await invariants.assertLotExists(entity?.lotId??null);
      return scoped.animals.save(entity,options);
    };
    return typeof persistence.transaction==='function'
      ? persistence.transaction(saveWithin)
      : saveWithin(persistence);
  };
  return Object.freeze({...base,animals:Object.freeze({...base.animals,save:saveAnimal})});
}
