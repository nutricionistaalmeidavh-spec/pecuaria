import {verifyLicense} from '../shared/packages/licensing/src/index.js';
import {createEditionAccess} from '../src/editions.js';

const PRODUCT_ID='agro-pecuaria';

function licenseError(code,message,reason=null){
  const error=new Error(message);
  error.code=code;
  if(reason)error.reason=reason;
  return error;
}

export function resolveProductAccess({edition='pro',licenseToken=null,licensePublicKey=null,licenseRequired=false,deviceId=null,now=null}={}){
  if(!licenseToken){
    if(licenseRequired)throw licenseError('LICENSE_REQUIRED','A valid ArtiSys Pecuária license is required.');
    return createEditionAccess({edition,licensed:false});
  }
  if(!licensePublicKey)throw licenseError('LICENSE_INVALID','License public key is required to verify this license.','missing-public-key');
  const verification=verifyLicense(licenseToken,licensePublicKey,{product:PRODUCT_ID,deviceId,now:now??undefined});
  if(!verification.valid)throw licenseError('LICENSE_INVALID',`ArtiSys Pecuária license is invalid: ${verification.reason}.`,verification.reason);
  return createEditionAccess({features:verification.payload.features,licensed:true,licensePayload:verification.payload});
}

export const PECUARIA_PRODUCT_ID=PRODUCT_ID;
