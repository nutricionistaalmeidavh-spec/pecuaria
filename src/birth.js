import {createAnimal} from './index.js';

const text=(value,label)=>{
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);
  return value.trim();
};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
const iso=(value,label)=>{
  const time=Date.parse(value);
  if(!Number.isFinite(time))throw new TypeError(`${label} must be a valid date.`);
  return new Date(time).toISOString();
};

export function createBirthRecords(input={}){
  const id=text(input.id,'Animal id');
  const tag=text(input.tag,'Animal tag');
  const farmUnitId=text(input.farmUnitId,'Farm unit id');
  const birthDate=iso(text(input.birthDate,'Birth date'),'Birth date');
  const sex=text(input.sex,'Sex');
  const damId=optional(input.damId);
  const sireId=optional(input.sireId);
  const lotId=optional(input.lotId);
  const breedId=optional(input.breedId);
  const categoryId=optional(input.categoryId);
  const rfid=optional(input.rfid);
  const notes=optional(input.notes);
  const animal=createAnimal({
    id,tag,farmUnitId,birthDate,sex,damId,sireId,lotId,breedId,categoryId,rfid,
    purpose:input.purpose??'beef',
    name:optional(input.name),
    officialId:optional(input.officialId),
    origin:input.origin??'birth',
    metadata:input.metadata??{}
  });
  const birthEvent=Object.freeze({
    id:`${id}:birth`,
    kind:'birth',
    type:'birth',
    animalId:id,
    relatedAnimalId:damId,
    occurredAt:birthDate,
    metadata:Object.freeze({sireId,notes})
  });
  return Object.freeze({animal,birthEvent});
}
