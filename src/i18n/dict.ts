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
  'scan.thUt': 'UT',
  'scan.thPlanSr': 'Plan',

  'scan.priceColTitle': 'Dernier close au scan ({{interval}})',
  'scan.utColTitle': 'UT suggérée (synthèse multi‑TF ; le scan reste sur {{interval}})',
  'scan.scoreColTitle': 'Synthèse qualitative scanner (0–100)',
  'scan.scoreCellTitle':
    'Synthèse qualitative (confluence, alignement multi‑UT, biais, confirmation…), pas une probabilité de gain.',

  'scan.planBtn': 'Plan',
  'scan.openPlanTitle': 'Ouvrir {{coin}} dans le Plan',

  'scan.emptyBody':
    'Aucune opportunité ne figure dans le top {{softCap}} pour le moment (RR TP1, alignement multi‑UT, marge daily…).',
  'scan.emptyHint':
    'Aucune ligne : confluence ≥ {{conf}} %, RR TP1 ≥ {{rr}}×, pyramide ≥ {{mtf}} UT ; top {{softCap}} affiché.',

  'scan.filtersIntro':
    'Bougies {{interval}} sur le top {{topPairs}} paires (volume 24 h). Après tri confluence : jusqu’à {{mtfCheck}} candidats passés en contrôle multi‑UT. Pour entrer dans la liste : confluence ≥ {{minConf}} %, RR au TP1 ≥ {{minRr}}×, ≥ {{minMtf}} UT alignées avec le sens, marge daily ≥ {{dailyRoom}} % du cours. Affichage d’au plus {{softCap}} lignes (tri par score). Taille indicative des calculs : {{equity}} $. Auto‑scan toutes les {{autoMin}} min si activé. Synthèse multi‑UT du plan : 5m → hebdo (sans 1m).',

  'errors.clipboard':
    'Erreur copie — autorise le presse-papiers dans le navigateur',

  'plan.title': 'Plan',
  'plan.downloadCard': 'Télécharger la carte',
  'plan.downloadCardBusy': 'Export…',
  'plan.downloadCardAria':
    'Télécharger une image PNG du plan : Fear & Greed, paire, confluence multi‑UT, prix live, carnet LIMIT.',
  'plan.downloadCardErr': 'Impossible de générer l’image — réessaie.',
  'plan.fearGreedTitle': 'Fear & Greed (crypto)',
  'plan.fearGreedAria': 'Indice Fear and Greed du marché crypto (Alternative.me)',
  'plan.fearGreedLoading': 'Chargement de l’indice…',
  'plan.fearGreedUnavailable': 'Indice temporairement indisponible',
  'plan.fearGreedSource':
    'Donnée indicative Alternative.me — pas un signal de trading ; décisions sous votre responsabilité.',
  'plan.marketTitle': 'Market',
  'plan.marketHover':
    'Niveaux indicatifs près du dernier creux (achat) et du dernier sommet (vente) sur l’UT, hors ordres du plan.',
  'plan.limitTitle': 'Limit',
  'plan.limitHover': 'Entrée, TP1, stop SL et ratio RR du plan — à copier sur le carnet d’ordres.',
  'plan.pairLabel': 'Paire (perps HL)',
  'plan.pairAria': 'Choisir une paire Hyperliquid',

  'plan.levelsIvLabel': 'UT entrée / SL / TP',
  'plan.levelsIvAria':
    'Unité de temps des bougies pour calculer l’entrée de référence, le stop et les take profit',
  'plan.levelsIvTitle':
    'Les niveaux sont calculés à partir des swings et de l’ATR sur cette UT (même flux que la stratégie affichée).',

  'plan.syncLevelsSuggestedLabel':
    'Aligner l’UT entrée / SL / TP sur l’UT suggérée (synthèse MTF)',
  'plan.syncLevelsSuggestedAria':
    'Si activé, cette UT suit la recommandation multi‑TF ; la préférence est enregistrée localement. Sinon, utilisez le bouton pour appliquer une fois sans automatiser.',
  'plan.applySuggestedIvBtn': 'Appliquer {{label}}',

  'plan.liveStripTitle': 'Dernier cours ({{interval}} · flux Plan)',
  'plan.liveSrPrefix': 'Prix actif',
  'plan.liveSrUnavailable': ' indisponible',

  'plan.entryHintLimit':
    'Limite · {{low}} — {{high}} · {{coin}}',
  'plan.entryHintMarket': 'Entrée · {{coin}}',
  'plan.tpHint': 'Take profit · {{coin}}',
  'plan.slHint': 'SL · {{coin}}',

  'plan.execBuyLabel': 'Achat (limite)',
  'plan.execSellLabel': 'Vente (limite)',
  'plan.execBuyHint':
    'Prix limite d’achat suggéré : bas de range récent sur {{interval}} (indicatif, pas un conseil).',
  'plan.execSellHint':
    'Prix limite de vente suggéré : haut de range récent sur {{interval}}.',

  'plan.rrLabel': 'Multiplicateur TP',
  'plan.rrAria':
    'Objectif risque / récompense TP1 (nombre entier entre {{min}} et {{max}}) — multiplicateur sur la distance entrée → SL',
  'plan.rrTitle':
    'TP1 à environ {{rr}}× la distance entrée → SL (réf. close plan). Ajuste le multiplicateur de prise de bénéfice cible.',
  'plan.rrPillShifted':
    'RR réel aux niveaux copiés : {{actual}}× (entrée limite ≠ close réf.) · objectif {{target}}×',
  'plan.rrPillFlat': 'RR aux niveaux affichés : {{actual}}×',
  'plan.rrObjectiveShort': 'Objectif',
  'plan.rrEffectiveShort': 'Effectif',
  'plan.rrDecAria': 'Diminuer le multiplicateur TP d’une unité',
  'plan.rrIncAria': 'Augmenter le multiplicateur TP d’une unité',
  'plan.slMultLabel': 'Multiplicateur SL',
  'plan.slMultTitle':
    'Multiplie la distance entrée affichée → stop modèle (swing / ATR). 1,00× = stop calculé. Le TP1 suit le multiplicateur TP ci-dessus.',
  'plan.slMultAria':
    'Multiplicateur sur la distance stop modèle (nombre entier entre {{min}} et {{max}})',
  'plan.slMultDecAria': 'Diminuer le multiplicateur SL d’une unité',
  'plan.slMultIncAria': 'Augmenter le multiplicateur SL d’une unité',
  'plan.slPillTitle':
    'Risque vs stop modèle : {{actual}}× (objectif {{target}}×)',

  'plan.copyAll': 'Copier tout',
  'plan.copiedToast': 'Copié',

  'plan.biasMarketAria': 'Biais marché {{pair}}',
  'plan.biasSr': 'Biais · {{pair}}',
  'plan.trendReadoutEyebrow': 'Confluence MTF',
  'plan.actionBriefEyebrow': 'Synthèse',
  'plan.mtfDetailsToggle': 'Détails : qualité d’entrée, niveaux, ordres',
  'plan.mtfEssentialsEyebrow': 'Cadence UT',
  'plan.mtfRsiLabel': 'RSI {{n}}',
  'plan.rsiHeatOverbought': 'Surachat',
  'plan.rsiHeatOversold': 'Survente',
  'plan.rsiHeatNeutral': 'RSI neutre',
  'plan.mtfBiasLong': 'Biais haussier',
  'plan.mtfBiasShort': 'Biais baissier',
  'plan.mtfBiasClash': 'Signaux croisés',
  'plan.mtfBiasNeutral': 'Sans biais net',
  'plan.mtfLimitTrendTitle': 'Tendance du plan LIMIT',
  'plan.mtfLimitLong': 'LONG',
  'plan.mtfLimitShort': 'SHORT',

  'plan.longTermTitle': 'Investissement LT pur (mensuel)',
  'plan.longTermBuy': 'Zone achat (mensuel)',
  'plan.longTermSell': 'Zone vente (mensuel)',
  'plan.longTermLimitedHover': 'Historique mensuel court (moins de 20 mois).',
  'plan.longTermLimitedAria': 'Mode historique limité',
  'plan.longTermPerfLabel': 'Lisibilité structurelle mensuelle (indicatif)',
  'plan.longTermPerfAria': 'Score composite LT mensuel : {{score}} sur 100',
  'plan.longTermLoading': 'Chargement du journalier pour synthèse mensuelle…',
  'plan.longTermUnavailable':
    'Aucune bougie journalière exploitable pour reconstruire au moins un mois (flux HL vide ou paire indisponible).',
  'plan.longTermFeedError': 'Impossible de charger les bougies (erreur réseau ou API).',
  'plan.empty.candlesUnavailable': 'Bougies indisponibles',
  'plan.empty.loading': 'Chargement des bougies…',
  'plan.empty.shortHistoryTitle': 'Historique trop court',
  'plan.empty.historyShort':
    'Seulement {{have}}/60 bougies sur {{interval}} (flux Plan).',
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
  'bloc.rrTp1': 'Multiplicateur TP (~entrée affichée): {{rr}}×',
  'bloc.execBuy': 'Limite achat (UT): {{price}}$',
  'bloc.execSell': 'Limite vente (UT): {{price}}$',

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
  'scan.thUt': 'TF',
  'scan.thPlanSr': 'Plan',

  'scan.priceColTitle': 'Last scan close ({{interval}})',
  'scan.utColTitle': 'Suggested TF (multi‑TF synthesis; scan feed stays {{interval}})',
  'scan.scoreColTitle': 'Scanner qualitative summary (0–100)',
  'scan.scoreCellTitle':
    'Qualitative blend (confluence, multi‑TF alignment, bias, confirmation…), not a win probability.',

  'scan.planBtn': 'Plan',
  'scan.openPlanTitle': 'Open {{coin}} in Plan',

  'scan.emptyBody':
    'No opportunity ranks in the top {{softCap}} right now (TP1 RR, multi‑TF alignment, daily room…).',
  'scan.emptyHint':
    'No rows: confluence ≥ {{conf}} %, TP1 RR ≥ {{rr}}×, pyramid ≥ {{mtf}} TFs; top {{softCap}} shown.',

  'scan.filtersIntro':
    '{{interval}} candles on the top {{topPairs}} pairs by 24h volume. After confluence sort: up to {{mtfCheck}} candidates get multi‑TF checks. To list a row: confluence ≥ {{minConf}}%, TP1 RR ≥ {{minRr}}×, ≥ {{minMtf}} TFs aligned with direction, daily margin ≥ {{dailyRoom}}% vs the daily zone. At most {{softCap}} rows (conviction sort). Indicative sizing uses {{equity}} USD. Auto scan every {{autoMin}} min when enabled. Plan MTF synthesis: 5m through weekly (1m excluded).',

  'errors.clipboard':
    'Copy failed — allow clipboard access in your browser',

  'plan.title': 'Plan',
  'plan.downloadCard': 'Download card',
  'plan.downloadCardBusy': 'Exporting…',
  'plan.downloadCardAria':
    'Download a PNG of the plan card: Fear & Greed, pair, multi‑TF confluence, live price, LIMIT block.',
  'plan.downloadCardErr': 'Could not generate the image — try again.',
  'plan.fearGreedTitle': 'Fear & Greed (crypto)',
  'plan.fearGreedAria': 'Crypto Fear and Greed Index (Alternative.me)',
  'plan.fearGreedLoading': 'Loading index…',
  'plan.fearGreedUnavailable': 'Index temporarily unavailable',
  'plan.fearGreedSource':
    'Indicative data from Alternative.me — not a trade signal; you remain responsible for decisions.',
  'plan.marketTitle': 'Market',
  'plan.marketHover':
    'Indicative levels near latest swing low (buy) and swing high (sell) on the timeframe — not plan orders.',
  'plan.limitTitle': 'Limit',
  'plan.limitHover': 'Plan entry, TP1, stop SL and RR — copy to your order ticket.',
  'plan.pairLabel': 'Pair (HL perps)',
  'plan.pairAria': 'Choose a Hyperliquid pair',

  'plan.levelsIvLabel': 'Timeframe · entry / SL / TP',
  'plan.levelsIvAria':
    'Candle timeframe used to compute reference entry, stop loss and take-profit levels',
  'plan.levelsIvTitle':
    'Levels come from swings and ATR on this timeframe (same feed as the displayed strategy).',

  'plan.syncLevelsSuggestedLabel':
    'Match entry / SL / TP timeframe to suggested TF (MTF synthesis)',
  'plan.syncLevelsSuggestedAria':
    'When on, this timeframe follows the multi‑TF suggestion; preference is stored locally. When off, use the button to apply once without automation.',
  'plan.applySuggestedIvBtn': 'Apply {{label}}',

  'plan.liveStripTitle': 'Last price ({{interval}} · Plan feed)',
  'plan.liveSrPrefix': 'Live price',
  'plan.liveSrUnavailable': ' unavailable',

  'plan.entryHintLimit': 'Limit · {{low}} — {{high}} · {{coin}}',
  'plan.entryHintMarket': 'Entry · {{coin}}',
  'plan.tpHint': 'Take profit · {{coin}}',
  'plan.slHint': 'SL · {{coin}}',

  'plan.execBuyLabel': 'Buy (limit)',
  'plan.execSellLabel': 'Sell (limit)',
  'plan.execBuyHint':
    'Suggested limit buy: recent range low on {{interval}} (indicative, not advice).',
  'plan.execSellHint': 'Suggested limit sell: recent range high on {{interval}}.',

  'plan.rrLabel': 'TP multiplier',
  'plan.rrAria':
    'TP1 risk/reward target (whole number between {{min}} and {{max}}) — multiplier on entry→SL distance',
  'plan.rrTitle':
    'TP1 at ~{{rr}}× the entry→SL distance (plan close ref). Adjusts the take-profit distance multiplier.',
  'plan.rrPillShifted':
    'Effective RR at copied levels: {{actual}}× (limit entry ≠ plan close ref.) · target {{target}}×',
  'plan.rrPillFlat': 'RR at displayed levels: {{actual}}×',
  'plan.rrObjectiveShort': 'Target',
  'plan.rrEffectiveShort': 'Live',
  'plan.rrDecAria': 'Decrease TP multiplier by 1',
  'plan.rrIncAria': 'Increase TP multiplier by 1',
  'plan.slMultLabel': 'SL multiplier',
  'plan.slMultTitle':
    'Scales the displayed entry → model stop distance (swing / ATR). 1.00× = computed stop. TP1 follows the TP multiplier above.',
  'plan.slMultAria': 'Integer multiplier on model stop distance (between {{min}} and {{max}})',
  'plan.slMultDecAria': 'Decrease SL multiplier by 1',
  'plan.slMultIncAria': 'Increase SL multiplier by 1',
  'plan.slPillTitle': 'Risk vs model stop: {{actual}}× (target {{target}}×)',

  'plan.copyAll': 'Copy all',
  'plan.copiedToast': 'Copied',

  'plan.biasMarketAria': 'Market bias {{pair}}',
  'plan.biasSr': 'Bias · {{pair}}',
  'plan.trendReadoutEyebrow': 'MTF confluence',
  'plan.actionBriefEyebrow': 'Summary',
  'plan.mtfDetailsToggle': 'Details: entry quality, levels, orders',
  'plan.mtfEssentialsEyebrow': 'Execution TF',
  'plan.mtfRsiLabel': 'RSI {{n}}',
  'plan.rsiHeatOverbought': 'Overbought',
  'plan.rsiHeatOversold': 'Oversold',
  'plan.rsiHeatNeutral': 'RSI neutral',
  'plan.mtfBiasLong': 'Bullish bias',
  'plan.mtfBiasShort': 'Bearish bias',
  'plan.mtfBiasClash': 'Mixed signals',
  'plan.mtfBiasNeutral': 'No clear bias',
  'plan.mtfLimitTrendTitle': 'LIMIT plan bias',
  'plan.mtfLimitLong': 'LONG',
  'plan.mtfLimitShort': 'SHORT',

  'plan.longTermTitle': 'Pure long-term investing (monthly)',
  'plan.longTermBuy': 'Buy band (monthly)',
  'plan.longTermSell': 'Sell band (monthly)',
  'plan.longTermLimitedHover': 'Short monthly history (under 20 months).',
  'plan.longTermLimitedAria': 'Limited history mode',
  'plan.longTermPerfLabel': 'Monthly structural readability (indicative)',
  'plan.longTermPerfAria': 'Monthly LT composite score: {{score}} out of 100',
  'plan.longTermLoading': 'Loading daily candles for monthly rollup…',
  'plan.longTermUnavailable':
    'No usable daily candles to build at least one month (empty HL feed or pair unavailable).',
  'plan.longTermFeedError': 'Could not load candles (network or API error).',
  'plan.empty.candlesUnavailable': 'Candles unavailable',
  'plan.empty.loading': 'Loading candles…',
  'plan.empty.shortHistoryTitle': 'History too short',
  'plan.empty.historyShort':
    'Only {{have}}/60 candles on {{interval}} (Plan feed).',
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
  'bloc.rrTp1': 'TP multiplier (~displayed entry): {{rr}}×',
  'bloc.execBuy': 'Limit buy (TF): {{price}}$',
  'bloc.execSell': 'Limit sell (TF): {{price}}$',

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
