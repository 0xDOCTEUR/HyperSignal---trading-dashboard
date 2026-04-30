import { useCallback, useMemo, useState, useEffect } from 'react'
import { useHlCandles } from './hooks/useHlCandles'
import {
  useMarketScanner,
  SCAN_INTERVAL_MS,
  MIN_SCAN_CONFLUENCE_PCT,
  SCAN_TOP_PAIRS_BY_VOLUME,
  SCAN_MAX_MTFCHECK,
  SCAN_LISTED_SOFT_CAP,
} from './hooks/useMarketScanner'
import { type HlInterval } from './lib/interval'
import { PLAN_COMPARE_TF, usePlanMultiTf, type PlanTfRow } from './hooks/usePlanMultiTf'
import { atr, ema, lastNonNull } from './lib/indicators'
import {
  detectRegime,
  evaluateStrategies,
  type Regime,
  type StrategyId,
  type StrategyVote,
} from './lib/strategies'
import { buildTradePlan } from './lib/tradePlan'
import { fetchPerpUniverse } from './lib/hyperliquid'
import { hlOrderPriceString } from './lib/hlFormat'
import {
  buildMtfConfluenceStrip,
  buildTraderTfCards,
  consensusHeroFromStrip,
  tfShortTitle,
  traderSetupGlyph,
} from './lib/mtfSynthesis'
import {
  compareScanOpportunities,
  formatOpportunityRowTooltip,
  formatScanIntervalLabel,
  tradeConvictionScore,
} from './lib/scanMarket'
import {
  MIN_TRADE_RR,
  MIN_DAILY_ROOM_PCT,
  SCAN_MIN_MTF_ALIGNED,
  SCAN_MIN_RR_AT_TP1,
  type TradabilityScannerParams,
} from './lib/tradability'
import { useI18n } from './i18n/useI18n'
import { assetLabel, pairUiLabel, type ScannerAsset } from './lib/marketTypes'
import {
  AUTHOR_X_HANDLE,
  AUTHOR_X_URL,
  HL_REFERRAL_SIGNUP_URL,
  SITE_BRAND,
  TIP_WALLET_ROWS,
} from './siteConfig'
import { BrandPulseLogo } from './components/BrandPulseLogo'
import './App.css'

/** Grille unique pour flux bougies + niveaux SL/TP + scan Opportunités (fixe). */
const PLAN_EXECUTION_INTERVAL: HlInterval = '4h'

function deriveExecutionBias(args: {
  bestDirectionalRaw: StrategyVote | null
  best: StrategyVote | null
  multiTfRows: PlanTfRow[]
  regime: Regime | null
  close: number
  ema20: number | null
  ema50: number | null
}): { direction: 'long' | 'short'; strategyId: StrategyId } {
  const { bestDirectionalRaw, best, multiTfRows, regime, close, ema20, ema50 } = args
  const primary = bestDirectionalRaw ?? best
  if (primary && primary.direction !== 'flat') {
    return { direction: primary.direction, strategyId: primary.id }
  }

  let long = 0
  let short = 0
  for (const iv of PLAN_COMPARE_TF) {
    const r = multiTfRows.find((x) => x.interval === iv)
    if (!r || r.error) continue
    const d = r.bestVote?.direction ?? 'flat'
    if (d === 'long') long++
    else if (d === 'short') short++
  }
  if (long > short) return { direction: 'long', strategyId: 'trend_ema_macd' }
  if (short > long) return { direction: 'short', strategyId: 'trend_ema_macd' }

  if (regime?.label === 'tendance' && ema20 != null && ema50 != null) {
    if (ema20 > ema50 && close >= ema20 * 0.998) {
      return { direction: 'long', strategyId: 'trend_ema_macd' }
    }
    if (ema20 < ema50 && close <= ema20 * 1.002) {
      return { direction: 'short', strategyId: 'trend_ema_macd' }
    }
  }

  if (ema20 != null && close >= ema20) return { direction: 'long', strategyId: 'trend_ema_macd' }
  return { direction: 'short', strategyId: 'trend_ema_macd' }
}

/** Paramètres fixes du plan et du filtre « tradable » — non exposés dans l’UI. */
const PLAN_FALLBACK_EQUITY_USD = 10_000
const PLAN_RISK_PCT = 1
const PLAN_ATR_STOP_FLOOR_MULTIPLE = 2
const PLAN_SWING_LOOKBACK = 14
/** Plafond levier pour taille indicative et filtre opportunités — volontairement large pour rester réaliste sur HL. */
const PLAN_MAX_LEVERAGE_CEILING = 50

