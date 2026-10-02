import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The repository's .env holds both the API's settings and the web app's (VITE_*).
const envDir = '../..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    envDir,
    plugins: [react()],
    resolve: {
      // Use workspace packages' TypeScript source directly.
      conditions: ['development'],
    },
    server: {
      // The API has no CORS: in development the browser calls /api on this server, which forwards it.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${env.PORT ?? '3000'}`,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
