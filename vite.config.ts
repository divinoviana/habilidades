
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Garante que as variáveis de ambiente sejam tratadas como strings literais no código final
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Fallback para manter compatibilidade com acessos diretos a process.env
    'process.env': JSON.stringify({
      API_KEY: process.env.API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    })
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: './index.html'
    }
  }
});
