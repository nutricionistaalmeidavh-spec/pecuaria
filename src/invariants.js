const normalizedTag=value=>String(value??'').trim().toLowerCase();

export function createCattleInvariantService({repos}={}){
  if(!repos?.animals||!repos?.lots)throw new TypeError('Cattle repositories are required.');
  return Object.freeze({
    async assertUniqueAnimalTag({tag,excludeId=null}={}){
      const normalized=normalizedTag(tag);
      if(!normalized)throw new TypeError('Animal tag is required.');
      const duplicate=(await repos.animals.list()).find(row=>row.id!==excludeId&&normalizedTag(row.payload?.tag)===normalized);
      if(duplicate)throw new Error(`Animal tag already exists: ${String(tag).trim()}.`);
    },
    async assertLotExists(lotId){
      if(lotId===null||lotId===undefined||lotId==='')return null;
      const row=await repos.lots.get(lotId);
      if(!row)throw new Error(`Lot not found: ${lotId}.`);
      return row;
    },
    async assertAnimalExists(animalId){
      const row=await repos.animals.get(animalId);
      if(!row)throw new Error(`Animal not found: ${animalId}.`);
      return row;
    },
    async assertProtocolExists(protocolId){
      const row=await repos.sanitaryProtocols.get(protocolId);
      if(!row)throw new Error(`Protocol not found: ${protocolId}.`);
      return row;
    }
  });
}
