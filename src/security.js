import {createProductSecurity} from '../shared/packages/product-security/src/index.js';
import {createAuditService} from './audit.js';

export const SECURITY_POLICY=Object.freeze({
  admin:['*'],
  manager:['cattle:read','cattle:write','finance:read','reports:read','audit:read','session:revoke','settings:read','settings:backup','iot:read','iot:write'],
  'field-operator':['cattle:read','cattle:write','reports:read','session:revoke'],
  finance:['cattle:read','finance:read','reports:read','session:revoke'],
  viewer:['cattle:read','reports:read','session:revoke']
});

export const PRESENTATION_ACCESS=Object.freeze({
  defaultRead:'cattle:read',
  defaultWrite:'cattle:write',
  screens:Object.freeze({
    data:{read:'cattle:read',write:'cattle:write'},
    finance:{read:'finance:read'},
    reports:{read:'reports:read',write:'reports:read'},
    iot:{read:'iot:read',write:'iot:write'},
    settings:{
      read:'settings:read',
      write:'settings:write',
      actions:Object.freeze({backup:'settings:backup',restore:'settings:restore'})
    }
  })
});

export function createSecurityService(persistence,{audit=createAuditService(persistence,{productId:'agro-pecuaria'})}={}){
  return createProductSecurity(persistence,{
    productId:'agro-pecuaria',
    policyDefinition:SECURITY_POLICY,
    presentationAccess:PRESENTATION_ACCESS,
    audit
  });
}
