/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HL_REFERRAL_URL?: string
  readonly VITE_AUTHOR_X_URL?: string
  readonly VITE_TIP_ETH?: string
  readonly VITE_TIP_SOL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
