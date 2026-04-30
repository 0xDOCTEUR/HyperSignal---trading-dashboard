import type { Locale } from './locale'

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  )
}

/** Textes FR (référence) — garde les clés alignées avec `en`. */
const fr = {
  'nav.refresh': 'Actualiser',
  'nav.scan': 'Scanner',
  'nav.scanning': 'Scan…',
  'nav.autoScan': 'Auto scan ({{minutes}} min)',
  'nav.langFr': 'FR',
  'nav.langEn': 'EN',
  'nav.langGroupAria': 'Langue',

  'live.live': 'Live',
  'live.wait': '…',

  'scan.cardAria': 'Opportunités',
  'scan.title': 'Opportunités',
  'scan.universeUnavailable': 'Univers HL indisponible.',
  'scan.progressCandles':
    'Analyse des bougies : {{done}} / {{total}} paires…',
  'scan.progressTradability':
    'Tradabilité multi‑TF : {{done}} / {{total}} candidats…',

  'scan.thRank': '#',
  'scan.thPair': 'Paire',
  'scan.thSide': 'Sens',
  'scan.thPrice': 'Prix',
  'scan.thScore': 'Score',
  'scan.thBtc': 'vs BTC',
  'scan.thPlanSr': 'Plan',

  'scan.priceColTitle': 'Dernier close au scan ({{interval}})',
  'scan.scoreColTitle': 'Synthèse qualitative scanner (0–100)',
  'scan.scoreCellTitle':
    'Synthèse qualitative (confluence, biais, confirmation, vs BTC…), pas une probabilité de gain.',

  'scan.planBtn': 'Plan',
  'scan.openPlanTitle': 'Ouvrir {{coin}} dans le Plan',

  'scan.emptyBody':
    'Aucune opportunité ne passe tous les filtres pour le moment (RR TP1, alignement multi‑UT, marge daily…).',
  'scan.emptyHint':
    'Aucune ligne : confluence ≥ {{conf}} %, RR TP1 ≥ {{rr}}×, pyramide ≥ {{mtf}} UT.',

  'scan.srIntro':
    'Opportunités : bougies {{interval}} sur au plus {{topPairs}} paires par volume HL ; multi‑TF léger sur au plus {{mtfCheck}} meilleurs candidats après confluence ; arrêt du multi‑TF dès {{softCap}} opportunités passant tous les filtres. Intervalles : 15 minutes, 1 heure, 4 heures, journalier. Niveaux SL et TP sur flux {{planIv}}. Filtres : confluence au moins {{minConf}} pour cent, RR premier objectif au moins {{minRr}} fois, au moins {{minMtf}} horizons alignés avec le sens du trade. Taille indicative {{equity}} dollars. Scan automatique désactivé par défaut, pas {{autoMin}} minutes si activé.',

  'btc.outperform': 'Bat BTC',
  'btc.inline': '≈ BTC',
  'btc.underperform': 'Sous BTC',

  'errors.clipboard':
    'Erreur copie — autorise le presse-papiers dans le navigateur',

  'plan.title': 'Plan',
  'plan.filterLabel': 'Filtrer',
  'plan.filterPlaceholder': 'Symbole ou nom…',
  'plan.filterAria': 'Filtrer les paires par symbole ou nom',
  'plan.pairLabel': 'Paire (perps HL)',
  'plan.pairAria': 'Choisir une paire Hyperliquid',
  'plan.noPairMatch': 'Aucune paire ne correspond au filtre.',

  'plan.liveStripTitle': 'Dernier cours (flux Plan)',
  'plan.liveSrPrefix': 'Prix actif',
  'plan.liveSrUnavailable': ' indisponible',

  'plan.entryHintLimit':
    'Limite · {{low}} — {{high}} · {{coin}}',
  'plan.entryHintMarket': 'Entrée · {{coin}}',
  'plan.tpHint': 'Take profit · {{coin}}',
  'plan.slHint': 'SL · {{coin}}',

  'plan.rrLabel': 'RR TP1',
  'plan.rrAria':
    'Objectif risque rendement TP1 (entre {{min}} et {{max}})',
  'plan.rrTitle':
    'TP1 placé à environ {{rr}}× la distance entrée → SL (référence close plan).',
  'plan.rrPillShifted':
    'RR réel aux niveaux copiés : {{actual}}× (entrée limite ≠ close réf.) · objectif {{target}}×',
  'plan.rrPillFlat': 'RR aux niveaux affichés : {{actual}}×',

  'plan.copyAll': 'Copier tout',
  'plan.copiedToast': 'Copié',

  'plan.biasMarketAria': 'Biais marché {{pair}}',
  'plan.biasSr': 'Biais · {{pair}}',
  'plan.trendReadoutEyebrow': 'Lecture multi‑UT',

  'plan.empty.candlesUnavailable': 'Bougies indisponibles',
  'plan.empty.loading': 'Chargement des bougies…',
  'plan.empty.shortHistoryTitle': 'Historique trop court',
  'plan.empty.historyShort':
    'Seulement {{have}}/60 bougies sur {{interval}} (flux Plan fixe).',
  'plan.empty.regimeUnavailable': 'Régime non calculable',
  'plan.empty.regimeUnavailableBody':
    'Les indicateurs de régime ne sont pas exploitables sur cette fenêtre (EMA/ATR en fin de série). Attendez la fin du chargement ou changez de paire.',
  'plan.empty.atrInsufficient': 'ATR insuffisant',
  'plan.empty.atrInsufficientBody':
    'ATR(14) absent ou nul : impossible de fixer une distance de stop structurée.',
  'plan.empty.planFailed': 'Plan non calculé',
  'plan.empty.planFailedBody':
    'Stop, taille ou niveaux incohérents malgré des signaux présents. Réactualisez les bougies ou vérifiez la paire.',

  'copy.label': 'Copier',
  'copy.aria': 'Copier {{label}}',

  'tips.rowCopied': '{{label}} copié',

  'footer.supportAria': 'Parrainage et soutien',
  'footer.hlTitle': 'Hyperliquid',
  'footer.hlLead':
    'Pas encore sur Hyperliquid ? Inscrivez-vous via ce lien — vous aidez aussi le projet.',
  'footer.hlCta': "S'inscrire sur Hyperliquid →",
  'footer.tipsTitle': 'Pourboires',
  'footer.tipsLead':
    'Si cet outil vous aide, un pourboire en crypto reste apprécié.',
  'footer.xTitle': 'X',
  'footer.xLead':
    'Retours, idées ou signalement de bug — passez par le profil.',
  'footer.xCta': '{{handle}} sur X →',

  'bloc.pairDirection': '{{pair}} · {{dir}}',
  'bloc.lastPrice': 'Dernier cours ({{interval}}): {{price}}',
  'bloc.planCloseRef': 'Close réf. plan: {{price}}',
  'bloc.rrTp1': 'RR TP1 (~entrée affichée): {{rr}}×',

  'tips.eth': 'ETH / EVM',
  'tips.sol': 'Solana',
} as const

