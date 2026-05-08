/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_SEPOLIA_RPC_URL: string;
  readonly VITE_WC_PROJECT_ID?: string;
  readonly VITE_MOCK_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
