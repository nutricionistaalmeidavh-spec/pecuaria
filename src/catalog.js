import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleInvariantService} from './invariants.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};

export function createCattleBreed({id,name,species='bovine'}={}){
  return Object.freeze({id:text(id,'Breed id'),name:text(name,'Breed name'),species:text(species,'Species')});
}

export function createCattleCategory({id,name,purpose}={}){
  return Object.freeze({id:text(id,'Category id'),name:text(name,'Category name'),purpose:text(purpose,'Purpose')});
}

export function createSanitaryProtocol({id,name,productItemId,dose,unit,intervalDays=null}={}){
  return Object.freeze({id:text(id,'Protocol id'),name:text(name,'Protocol name'),productItemId:text(productItemId,'Product item id'),dose,unit:text(unit,'Dose unit'),intervalDays});
}

function createBaseRepositories(persistence){
  return Object.freeze({
    lots:createEntityRepository(persistence,{collection:'cattle.lots'}),
    animals:createEntityRepository(persistence,{collection:'cattle.animals'}),
    breeds:createEntityRepository(persistence,{collection:'cattle.breeds'}),
    categories:createEntityRepository(persistence,{collection:'cattle.categories'}),
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
