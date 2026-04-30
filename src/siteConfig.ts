/** Nom affiché dans l’interface (pas la clé localStorage du plan). */
export const SITE_BRAND = 'HyperSignal'

const DEFAULT_HL_REFERRAL = 'https://app.hyperliquid.xyz/join/DOCTEUR'
const DEFAULT_TIP_ETH = '0x8271b2a500342617571dfDdD69981278d96822aa'
const DEFAULT_AUTHOR_X = 'https://x.com/0xDOCTEUR'

/** Lien d’inscription Hyperliquid ; surcharge possible avec `VITE_HL_REFERRAL_URL`. */
export const HL_REFERRAL_SIGNUP_URL =
  (typeof import.meta.env.VITE_HL_REFERRAL_URL === 'string'
    ? import.meta.env.VITE_HL_REFERRAL_URL.trim()
    : '') || DEFAULT_HL_REFERRAL

/** Profil X ; surcharge possible avec `VITE_AUTHOR_X_URL`. */
export const AUTHOR_X_URL =
  (typeof import.meta.env.VITE_AUTHOR_X_URL === 'string'
    ? import.meta.env.VITE_AUTHOR_X_URL.trim()
    : '') || DEFAULT_AUTHOR_X

/** Libellé bouton X (profil affiché à l’utilisateur). */
export const AUTHOR_X_HANDLE = '@0xDOCTEUR'

export type TipWalletRow = {
  label: string
  address: string
}

function readTipWalletRows(): TipWalletRow[] {
  const rows: TipWalletRow[] = []
  const eth =
    (typeof import.meta.env.VITE_TIP_ETH === 'string'
      ? import.meta.env.VITE_TIP_ETH.trim()
      : '') || DEFAULT_TIP_ETH
  if (eth) rows.push({ label: 'ETH / EVM', address: eth })
  const sol =
    typeof import.meta.env.VITE_TIP_SOL === 'string' ? import.meta.env.VITE_TIP_SOL.trim() : ''
  if (sol) rows.push({ label: 'Solana', address: sol })
  return rows
}

/** Pourboires : ETH par défaut ; `VITE_TIP_ETH` / `VITE_TIP_SOL` pour surcharger ou ajouter SOL. */
export const TIP_WALLET_ROWS = readTipWalletRows()
