import { describe, expect, it } from 'vitest'
import { passesTradabilityMtfDailyChecks, type ScanCandidate } from './tradability'
import { mockPlanTfRowsPassingTradability } from './mockPlanTfRowsForScan'
import {
  barsWindowForDailyReturn,
  defaultDashboardTradabilityParams,
  evaluateDashboardOpportunityAtBar,
  walkForwardOpportunityHitRates,
} from './opportunityWalkForward'
import { MIN_SCAN_CONFLUENCE_PCT } from './scanMarket'
import type { ScanSignal } from './scanMarket'

function uptrendOHLC(bars: number) {
  const closes: number[] = []
  const highs: number[] = []
  const lows: number[] = []
  const vols: number[] = []
  let p = 80
  for (let i = 0; i < bars; i++) {
    const delta = 0.35 + (i % 5) * 0.03
    p += delta
    closes.push(p)
    highs.push(p + 0.18)
    lows.push(p - 0.12)
    vols.push(800 + i * 4)
  }
  return { closes, highs, lows, vols }
}

describe('passesTradabilityMtfDailyChecks', () => {
  it('rejette si alignement MTF insuffisant', () => {
    const rowsAlignedLong = mockPlanTfRowsPassingTradability('long', 100)
    const rowsWeakAlign = rowsAlignedLong.map((r, idx) =>
      idx < 6
        ? {
            ...r,
            bestVote: r.bestVote ? { ...r.bestVote, direction: 'short' as const } : null,
          }
        : r
    )
    const stubSignal = {
      coin: 'X',
      direction: 'long' as const,
      strategyId: 'trend_ema_macd' as const,
      strategyName: '',
      weighted: 1,
      regimeLabel: null,
      lastClose: 100,
      confirmed: true,
      regimeExplanation: null,
      strategyReasons: [],
      checks: { ema: true, rsi: true, macd: true, volume: true },
      validatedCount: 4,
      confluencePct: 100,
      roomToRunPct: null,
      rangePosition: null,
      relativeVsBtc: null,
      indicatorGauges: null,
      scanTrend: null,
      preferredTimeframe: null,
      mtfAlignedCount: 2,
    }
    const candidate: ScanCandidate = {
      signal: stubSignal as ScanSignal,
      closes: [100],
      highs: [100],
      lows: [100],
    }
    const params = defaultDashboardTradabilityParams()
    expect(passesTradabilityMtfDailyChecks(candidate, params, rowsWeakAlign)).toBe(false)
  })
})

describe('walkForwardOpportunityHitRates', () => {
  it('sur une série haussière longue, trouve au moins une fenêtre qualifiée et agrège les issues', () => {
    const { closes, highs, lows, vols } = uptrendOHLC(520)
    const agg = walkForwardOpportunityHitRates(
      { closes, highs, lows, vols },
      {
        coin: 'SYNTH',
        scanInterval: '4h',
        params: defaultDashboardTradabilityParams(),
        maxBarsForward: 40,
        stepBars: 2,
        minConfluencePct: MIN_SCAN_CONFLUENCE_PCT,
        btcRetWindow: null,
        sameBarPriority: 'stop_first',
      }
    )
    expect(agg.evaluatedWindows).toBeGreaterThan(10)
    expect(agg.qualifiedSamples).toBeGreaterThan(0)
    expect(
      agg.tp1First + agg.slFirst + agg.timeout
    ).toBe(agg.qualifiedSamples)
    expect(agg.empiricalTp1Rate).not.toBeNull()
    expect(agg.empiricalTp1Rate!).toBeGreaterThanOrEqual(0)
    expect(agg.empiricalTp1Rate!).toBeLessThanOrEqual(1)
  })
})

describe('evaluateDashboardOpportunityAtBar', () => {
  it('retourne null si confluence strictement impossible (seuil > 100 %)', () => {
    const { closes, highs, lows, vols } = uptrendOHLC(120)
    const n = 90
    const last = closes[n - 1]
    const plan = evaluateDashboardOpportunityAtBar({
      coin: 'SYNTH',
      closes: closes.slice(0, n),
      highs: highs.slice(0, n),
      lows: lows.slice(0, n),
      vols: vols.slice(0, n),
      btcRetWindow: null,
      barsWindow: barsWindowForDailyReturn('4h'),
      minConfluencePct: 101,
      params: defaultDashboardTradabilityParams(),
      planTfRows: mockPlanTfRowsPassingTradability('long', last),
    })
    expect(plan).toBeNull()
  })
})
