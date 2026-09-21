import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const paths=[
  '.github/workflows/p1-apply-surface.yml',
  'tooling/apply-p1a-surface.mjs',
  'tooling/apply-p1a-ui.mjs',
  'tooling/apply-p1b-surface.mjs',
  'tooling/apply-p1c-field-quick.mjs',
  'tooling/apply-p1c-field-ui.mjs',
  'tooling/apply-p1c-roundtrip.mjs',
  'tooling/apply-p1c-snapshot.mjs',
  'tooling/apply-p1c-surface.mjs',
  'tooling/apply-p1d-integration.mjs'
];
for(const path of paths)await rm(join(root,path),{force:true});
console.log('P1 temporary patch scaffolding removed');