/** Persistance RR objectif TP1 (Plan + cohérence filtre opportunités). */
const PLAN_RR_LS_KEY = 'hl-signal-lab-plan-target-rr'
const PLAN_RR_MIN = 1
const PLAN_RR_MAX = 12

function clampPlanTargetRr(v: number): number {
  if (!Number.isFinite(v)) return MIN_TRADE_RR
  return Math.min(PLAN_RR_MAX, Math.max(PLAN_RR_MIN, Math.round(v * 100) / 100))
}

function readStoredPlanTargetRr(): number {
  try {
    const raw = localStorage.getItem(PLAN_RR_LS_KEY)
    if (raw == null || raw === '') return MIN_TRADE_RR
    return clampPlanTargetRr(parseFloat(raw))
  } catch {
    return MIN_TRADE_RR
  }
}

/** TP2 = objectif dérivé du RR TP1 (même règle qu’avant : max(rr1+0.5, 2.5)). */
function planTpR2MultipleFromTarget(rr1: number): number {
  return Math.max(rr1 + 0.5, 2.5)
}

function nfPriceDisp(n: number, nfLocale: string): string {
  const s = new Intl.NumberFormat(nfLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n)
  return `${s}$`
}

/** Affichage tableau Opportunités : décimales fixes par plage + tabular nums pour colonnes lisibles. */
function formatOpportunityTablePrice(n: number, nfLocale: string): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const x = Math.abs(n)
  let s: string
  if (x >= 1_000)
    s = new Intl.NumberFormat(nfLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(n)
  else if (x >= 100)
    s = new Intl.NumberFormat(nfLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(n)
  else if (x >= 1)
    s = new Intl.NumberFormat(nfLocale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
      useGrouping: false,
    }).format(n)
  else if (x >= 0.01)
    s = new Intl.NumberFormat(nfLocale, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
      useGrouping: false,
    }).format(n)
  else
    s = new Intl.NumberFormat(nfLocale, {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8,
      useGrouping: false,
    }).format(n)
  return `${s}$`
}

