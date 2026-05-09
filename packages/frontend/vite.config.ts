import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // shared/chain.ts uses process.env for contract addresses (Node-only).
    // In the browser we shim it to empty so the module loads without crashing.
    // Set VITE_* vars (and map them here) once contracts are deployed.
    'process.env': JSON.stringify({
      COMPANY_REGISTRY:   process.env.VITE_COMPANY_REGISTRY,
      BADGE_TREE_MANAGER: process.env.VITE_BADGE_TREE_MANAGER,
      REPORT_REGISTRY:    process.env.VITE_REPORT_REGISTRY,
      SHIELDPASS_RESOLVER:process.env.VITE_SHIELDPASS_RESOLVER,
      RISC0_VERIFIER:     process.env.VITE_RISC0_VERIFIER,
      BOUNDLESS_MARKET:   process.env.VITE_BOUNDLESS_MARKET,
    }),
  },
})