const en: Record<keyof typeof fr, string> = {
  'nav.refresh': 'Refresh',
  'nav.scan': 'Scan',
  'nav.scanning': 'Scanning…',
  'nav.autoScan': 'Auto scan ({{minutes}} min)',
  'nav.langFr': 'FR',
  'nav.langEn': 'EN',
  'nav.langGroupAria': 'Language',

  'live.live': 'Live',
  'live.wait': '…',

  'scan.cardAria': 'Opportunities',
  'scan.title': 'Opportunities',
  'scan.universeUnavailable': 'Hyperliquid universe unavailable.',
  'scan.progressCandles': 'Scanning candles: {{done}} / {{total}} pairs…',
  'scan.progressTradability':
    'Multi-TF tradability: {{done}} / {{total}} candidates…',

  'scan.thRank': '#',
  'scan.thPair': 'Pair',
  'scan.thSide': 'Side',
  'scan.thPrice': 'Price',
  'scan.thScore': 'Score',
  'scan.thBtc': 'vs BTC',
  'scan.thPlanSr': 'Plan',

  'scan.priceColTitle': 'Last scan close ({{interval}})',
  'scan.scoreColTitle': 'Scanner qualitative summary (0–100)',
  'scan.scoreCellTitle':
    'Qualitative blend (confluence, bias, confirmation, vs BTC…), not a win probability.',

  'scan.planBtn': 'Plan',
  'scan.openPlanTitle': 'Open {{coin}} in Plan',

  'scan.emptyBody':
    'No opportunity passes all filters right now (TP1 RR, multi-TF alignment, daily room…).',
  'scan.emptyHint':
    'No rows: confluence ≥ {{conf}} %, TP1 RR ≥ {{rr}}×, pyramid ≥ {{mtf}} TFs.',

  'scan.srIntro':
    'Opportunities: {{interval}} candles on up to {{topPairs}} HL volume pairs; light multi-TF on up to {{mtfCheck}} best candidates after confluence; multi-TF stops once {{softCap}} opportunities pass all filters. Intervals: 15m, 1h, 4h, daily. SL/TP levels use the {{planIv}} feed. Filters: at least {{minConf}}% confluence, first TP RR at least {{minRr}}×, at least {{minMtf}} timeframes aligned with trade direction. Indicative size {{equity}} USD. Auto scan off by default; every {{autoMin}} minutes when enabled.',

  'btc.outperform': 'Beat BTC',
  'btc.inline': '≈ BTC',
  'btc.underperform': 'Lag BTC',

  'errors.clipboard':
    'Copy failed — allow clipboard access in your browser',

  'plan.title': 'Plan',
  'plan.filterLabel': 'Filter',
  'plan.filterPlaceholder': 'Symbol or name…',
  'plan.filterAria': 'Filter pairs by symbol or name',
  'plan.pairLabel': 'Pair (HL perps)',
  'plan.pairAria': 'Choose a Hyperliquid pair',
  'plan.noPairMatch': 'No pair matches the filter.',

  'plan.liveStripTitle': 'Last price (Plan feed)',
  'plan.liveSrPrefix': 'Live price',
  'plan.liveSrUnavailable': ' unavailable',

  'plan.entryHintLimit': 'Limit · {{low}} — {{high}} · {{coin}}',
  'plan.entryHintMarket': 'Entry · {{coin}}',
  'plan.tpHint': 'Take profit · {{coin}}',
  'plan.slHint': 'SL · {{coin}}',

  'plan.rrLabel': 'RR TP1',
  'plan.rrAria': 'Risk/reward target for TP1 (between {{min}} and {{max}})',
  'plan.rrTitle':
    'TP1 placed at ~{{rr}}× the entry→SL distance (plan close reference).',
  'plan.rrPillShifted':
    'Effective RR at copied levels: {{actual}}× (limit entry ≠ plan close ref.) · target {{target}}×',
  'plan.rrPillFlat': 'RR at displayed levels: {{actual}}×',

  'plan.copyAll': 'Copy all',
  'plan.copiedToast': 'Copied',

  'plan.biasMarketAria': 'Market bias {{pair}}',
  'plan.biasSr': 'Bias · {{pair}}',
  'plan.trendReadoutEyebrow': 'Multi-timeframe read',

  'plan.empty.candlesUnavailable': 'Candles unavailable',
  'plan.empty.loading': 'Loading candles…',
  'plan.empty.shortHistoryTitle': 'History too short',
  'plan.empty.historyShort':
    'Only {{have}}/60 candles on {{interval}} (fixed Plan feed).',
  'plan.empty.regimeUnavailable': 'Regime unavailable',
  'plan.empty.regimeUnavailableBody':
    'Regime indicators are not usable on this window (EMA/ATR at series end). Wait for load to finish or switch pair.',
  'plan.empty.atrInsufficient': 'Insufficient ATR',
  'plan.empty.atrInsufficientBody':
    'ATR(14) missing or zero: cannot set a structured stop distance.',
  'plan.empty.planFailed': 'Plan not computed',
  'plan.empty.planFailedBody':
    'Stop, size or levels inconsistent despite signals present. Refresh candles or check the pair.',

  'copy.label': 'Copy',
  'copy.aria': 'Copy {{label}}',

  'tips.rowCopied': '{{label}} copied',

  'footer.supportAria': 'Referral and support',
  'footer.hlTitle': 'Hyperliquid',
  'footer.hlLead':
    'Not on Hyperliquid yet? Sign up via this link — it also supports the project.',
  'footer.hlCta': 'Sign up on Hyperliquid →',
  'footer.tipsTitle': 'Tips',
  'footer.tipsLead':
    'If this tool helps you, a crypto tip is appreciated.',
  'footer.xTitle': 'X',
  'footer.xLead': 'Feedback, ideas or bugs — reach out on the profile.',
  'footer.xCta': '{{handle}} on X →',

  'bloc.pairDirection': '{{pair}} · {{dir}}',
  'bloc.lastPrice': 'Last price ({{interval}}): {{price}}',
  'bloc.planCloseRef': 'Plan ref. close: {{price}}',
  'bloc.rrTp1': 'RR TP1 (~displayed entry): {{rr}}×',

  'tips.eth': 'ETH / EVM',
  'tips.sol': 'Solana',
}

export type MessageKey = keyof typeof fr

export const DICT: Record<Locale, Record<MessageKey, string>> = {
  fr: fr,
  en: en,
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = DICT[locale][key] ?? DICT.fr[key]
  return interpolate(raw, vars)
}
