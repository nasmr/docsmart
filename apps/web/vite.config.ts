import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use workspace packages' TypeScript source directly.
    conditions: ['development'],
  },
});
