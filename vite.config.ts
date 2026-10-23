import { defineConfig } from 'vitest/config';

/** Dev: `/admin` (không dấu gạch cuối) mở trang quản trị, giống rewrite trong vercel.json. */
const adminRewrite = {
  name: 'ps-admin-rewrite',
  configureServer(server: { middlewares: { use(fn: (req: { url?: string }, res: unknown, next: () => void) => void): void } }) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/admin(\?.*)?$/.test(req.url)) req.url = req.url.replace('/admin', '/admin/');
      next();
    });
  },
};

export default defineConfig({
  plugins: [adminRewrite],
  build: {
    rollupOptions: {
      // Trang chơi + trang quản trị /admin (xem vercel.json).
      input: {
        main: 'index.html',
        admin: 'admin/index.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
