import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root,plugins:[react()],resolve:{alias:{'@':root}},base:'./',build:{outDir:'../assets',emptyOutDir:true,manifest:true,rollupOptions:{input:path.join(root,'main.tsx'),output:{entryFileNames:'app-[hash].js',chunkFileNames:'chunk-[hash].js',assetFileNames:'[name]-[hash][extname]'}},target:'es2022'}});
