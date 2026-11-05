import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Serves /api/game from the local Vite dev server using the exact same handler
 * that Vercel runs in production, so `npm run dev` is a full end-to-end setup.
 */
function apiDevServer() {
  return {
    name: 'ttt-api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/game', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/game.js')
          await mod.default(req, res)
        } catch (error) {
          console.error('[dev api]', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Dev API error: ' + error.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), apiDevServer()],
})
