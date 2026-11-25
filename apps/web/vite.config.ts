import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@financeflow/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], globals: true },
});
