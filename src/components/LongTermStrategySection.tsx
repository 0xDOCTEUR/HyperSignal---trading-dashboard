import { useMemo } from 'react'
import { useHlCandles } from '../hooks/useHlCandles'
import { useI18n } from '../i18n/useI18n'
import { aggregateDailyCandlesToMonthlyOhlc } from '../lib/aggregateDailyToMonthly'
import {
  INVESTOR_LT_DAILY_FETCH_BARS,
  INVESTOR_LT_MIN_MONTHLY_CLOSES,
  computePureLongTermStrategy,
  formatLongTermZoneTitle,
} from '../lib/longTermStrategy'

function formatPlanPrice(n: number, nfLocale: string): string {
  const s = new Intl.NumberFormat(nfLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n)
  return `${s}$`
}

export function LongTermStrategySection(props: { coin: string; planReferencePrice?: number | null }) {
  const { coin, planReferencePrice } = props
  const { locale, t, nfLocale } = useI18n()
  const { candles, loading, error } = useHlCandles(coin, '1d', {
    maxBars: INVESTOR_LT_DAILY_FETCH_BARS,
  })

  const monthlyOhlc = useMemo(() => aggregateDailyCandlesToMonthlyOhlc(candles), [candles])

  const result = useMemo(() => {
    if (monthlyOhlc.closes.length < INVESTOR_LT_MIN_MONTHLY_CLOSES) return null
    return computePureLongTermStrategy(
      monthlyOhlc.highs,
      monthlyOhlc.lows,
      monthlyOhlc.closes,
      locale,
      planReferencePrice
    )
  }, [monthlyOhlc.highs, monthlyOhlc.lows, monthlyOhlc.closes, locale, planReferencePrice])

  const showInitialSpinner = loading && candles.length === 0
  const feedsSettled = !loading
  const showUnavailable = feedsSettled && !result

  return (
    <section className="plan-section plan-section--long-term" aria-labelledby="plan-long-term-title">
      <div className="plan-long-term-title-row">
        <h3 id="plan-long-term-title" className="plan-section-heading">
          {t('plan.longTermTitle')}
        </h3>
        {result?.mode === 'limited' ? (
          <span
            className="plan-long-term-limited-dot"
            title={t('plan.longTermLimitedHover')}
            aria-label={t('plan.longTermLimitedAria')}
            role="img"
          />
        ) : null}
      </div>

      {error ? (
        <p className="plan-long-term-status muted" role="status">
          {t('plan.longTermFeedError')}
        </p>
      ) : null}

      {showInitialSpinner ? (
        <p className="plan-long-term-status muted">{t('plan.longTermLoading')}</p>
      ) : null}

      {showUnavailable ? <p className="plan-long-term-status muted">{t('plan.longTermUnavailable')}</p> : null}

      {result ? (
        <div className="plan-long-term-body">
          <div className="plan-long-term-perf">
            <div className="plan-long-term-perf-head">
              <span className="plan-long-term-perf-label">{t('plan.longTermPerfLabel')}</span>
              <span className="plan-long-term-perf-score mono" aria-hidden>
                {result.performance.score0to100}/100
              </span>
            </div>
            <div
              className="plan-long-term-perf-bar"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={result.performance.score0to100}
              aria-label={t('plan.longTermPerfAria', { score: result.performance.score0to100 })}
            >
              <span
                className="plan-long-term-perf-fill"
                style={{ width: `${result.performance.score0to100}%` }}
              />
            </div>
          </div>

          <div className="plan-long-term-zones" role="list">
            <div
              role="listitem"
              className="lt-zone lt-zone--buy"
              title={formatLongTermZoneTitle(result.buyZone, locale)}
            >
              <div className="lt-zone-head">
                <span className="lt-zone-title">{t('plan.longTermBuy')}</span>
                <span className="lt-zone-coh mono">{result.buyZone.coherencePct}%</span>
              </div>
              <div className="lt-zone-range mono">
                {formatPlanPrice(result.buyZone.low, nfLocale)} &ndash;{' '}
                {formatPlanPrice(result.buyZone.high, nfLocale)}
              </div>
            </div>
            <div
              role="listitem"
              className="lt-zone lt-zone--sell"
              title={formatLongTermZoneTitle(result.sellZone, locale)}
            >
              <div className="lt-zone-head">
                <span className="lt-zone-title">{t('plan.longTermSell')}</span>
                <span className="lt-zone-coh mono">{result.sellZone.coherencePct}%</span>
              </div>
              <div className="lt-zone-range mono">
                {formatPlanPrice(result.sellZone.low, nfLocale)} &ndash;{' '}
                {formatPlanPrice(result.sellZone.high, nfLocale)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
