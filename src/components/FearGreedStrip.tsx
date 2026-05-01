import { useI18n } from '../i18n/useI18n'
import { fearGreedClassificationLabel, fearGreedZone } from '../lib/fearGreed'
import type { FearGreedSnapshot } from '../lib/fearGreed'

type Props = {
  snapshot: FearGreedSnapshot | null
  loading: boolean
  error: string | null
}

export function FearGreedStrip({ snapshot, loading, error }: Props) {
  const { locale, t } = useI18n()

  if (loading && !snapshot) {
    return (
      <div
        className="fear-greed-strip fear-greed-strip--loading"
        aria-label={t('plan.fearGreedAria')}
      >
        <span className="fear-greed-title">{t('plan.fearGreedTitle')}</span>
        <span className="fear-greed-muted">{t('plan.fearGreedLoading')}</span>
      </div>
    )
  }

  if (error && !snapshot) {
    return (
      <div
        className="fear-greed-strip fear-greed-strip--error"
        role="status"
        aria-label={t('plan.fearGreedAria')}
      >
        <span className="fear-greed-title">{t('plan.fearGreedTitle')}</span>
        <span className="fear-greed-muted" title={error}>
          {t('plan.fearGreedUnavailable')}
        </span>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div
        className="fear-greed-strip fear-greed-strip--error"
        role="status"
        aria-label={t('plan.fearGreedAria')}
      >
        <span className="fear-greed-title">{t('plan.fearGreedTitle')}</span>
        <span className="fear-greed-muted">{t('plan.fearGreedUnavailable')}</span>
      </div>
    )
  }

  const z = fearGreedZone(snapshot.value)
  const label = fearGreedClassificationLabel(snapshot.classificationEn, locale)

  return (
    <div
      className={`fear-greed-strip fear-greed-strip--z${z}`}
      aria-label={t('plan.fearGreedAria')}
    >
      <div className="fear-greed-compact">
        <div className="fear-greed-head">
          <span className="fear-greed-title">{t('plan.fearGreedTitle')}</span>
          <span className="fear-greed-value mono">{snapshot.value}</span>
          <span className="fear-greed-class">{label}</span>
        </div>
        <div className="fear-greed-meter" role="presentation">
          <div className="fear-greed-meter-track">
            <span
              className="fear-greed-meter-marker"
              style={{ left: `${Math.min(100, Math.max(0, snapshot.value))}%` }}
            />
          </div>
          <span className="fear-greed-meter-cap fear-greed-meter-cap--0">0</span>
          <span className="fear-greed-meter-cap fear-greed-meter-cap--100">100</span>
        </div>
      </div>
      <p className="sr-only">{t('plan.fearGreedSource')}</p>
    </div>
  )
}
