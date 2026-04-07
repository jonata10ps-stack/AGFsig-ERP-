import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://vcbbvqhfcnouhsazqoxr.supabase.co';

  return {
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Proxy Supabase REST, Auth, Storage and Functions
        '/rest/v1': { target: supabaseUrl, changeOrigin: true },
        '/auth/v1': { target: supabaseUrl, changeOrigin: true },
        '/storage/v1': { target: supabaseUrl, changeOrigin: true },
        '/functions/v1': { target: supabaseUrl, changeOrigin: true },
      }
    }
  };
});