/** Volume notionnel 24h compact (méta HL). */
function compactUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} G$`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M$`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} k$`
  return `${n.toFixed(0)} $`
}

/** Filtre paires Plan : nom HL, libellé UI, suffixe après « : » (ex. xyz:XAU → « xau »). */
function assetMatchesPairFilter(a: ScannerAsset, qNorm: string): boolean {
  if (!qNorm) return true
  const label = assetLabel(a).toLowerCase()
  const name = a.name.toLowerCase()
  const suffixColon = name.includes(':') ? name.slice(name.indexOf(':') + 1) : ''
  return (
    name.includes(qNorm) ||
    label.includes(qNorm) ||
    (suffixColon.length > 0 && suffixColon.includes(qNorm))
  )
}

function normalizePairFilterQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function App() {
  const { locale, setLocale, t, nfLocale } = useI18n()

  const [perpAssets, setPerpAssets] = useState<ScannerAsset[]>([])
  const [perpErr, setPerpErr] = useState<string | null>(null)

  const [coin, setCoin] = useState('BTC')
  /** Intervalle uniquement pour le scan Opportunités (Plan exécution = 4h fixe). */
  const [copiedHint, setCopiedHint] = useState<string | null>(null)
  const [pairFilter, setPairFilter] = useState('')
  const [planTargetRr, setPlanTargetRr] = useState(readStoredPlanTargetRr)

  const flashCopied = useCallback((hint: string) => {
    setCopiedHint(hint)
    window.setTimeout(() => setCopiedHint(null), 1800)
  }, [])

  const copyLine = useCallback(
    async (text: string, hint: string) => {
      try {
        await navigator.clipboard.writeText(text)
        flashCopied(hint)
      } catch {
        flashCopied(t('errors.clipboard'))
      }
    },
    [flashCopied, t]
  )

  useEffect(() => {
    fetchPerpUniverse()
      .then(setPerpAssets)
      .catch((e: unknown) =>
        setPerpErr(e instanceof Error ? e.message : String(e))
      )
  }, [])

  useEffect(() => {
    if (perpAssets.length === 0) return
    if (!perpAssets.some((a) => a.name === coin)) {
      const fb = perpAssets.find((a) => a.name === 'BTC') ?? perpAssets[0]
      setCoin(fb.name)
    }
  }, [perpAssets, coin])

  const sortedPerps = useMemo(
    () => [...perpAssets].sort((a, b) => a.name.localeCompare(b.name)),
    [perpAssets]
  )

  const filteredPerpsForSelect = useMemo(() => {
    const q = normalizePairFilterQuery(pairFilter)
    if (!q) return sortedPerps
    return sortedPerps.filter((a) => assetMatchesPairFilter(a, q))
  }, [sortedPerps, pairFilter])

  /** Sélection toujours cohérente avec la liste filtrée (évite select HTML cassé si la paire courante est hors filtres). */
  useEffect(() => {
    if (filteredPerpsForSelect.length === 0) return
    if (!filteredPerpsForSelect.some((a) => a.name === coin)) {
      setCoin(filteredPerpsForSelect[0].name)
    }
  }, [filteredPerpsForSelect, coin])

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_RR_LS_KEY, String(planTargetRr))
    } catch {
      /* navigateur sans stockage */
    }
  }, [planTargetRr])

  const planTpR2Multiple = useMemo(
    () => planTpR2MultipleFromTarget(planTargetRr),
    [planTargetRr]
  )

  const scannerTradabilityParams = useMemo(
    (): TradabilityScannerParams => ({
      equityUsd: PLAN_FALLBACK_EQUITY_USD,
      riskPct: PLAN_RISK_PCT,
      atrStopFloorMultiple: PLAN_ATR_STOP_FLOOR_MULTIPLE,
      swingLookback: PLAN_SWING_LOOKBACK,
      tpRMultiple1: planTargetRr,
      tpRMultiple2: planTpR2Multiple,
      maxLeverage: PLAN_MAX_LEVERAGE_CEILING,
      minMtfAligned: SCAN_MIN_MTF_ALIGNED,
      minDailyRoomPct: MIN_DAILY_ROOM_PCT,
      minRrAtTp1: SCAN_MIN_RR_AT_TP1,
    }),
    [planTargetRr, planTpR2Multiple]
  )

  const scan = useMarketScanner(PLAN_EXECUTION_INTERVAL, perpAssets, scannerTradabilityParams, locale)

  const { rows: multiTfRows, loading: multiTfLoading } = usePlanMultiTf(coin, locale)

  const planTrendBiasKind = useMemo(() => {
    const strip = buildMtfConfluenceStrip(multiTfRows, locale)
    return consensusHeroFromStrip(strip).kind
  }, [multiTfRows, locale])

  const szDecForCoin =
    perpAssets.find((a) => a.name === coin)?.szDecimals ?? 5

  const { ohlc, loading, error, wsState, reload } = useHlCandles(coin, PLAN_EXECUTION_INTERVAL)

  const regime = useMemo(() => {
    if (ohlc.closes.length < 60) return null
    return detectRegime(ohlc.closes, ohlc.highs, ohlc.lows)
  }, [ohlc])

  const strategyEvaluation = useMemo(() => {
    if (ohlc.closes.length < 60 || regime == null) {
      return {
        best: null as StrategyVote | null,
        bestDirectionalRaw: null as StrategyVote | null,
      }
    }
    const ev = evaluateStrategies(ohlc.closes, ohlc.highs, ohlc.lows, regime)
    return {
      best: ev.best,
      bestDirectionalRaw: ev.bestDirectionalRaw,
    }
  }, [ohlc, regime])

  const { best, bestDirectionalRaw } = strategyEvaluation

  const lastClose = ohlc.last?.c
  const atrSeries = useMemo(
    () => atr(ohlc.highs, ohlc.lows, ohlc.closes, 14),
    [ohlc]
  )
  const atrNow = lastNonNull(atrSeries)
  const ema20Now = lastNonNull(ema(ohlc.closes, 20))
  const ema50Now = lastNonNull(ema(ohlc.closes, 50))

  const executionBias = useMemo(
    () =>
      deriveExecutionBias({
        bestDirectionalRaw,
        best,
        multiTfRows,
        regime,
        close: ohlc.closes.length > 0 ? ohlc.closes[ohlc.closes.length - 1]! : 0,
        ema20: ema20Now,
        ema50: ema50Now,
      }),
    [
      bestDirectionalRaw,
      best,
      multiTfRows,
      regime,
      ohlc.closes,
      ema20Now,
      ema50Now,
    ]
  )

  const tradePlan = useMemo(() => {
    if (
      atrNow == null ||
      !(atrNow > 0) ||
      ohlc.closes.length < 60 ||
      regime == null ||
      ema20Now == null
    )
      return null
    const { direction, strategyId } = executionBias
    return buildTradePlan({
      closes: ohlc.closes,
      highs: ohlc.highs,
      lows: ohlc.lows,
      atr: atrNow,
      ema20: ema20Now,
      direction,
      strategyId,
      regime,
      equityUsd: PLAN_FALLBACK_EQUITY_USD,
      riskPct: PLAN_RISK_PCT,
      atrStopFloorMultiple: PLAN_ATR_STOP_FLOOR_MULTIPLE,
      swingLookback: PLAN_SWING_LOOKBACK,
      tpRMultiple1: planTargetRr,
      tpRMultiple2: planTpR2Multiple,
      maxLeverage: PLAN_MAX_LEVERAGE_CEILING,
      locale,
    })
  }, [executionBias, atrNow, ohlc, ema20Now, regime, planTargetRr, planTpR2Multiple, locale])

  type PlanEmptyCopy = { title: string | null; body: string }

  const planEmptyCopy = useMemo((): PlanEmptyCopy | null => {
    const planIvLabel = formatScanIntervalLabel(locale, PLAN_EXECUTION_INTERVAL)
    if (tradePlan != null) return null
    if (error) {
      return {
        title: t('plan.empty.candlesUnavailable'),
        body: error,
      }
    }
    if (loading && ohlc.closes.length === 0) {
      return { title: null, body: t('plan.empty.loading') }
    }
    if (ohlc.closes.length < 60) {
      return {
        title: t('plan.empty.shortHistoryTitle'),
        body: t('plan.empty.historyShort', {
          have: ohlc.closes.length,
          interval: planIvLabel,
        }),
      }
    }
    if (regime == null) {
      return {
        title: t('plan.empty.regimeUnavailable'),
        body: t('plan.empty.regimeUnavailableBody'),
      }
    }
    if (atrNow == null || !(atrNow > 0)) {
      return {
        title: t('plan.empty.atrInsufficient'),
        body: t('plan.empty.atrInsufficientBody'),
      }
    }
    return {
      title: t('plan.empty.planFailed'),
      body: t('plan.empty.planFailedBody'),
    }
  }, [
    tradePlan,
    error,
    loading,
    ohlc.closes.length,
    regime,
    atrNow,
    locale,
    t,
  ])

  const planExecutionLevels = useMemo(() => {
    if (!tradePlan) return null
    const entryDisplay =
      tradePlan.limitZone != null
        ? (tradePlan.limitZone.low + tradePlan.limitZone.high) / 2
        : tradePlan.entry
    const delta = entryDisplay - tradePlan.entry
    const eps = Math.max(Math.abs(tradePlan.entry) * 1e-10, 1e-14)
    const stopLossDisplay = tradePlan.stopLoss + delta
    const tp1Display = tradePlan.takeProfit1 + delta
    const riskPx = Math.abs(entryDisplay - stopLossDisplay)
    const rewardPx = Math.abs(tp1Display - entryDisplay)
    const minRisk =
      Math.max(Math.abs(entryDisplay) * 1e-12, 1e-14)
    const rrAtTp1 =
      riskPx > minRisk ? rewardPx / riskPx : tradePlan.rrAtTp1

    return {
      entryDisplay,
      stopLossDisplay,
      tp1Display,
      rrAtTp1,
      planCloseRef: tradePlan.entry,
      levelsShifted: Math.abs(delta) > eps,
    }
  }, [tradePlan])

  const blocComplet = useMemo(() => {
    if (!tradePlan || !planExecutionLevels) return ''
    const lim = hlOrderPriceString(planExecutionLevels.entryDisplay, szDecForCoin, false)
    const SL = hlOrderPriceString(planExecutionLevels.stopLossDisplay, szDecForCoin, false)
    const TP = hlOrderPriceString(planExecutionLevels.tp1Display, szDecForCoin, false)
    const pairLbl = pairUiLabel(perpAssets, coin)
    const ivLbl = formatScanIntervalLabel(locale, PLAN_EXECUTION_INTERVAL)
    const lines: string[] = [
      t('bloc.pairDirection', { pair: pairLbl, dir: tradePlan.direction.toUpperCase() }),
    ]
    if (lastClose != null && lastClose > 0) {
      lines.push(
        t('bloc.lastPrice', {
          interval: ivLbl,
          price: `${hlOrderPriceString(lastClose, szDecForCoin, false)}$`,
        })
      )
    }
    lines.push(
      t('bloc.planCloseRef', {
        price: `${hlOrderPriceString(tradePlan.entry, szDecForCoin, false)}$`,
      })
    )
    const entryPasteLabel = tradePlan.limitZone != null ? 'LIMIT PRICE' : 'ENTRY'
    lines.push(`${entryPasteLabel}: ${lim}$`)
    lines.push(`SL: ${SL}$`)
    lines.push(`TP: ${TP}$`)
    lines.push(
      t('bloc.rrTp1', {
        rr: planExecutionLevels.rrAtTp1.toFixed(2),
      })
    )
    return lines.join('\n')
  }, [
    tradePlan,
    planExecutionLevels,
    coin,
    perpAssets,
    szDecForCoin,
    lastClose,
    locale,
    t,
  ])

  const tableSignals = useMemo(
    () => [...scan.signals].sort(compareScanOpportunities),
    [scan.signals]
  )

  const planFeedLabel = formatScanIntervalLabel(locale, PLAN_EXECUTION_INTERVAL)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-logo">
            <BrandPulseLogo />
          </div>
          <h1 className="brand-wordmark">{SITE_BRAND}</h1>
        </div>

        <div className="topbar-controls">
          <button type="button" className="btn-go" onClick={() => void reload()} disabled={loading}>
            {t('nav.refresh')}
          </button>
          <div className="lang-toggle" role="group" aria-label={t('nav.langGroupAria')}>
            <button
              type="button"
              className={`lang-btn${locale === 'fr' ? ' lang-btn--active' : ''}`}
              onClick={() => setLocale('fr')}
              aria-pressed={locale === 'fr'}
            >
              {t('nav.langFr')}
            </button>
            <button
              type="button"
              className={`lang-btn${locale === 'en' ? ' lang-btn--active' : ''}`}
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
            >
              {t('nav.langEn')}
            </button>
          </div>
          <span className={`live-pill ${wsState === 'live' ? 'live-pill-on' : ''}`}>
            {wsState === 'live' ? t('live.live') : t('live.wait')}
          </span>
        </div>
      </header>

      <section className="card-scan" aria-label={t('scan.cardAria')}>
        <div className="scan-head-row">
          <h2 className="scan-title">{t('scan.title')}</h2>
        </div>
        {perpErr ? <div className="banner-err banner-compact">{perpErr}</div> : null}

        <p className="sr-only">
          {t('scan.srIntro', {
            interval: planFeedLabel,
            topPairs: SCAN_TOP_PAIRS_BY_VOLUME.toLocaleString(nfLocale),
            mtfCheck: SCAN_MAX_MTFCHECK.toLocaleString(nfLocale),
            softCap: SCAN_LISTED_SOFT_CAP.toLocaleString(nfLocale),
            planIv: planFeedLabel,
            minConf: MIN_SCAN_CONFLUENCE_PCT,
            minRr: SCAN_MIN_RR_AT_TP1,
            minMtf: SCAN_MIN_MTF_ALIGNED,
            equity: PLAN_FALLBACK_EQUITY_USD.toLocaleString(nfLocale),
            autoMin: Math.round(SCAN_INTERVAL_MS / 60_000),
          })}
        </p>

        <div className="scan-toolbar scan-toolbar-inline">
          <button
            type="button"
            className="btn-go btn-scan"
            disabled={scan.scanning || scan.scanCoins.length === 0}
            onClick={() => void scan.runScan()}
          >
            {scan.scanning ? t('nav.scanning') : t('nav.scan')}
          </button>
          <label className="auto-scan">
            <input
              type="checkbox"
              checked={scan.autoScan}
              onChange={(e) => scan.setAutoScan(e.target.checked)}
            />
            {t('nav.autoScan', { minutes: Math.round(SCAN_INTERVAL_MS / 60_000) })}
          </label>
        </div>

        {scan.scanning && scan.scanProgress ? (
          <p className="muted small scan-progress-hint" aria-live="polite">
            {scan.scanProgress.phase === 'candles'
              ? t('scan.progressCandles', {
                  done: scan.scanProgress.done.toLocaleString(nfLocale),
                  total: scan.scanProgress.total.toLocaleString(nfLocale),
                })
              : t('scan.progressTradability', {
                  done: scan.scanProgress.done.toLocaleString(nfLocale),
                  total: scan.scanProgress.total.toLocaleString(nfLocale),
                })}
          </p>
        ) : null}

        {scan.scanErr ? <div className="banner-soft">{scan.scanErr}</div> : null}

        {tableSignals.length > 0 ? (
          <>
            <div className="scan-table-wrap scan-table-wrap-tight scan-table-wrap--opps">
              <table className="scan-table scan-table-strategies scan-table-opportunities scan-table-opps-lite">
                <thead>
                  <tr>
                    <th className="scan-col-rank mono" scope="col">
                      {t('scan.thRank')}
                    </th>
                    <th className="scan-col-pair" scope="col">
                      {t('scan.thPair')}
                    </th>
                    <th className="scan-col-setup" scope="col">
                      {t('scan.thSide')}
                    </th>
                    <th
                      className="scan-col-price mono"
                      scope="col"
                      title={t('scan.priceColTitle', { interval: planFeedLabel })}
                    >
                      {t('scan.thPrice')}
                    </th>
                    <th
                      className="scan-col-score mono"
                      scope="col"
                      title={t('scan.scoreColTitle')}
                    >
                      {t('scan.thScore')}
                    </th>
                    <th className="scan-col-btc" scope="col">
                      {t('scan.thBtc')}
                    </th>
                    <th className="scan-col-plan-btn" scope="col">
                      <span className="sr-only">{t('scan.thPlanSr')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableSignals.map((s, i) => {
                    const score = tradeConvictionScore(s)
                    const vol = scan.assetMap.get(s.coin)?.dayNtlVlm
                    const rowTitle = formatOpportunityRowTooltip(s, PLAN_EXECUTION_INTERVAL, locale)
                    const btcKind = s.relativeVsBtc ?? 'na'
                    const scoreTier = score >= 72 ? 'hi' : score >= 56 ? 'mid' : 'low'
                    return (
                      <tr key={`${s.coin}-${s.strategyId}-${i}`} title={rowTitle}>
                        <td className="mono opp-rank-cell">{i + 1}</td>
                        <td className="scan-col-pair opp-pair-inline-cell">
                          <span className="opp-pair-name">{pairUiLabel(perpAssets, s.coin)}</span>
                          {vol != null && vol > 0 ? (
                            <>
                              <span className="opp-pair-sep muted" aria-hidden>
                                {' · '}
                              </span>
                              <span className="opp-pair-vol-inline muted">{compactUsd(vol)}</span>
                            </>
                          ) : null}
                        </td>
                        <td className="scan-cell-setup opp-setup-badge-only">
                          <span className={`scan-setup-badge scan-setup-badge--${s.direction}`}>
                            {s.direction === 'long' ? 'LONG' : 'SHORT'}
                          </span>
                        </td>
                        <td className="mono scan-col-price opp-price-cell">
                          {formatOpportunityTablePrice(s.lastClose, nfLocale)}
                        </td>
                        <td className="mono scan-col-score opp-score-cell">
                          <span
                            className={`opp-score-val opp-score-val--${scoreTier}`}
                            title={t('scan.scoreCellTitle')}
                          >
                            {score}
                          </span>
                        </td>
                        <td className="scan-col-btc">
                          <span className={`opp-btc-tag opp-btc-tag--${btcKind}`}>
                            {!s.relativeVsBtc
                              ? '—'
                              : s.relativeVsBtc === 'outperform'
                                ? t('btc.outperform')
                                : s.relativeVsBtc === 'underperform'
                                  ? t('btc.underperform')
                                  : t('btc.inline')}
                          </span>
                        </td>
                        <td className="scan-col-plan-btn">
                          <button
                            type="button"
                            className="btn-table btn-table--plan"
                            onClick={() => setCoin(s.coin)}
                            title={t('scan.openPlanTitle', { coin: s.coin })}
                          >
                            {t('scan.planBtn')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : scan.lastScanAt != null ? (
          <p
            className="scan-empty-vis muted"
            title={t('scan.emptyHint', {
              conf: MIN_SCAN_CONFLUENCE_PCT,
              rr: SCAN_MIN_RR_AT_TP1,
              mtf: SCAN_MIN_MTF_ALIGNED,
            })}
          >
            {t('scan.emptyBody')}
          </p>
        ) : null}
      </section>

      {error ? <div className="banner-err">{error}</div> : null}

      <main className="card-plan card-plan--signal">
        <div className="plan-head-inline plan-head-inline--vis">
          <h2 className="plan-card-title neon-brand">{t('plan.title')}</h2>
        </div>

        <div className="plan-pair-picker plan-pair-picker--neon">
          <label className="plan-field" htmlFor="plan-pair-filter-inp">
            {t('plan.filterLabel')}
            <input
              id="plan-pair-filter-inp"
              type="search"
              className="inp inp-block plan-pair-filter"
              placeholder={t('plan.filterPlaceholder')}
              value={pairFilter}
              onChange={(e) => setPairFilter(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={t('plan.filterAria')}
            />
          </label>
          <label className="plan-field plan-field-grow">
            {t('plan.pairLabel')}
            <select
              className="inp inp-block plan-pair-select"
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
              aria-label={t('plan.pairAria')}
            >
              {filteredPerpsForSelect.length === 0 ? (
                <option value={coin}>{coin}</option>
              ) : (
                filteredPerpsForSelect.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                    {a.dayNtlVlm > 0
                      ? ` · vol ${compactUsd(a.dayNtlVlm)}`
                      : ''}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {sortedPerps.length > 0 && filteredPerpsForSelect.length === 0 ? (
          <p className="muted small plan-picker-hint">{t('plan.noPairMatch')}</p>
        ) : null}

        <div className={`plan-trend-wrap plan-trend-wrap--bias-${planTrendBiasKind}`}>
          <SelectedPairAnalysisPanel
            pairLabel={pairUiLabel(perpAssets, coin)}
            multiTfRows={multiTfRows}
            multiTfLoading={multiTfLoading}
          />
        </div>

        <div
          className={`plan-live-strip mono${lastClose != null && lastClose > 0 ? '' : ' plan-live-strip--wait'}`}
          title={t('plan.liveStripTitle')}
        >
          <span className="sr-only">
            {t('plan.liveSrPrefix')}
            {lastClose != null && lastClose > 0
              ? ` ${nfPriceDisp(lastClose, nfLocale)}`
              : t('plan.liveSrUnavailable')}
          </span>
          <span className="plan-live-strip-price" aria-hidden>
            {lastClose != null && lastClose > 0 ? nfPriceDisp(lastClose, nfLocale) : '—'}
          </span>
        </div>

        {tradePlan && planExecutionLevels ? (
          <>
            <div className="copy-rows">
              <CopyRow
                label={tradePlan.limitZone != null ? 'LIMIT PRICE' : 'ENTRY'}
                hint={
                  tradePlan.limitZone != null
                    ? t('plan.entryHintLimit', {
                        low: nfPriceDisp(tradePlan.limitZone.low, nfLocale),
                        high: nfPriceDisp(tradePlan.limitZone.high, nfLocale),
                        coin,
                      })
                    : t('plan.entryHintMarket', { coin })
                }
                display={nfPriceDisp(planExecutionLevels.entryDisplay, nfLocale)}
                paste={hlOrderPriceString(planExecutionLevels.entryDisplay, szDecForCoin, false)}
                onCopy={copyLine}
              />
              <CopyRow
                label="TP"
                hint={t('plan.tpHint', { coin })}
                display={nfPriceDisp(planExecutionLevels.tp1Display, nfLocale)}
                paste={hlOrderPriceString(planExecutionLevels.tp1Display, szDecForCoin, false)}
                onCopy={copyLine}
              />
              <CopyRow
                label="SL"
                hint={t('plan.slHint', { coin })}
                display={nfPriceDisp(planExecutionLevels.stopLossDisplay, nfLocale)}
                paste={hlOrderPriceString(planExecutionLevels.stopLossDisplay, szDecForCoin, false)}
                onCopy={copyLine}
              />
            </div>

            <div className="plan-rr-row plan-rr-row--config">
              <label className="plan-rr-field">
                <span className="plan-rr-field-label">{t('plan.rrLabel')}</span>
                <input
                  type="number"
                  className="inp plan-rr-input"
                  min={PLAN_RR_MIN}
                  max={PLAN_RR_MAX}
                  step={0.25}
                  value={planTargetRr}
                  onChange={(e) => {
                    const x = parseFloat(e.target.value)
                    if (Number.isFinite(x)) setPlanTargetRr(clampPlanTargetRr(x))
                  }}
                  aria-label={t('plan.rrAria', { min: PLAN_RR_MIN, max: PLAN_RR_MAX })}
                  title={t('plan.rrTitle', { rr: planTargetRr })}
                />
              </label>
              <span
                className={`plan-rr-pill${planExecutionLevels.levelsShifted ? ' plan-rr-pill--shift' : ''}`}
                title={
                  planExecutionLevels.levelsShifted
                    ? t('plan.rrPillShifted', {
                        actual: planExecutionLevels.rrAtTp1.toFixed(2),
                        target: planTargetRr,
                      })
                    : t('plan.rrPillFlat', {
                        actual: planExecutionLevels.rrAtTp1.toFixed(2),
                      })
                }
              >
                {planExecutionLevels.rrAtTp1.toFixed(2)}×
              </span>
            </div>

            <button
              type="button"
              className="btn-copy-all"
              onClick={() => void copyLine(blocComplet, t('plan.copiedToast'))}
            >
              {t('plan.copyAll')}
            </button>

            {tradePlan.warnings.length > 0 ? (
              <div
                className="plan-warn-vis"
                title={tradePlan.warnings.join('\n')}
                role="note"
              >
                <span className="plan-warn-glyph" aria-hidden>
                  !
                </span>
                <span className="sr-only">{tradePlan.warnings.join(' · ')}</span>
              </div>
            ) : null}
          </>
        ) : planEmptyCopy ? (
          <div className="empty-plan muted small">
            {planEmptyCopy.title ? (
              <p className="empty-title">{planEmptyCopy.title}</p>
            ) : null}
            <p className="empty-sub">{planEmptyCopy.body}</p>
          </div>
        ) : null}
      </main>

      <footer className="support-footer" aria-label={t('footer.supportAria')}>
        <div className="support-grid">
          <div className="support-card">
            <h2 className="support-card-title">{t('footer.hlTitle')}</h2>
            <p className="muted support-card-lead">{t('footer.hlLead')}</p>
            <a
              className="btn-go"
              href={HL_REFERRAL_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('footer.hlCta')}
            </a>
          </div>
          <div className="support-card">
            <h2 className="support-card-title">{t('footer.xTitle')}</h2>
            <p className="muted support-card-lead">{t('footer.xLead')}</p>
            <a className="btn-go" href={AUTHOR_X_URL} target="_blank" rel="noopener noreferrer">
              {t('footer.xCta', { handle: AUTHOR_X_HANDLE })}
            </a>
          </div>
          <div className="support-card support-card--tips">
            <h2 className="support-card-title">{t('footer.tipsTitle')}</h2>
            <p className="muted support-card-lead">{t('footer.tipsLead')}</p>
            <div className="support-tip-rows">
              {TIP_WALLET_ROWS.map((row) => {
                const tipLabel =
                  row.label === 'ETH / EVM'
                    ? t('tips.eth')
                    : row.label === 'Solana'
                      ? t('tips.sol')
                      : row.label
                return (
                  <CopyRow
                    key={row.label}
                    label={tipLabel}
                    display={row.address}
                    paste={row.address}
                    hint={t('tips.rowCopied', { label: tipLabel })}
                    onCopy={copyLine}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </footer>

      {copiedHint ? <div className="toast">{copiedHint}</div> : null}
    </div>
  )
}

function SelectedPairAnalysisPanel(props: {
  pairLabel: string
  multiTfRows: PlanTfRow[]
  multiTfLoading: boolean
}) {
  const { pairLabel, multiTfRows, multiTfLoading } = props
  const { locale, t } = useI18n()

  const strip = useMemo(
    () => buildMtfConfluenceStrip(multiTfRows, locale),
    [multiTfRows, locale]
  )
  const traderCards = useMemo(
    () => buildTraderTfCards(multiTfRows, locale),
    [multiTfRows, locale]
  )

  const consensusHero = useMemo(() => consensusHeroFromStrip(strip), [strip])

  return (
    <section
      className="plan-deep-analysis plan-deep-analysis--visual plan-trend-panel"
      aria-label={t('plan.biasMarketAria', { pair: pairLabel })}
    >
      <h3 className="sr-only">{t('plan.biasSr', { pair: pairLabel })}</h3>

      {multiTfLoading ? (
        <div className="bias-mtf-stack bias-mtf-stack--loading" aria-hidden>
          <div className="bias-meter-bar bias-meter-bar--grid">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="bias-skel-meter-seg" />
            ))}
          </div>
          <div className="bias-tf-under-bar">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bias-tf-under-col">
                <span className="bias-skel-pill" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bias-mtf-stack">
          <div className="plan-trend-readout">
            <div className="plan-selected-trend-head">
              <div
                className={`consensus-hero consensus-hero--${consensusHero.kind}`}
                aria-hidden
                title={strip.summaryLine}
              >
                {consensusHero.glyph}
              </div>
              <div className="plan-selected-trend-copy">
                <span className="plan-selected-trend-eyebrow">{t('plan.trendReadoutEyebrow')}</span>
                <p className="plan-selected-trend-summary">{strip.summaryLine}</p>
              </div>
            </div>
            <div
              className="bias-meter-bar bias-meter-bar--grid plan-trend-readout-meter"
              role="presentation"
              aria-hidden
              title={strip.summaryLine}
            >
            {strip.slots.map((slot) => (
              <div
                key={slot.interval}
                className={`bias-meter-seg bias-meter-seg--${slot.setup}`}
                title={tfShortTitle(slot.interval)}
              />
            ))}
          </div>
          </div>
          <div className="bias-tf-under-bar" role="list">
            {traderCards.map((card) => (
              <div key={card.interval} role="listitem" className="bias-tf-under-col">
                <div
                  className={`bias-tf-pill bias-tf-pill--${card.setup}`}
                  title={`${card.shortTitle}: ${card.tagline} ${card.chips.join(', ')}`}
                >
                  <span className="bias-tf-pill-tf">{card.shortTitle}</span>
                  <span className="bias-tf-pill-glyph" aria-hidden>
                    {traderSetupGlyph(card.setup)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function CopyRow(props: {
  label: string
  display: string
  paste: string
  hint: string
  onCopy: (text: string, hint: string) => void
}) {
  const { label, display, paste, hint, onCopy } = props
  const { t } = useI18n()
  return (
    <div className="copy-row">
      <div className="copy-row-head">
        <span className="copy-label">{label}</span>
        <button
          type="button"
          className="btn-copy"
          onClick={() => onCopy(paste, hint)}
          aria-label={t('copy.aria', { label })}
        >
          {t('copy.label')}
        </button>
      </div>
      <div className="copy-value" tabIndex={0}>
        {display}
      </div>
    </div>
  )
}

export default App
