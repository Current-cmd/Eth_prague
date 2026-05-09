import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // loadEnv reads .env, .env.local, .env.[mode], .env.[mode].local
  // and makes them available here in Node context (not just import.meta.env).
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/v1': 'http://localhost:8787',
      },
    },
    define: {
      // Shim process.env so shared/chain.ts (written for Node) works in the browser.
      'process.env': JSON.stringify({
        COMPANY_REGISTRY:    env.VITE_COMPANY_REGISTRY,
        BADGE_TREE_MANAGER:  env.VITE_BADGE_TREE_MANAGER,
        REPORT_REGISTRY:     env.VITE_REPORT_REGISTRY,
        SHIELDPASS_RESOLVER: env.VITE_SHIELDPASS_RESOLVER,
        RISC0_VERIFIER:      env.VITE_RISC0_VERIFIER,
        BOUNDLESS_MARKET:    env.VITE_BOUNDLESS_MARKET,
      }),
    },
  }
})
