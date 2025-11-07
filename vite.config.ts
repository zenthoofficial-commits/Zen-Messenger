// Zen-Messenger/vite.config.ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '', '');
  
  return {
    // ⬇️ ဤစာကြောင်းကို ထည့်ပါ သို့မဟုတ် ပြင်ဆင်ပါ။
    base: '/Zen-Messenger/', 
    // ⬆️ ဤစာကြောင်းကို ထည့်ပါ သို့မဟုတ် ပြင်ဆင်ပါ။
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  };
});
