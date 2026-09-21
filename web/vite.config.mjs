import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

const reactVendorPackages=['/react/','/react-dom/','/scheduler/'];

export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'./',
  build:{
    outDir:fileURLToPath(new URL('../dist/',import.meta.url)),
    emptyOutDir:true,
    target:'es2022',
    rollupOptions:{
      output:{
        manualChunks(id){
          if(reactVendorPackages.some(pkg=>id.includes(`/node_modules${pkg}`)))return 'react-vendor';
        }
      }
    }
  }
});
