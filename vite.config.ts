import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // Repointed for the single-package layout (SCAF-01): the SPA lives under src/client
      routesDirectory: './src/client/routes',
      generatedRouteTree: './src/client/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    // Unifies the SPA build + Hono Worker into one dev server/build, in real workerd.
    // Reads wrangler.jsonc for `main` (./src/server/index.ts) + the assets block.
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
})
