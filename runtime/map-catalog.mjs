import {createMapPackageManager,MAP_RELEASE_REPOSITORY,MAP_PACKAGE_CONSTANTS} from './map-package-manager.mjs';

// Compatibility adapter only. Runtime ownership lives in map-package-manager.mjs.
export {MAP_RELEASE_REPOSITORY};
export const DEFAULT_MAP_MANIFEST_URL=MAP_PACKAGE_CONSTANTS.DEFAULT_MANIFEST_URL;

export function createMapCatalog(options={}){
  const manager=createMapPackageManager(options);
  return Object.freeze({
    snapshot:manager.snapshot,
    refresh:manager.refreshCatalog,
    plan:manager.planFarmMap,
    manifestUrl:manager.manifestUrl
  });
}
