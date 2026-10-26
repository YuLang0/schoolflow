import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버에서도 /api/neis 가 Netlify 함수와 똑같이 동작하게 합니다.
function neisDevProxy(): Plugin {
  return {
    name: 'neis-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/neis', async (req, res) => {
        const modPath = new URL('./netlify/functions/neis.mjs', import.meta.url).href;
        const { default: handler } = await import(/* @vite-ignore */ modPath);
        const r: Response = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`), process.env);
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await r.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), neisDevProxy()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'netlify/**/*.test.mjs'],
  },
} as never);
