import type { PlanTfRow } from '../hooks/usePlanMultiTf'
import type { Locale } from '../i18n/locale'
import { MTF_SYNTHESIS_TF_ORDER, type HlInterval } from './interval'

/** Ordre affichage synthèse trader (court → large) — aligné sur {@link MTF_SYNTHESIS_TF_ORDER}. */
export const TRADER_TF_ORDER: readonly HlInterval[] = MTF_SYNTHESIS_TF_ORDER

export function tfShortTitle(iv: HlInterval): string {
  if (iv === '1d') return 'Daily'
  if (iv === '1w') return 'Weekly'
  if (iv === '4h') return '4h'
  if (iv === '1h') return '1h'
  if (iv === '15m') return '15m'
  if (iv === '5m') return '5m'
  if (iv === '1m') return '1m'
  return iv
}

/** Zone RSI « trading » simple (surachat / survente). */
export type RsiHeatZone = 'overbought' | 'oversold' | 'neutral'

export function rsiHeatZone(rsi: number | null): RsiHeatZone {
  if (rsi == null || !Number.isFinite(rsi)) return 'neutral'
  if (rsi >= 70) return 'overbought'
  if (rsi <= 30) return 'oversold'
  return 'neutral'
}

export type TraderSetup = 'long' | 'short' | 'neutral'

/** Pastille sous chaque UT : hausse / baisse / pas de direction nette (pas un simple point). */
export function traderSetupGlyph(setup: TraderSetup): string {
  if (setup === 'long') return '↑'
  if (setup === 'short') return '↓'
  return '↔'
}

export interface TraderTfCard {
  interval: HlInterval
  shortTitle: string
  setup: TraderSetup
  /** Affichage pill : LONG / SHORT / NEUTRE */
  setupLabel: string
  /** Une ligne courte, vocabulaire simple (pas de jargon). */
  tagline: string
  /** 2–3 libellés très courts pour pastilles visuelles */
  chips: string[]
}

/** Pour la barre de confluence en tête de Plan. */
export interface MtfConfluenceStrip {
  slots: { interval: HlInterval; setup: TraderSetup }[]
  longCount: number
  shortCount: number
  neutralCount: number
  /** Texte court : situation globale */
  summaryLine: string
}

/** Synthèse globale pour UI 100 % visuelle (glyph + classe CSS). */
export type ConsensusHeroKind =
  | 'long-strong'
  | 'short-strong'
  | 'long-lean'
  | 'short-lean'
  | 'clash'
  | 'neutral'

/**
 * Direction affichée bandeau / pastilles MTF : **stratégie confirmée** d’abord, puis structure EMA+prix.
 * (Évite de faire dire « haussier » à un RSI contre-tendance faible quand les moyennes ne sont pas alignées.)
 */
export function planTfRowStripSetup(r: PlanTfRow): TraderSetup {
  if (r.error) return 'neutral'

  const d = r.bestVote?.direction ?? 'flat'
  if (d === 'long') return 'long'
  if (d === 'short') return 'short'

  /** Aucun signal confirmé : biais visuel EMA20/50 + dernier close (aligné lecture « tendance » manuelle). */
  const c = r.lastClose
  const e20 = r.ema20
  const e50 = r.ema50
  if (c != null && e20 != null && e50 != null && c > 0) {
    if (c >= e20 && e20 >= e50) return 'long'
    if (c <= e20 && e20 <= e50) return 'short'
  }

  return 'neutral'
}

function setupToLabel(s: TraderSetup, locale: Locale): string {
  if (s === 'long') return 'LONG'
  if (s === 'short') return 'SHORT'
  return locale === 'en' ? 'NEUTRAL' : 'NEUTRE'
}

/** Régime en mots simples (affichage pastille). */
function regimeChip(r: PlanTfRow, locale: Locale): string | null {
  const raw = r.regime?.label
  if (!raw) return null
  if (locale === 'en') {
    if (raw === 'tendance') return 'Trending'
    if (raw === 'range') return 'Range'
    if (raw === 'volatile') return 'Strong swings'
    return null
  }
  if (raw === 'tendance') return 'Tendance'
  if (raw === 'range') return 'Range'
  if (raw === 'volatile') return 'Mouvements forts'
  return null
}

function volChip(atrPct: number | null, locale: Locale): string | null {
  if (atrPct == null) return null
  if (locale === 'en') {
    if (atrPct < 0.12) return 'Quiet'
    if (atrPct > 0.45) return 'Very active'
    return 'Active'
  }
  if (atrPct < 0.12) return 'Calme'
  if (atrPct > 0.45) return 'Très actif'
  return 'Actif'
}

/** Une ligne lisible sans jargon. */
function simpleTagline(setup: TraderSetup, r: PlanTfRow, locale: Locale): string {
  const regime = r.regime?.label
  if (locale === 'en') {
    if (setup === 'long') {
      if (regime === 'tendance') return 'Buys favored.'
      if (regime === 'volatile') return 'Buys favored; price moving fast.'
      if (regime === 'range') return 'Buys slightly favored; sideways tape.'
      return 'Buys slightly favored.'
    }
    if (setup === 'short') {
      if (regime === 'tendance') return 'Sells favored.'
      if (regime === 'volatile') return 'Sells favored; price moving fast.'
      if (regime === 'range') return 'Sells slightly favored; sideways tape.'
      return 'Sells slightly favored.'
    }
    if (regime === 'range') return 'No clear direction; range-bound.'
    if (regime === 'volatile') return 'No clear direction; lots of chop.'
    return 'No clear direction.'
  }
  if (setup === 'long') {
    if (regime === 'tendance') return 'Les achats sont favoris.'
    if (regime === 'volatile') return 'Les achats sont favoris ; prix bouge vite.'
    if (regime === 'range') return 'Les achats sont un peu favoris ; cours latéral.'
    return 'Les achats sont un peu favoris.'
  }
  if (setup === 'short') {
    if (regime === 'tendance') return 'Les ventes sont favoris.'
    if (regime === 'volatile') return 'Les ventes sont favoris ; prix bouge vite.'
    if (regime === 'range') return 'Les ventes sont un peu favoris ; cours latéral.'
    return 'Les ventes sont un peu favoris.'
  }
  if (regime === 'range') return 'Pas de direction nette ; cours en bloc.'
  if (regime === 'volatile') return 'Pas de direction nette ; beaucoup d’allers-retours.'
  return 'Pas de direction nette.'
}

function formatRsiChip(rsi: number, locale: Locale): string {
  const v = Math.round(rsi)
  if (locale === 'en') {
    if (rsi >= 70) return `RSI ${v} · Overbought`
    if (rsi <= 30) return `RSI ${v} · Oversold`
    return `RSI ${v}`
  }
  if (rsi >= 70) return `RSI ${v} · Surachat`
  if (rsi <= 30) return `RSI ${v} · Survente`
  return `RSI ${v}`
}

function cardChips(r: PlanTfRow, locale: Locale): string[] {
  const chips: string[] = []
  const rg = regimeChip(r, locale)
  if (rg) chips.push(rg)
  if (r.rsi != null) chips.push(formatRsiChip(r.rsi, locale))
  const vc = volChip(r.atrOverPricePct, locale)
  if (vc) chips.push(vc)
  return chips.slice(0, 3)
}

/**
 * Quand une seule UT contredit la majorité — surtout 1w/1d — message explicite pour éviter
 * l’« incohérence » entre un visuel majoritairement vert et un libellé « léger ».
 */
function formatLoneDissenterSummary(
  slots: { interval: HlInterval; setup: TraderSetup }[],
  longCount: number,
  shortCount: number,
  n: number,
  locale: Locale
): string | null {
  if (longCount === shortCount || n === 0) return null
  const majorityLong = longCount > shortCount
  const dissentSetup: TraderSetup = majorityLong ? 'short' : 'long'
  const dissents = slots.filter((s) => s.setup === dissentSetup)
  if (dissents.length !== 1) return null

  const iv = dissents[0]!.interval
  const structural = iv === '1w' || iv === '1d'

  if (locale === 'en') {
    const structLabel = iv === '1w' ? 'weekly' : iv === '1d' ? 'daily' : tfShortTitle(iv)
    if (majorityLong) {
      if (structural) {
        return `Bullish ${longCount}/${n} · ${structLabel} still bearish — careful size.`
      }
      return `Mostly bullish ${longCount}/${n} · ${structLabel} lags — confirm price.`
    }
    if (structural) {
      return `Bearish ${shortCount}/${n} · ${structLabel} still up — be selective.`
    }
    return `Mostly bearish ${shortCount}/${n} · ${structLabel} lags — confirm price.`
  }

  const structLabelFr = iv === '1w' ? 'hebdo' : iv === '1d' ? 'journalier' : tfShortTitle(iv)
  if (majorityLong) {
    if (structural) {
      return `Hausse ${longCount}/${n} UT · ${structLabelFr} baissier — prudence.`
    }
    return `Hausse ${longCount}/${n} · ${structLabelFr} contre — confirmer prix.`
  }
  if (structural) {
    return `Baisse ${shortCount}/${n} UT · ${structLabelFr} haussier — sélectif.`
  }
  return `Baisse ${shortCount}/${n} · ${structLabelFr} contre — confirmer prix.`
}

/**
 * Bandeau : un point par UT, + phrase globale simple.
 */
export function buildMtfConfluenceStrip(
  rows: PlanTfRow[],
  locale: Locale = 'fr'
): MtfConfluenceStrip {
  const slots: { interval: HlInterval; setup: TraderSetup }[] = []
  let longCount = 0
  let shortCount = 0
  let neutralCount = 0

  for (const iv of MTF_SYNTHESIS_TF_ORDER) {
    const row = rows.find((x) => x.interval === iv)
    let setup: TraderSetup = 'neutral'
    if (row && !row.error) {
      setup = planTfRowStripSetup(row)
      if (setup === 'long') longCount++
      else if (setup === 'short') shortCount++
      else neutralCount++
    } else {
      neutralCount++
    }
    slots.push({ interval: iv, setup })
  }

  let summaryLine: string
  const n = MTF_SYNTHESIS_TF_ORDER.length
  const loneDissentLine = formatLoneDissenterSummary(slots, longCount, shortCount, n, locale)
  if (loneDissentLine) {
    summaryLine = loneDissentLine
  } else if (locale === 'en') {
    if (longCount === n)
      summaryLine = `Bullish alignment: all ${n} timeframes agree.`
    else if (shortCount === n)
      summaryLine = `Bearish alignment: all ${n} timeframes agree.`
    else if (longCount >= 3 && shortCount === 0)
      summaryLine = `Bullish majority · ${longCount}/${n} timeframes.`
    else if (shortCount >= 3 && longCount === 0)
      summaryLine = `Bearish majority · ${shortCount}/${n} timeframes.`
    else if (longCount >= 2 && shortCount >= 2)
      summaryLine = 'Mixed signals across timeframes — wait for clarity.'
    else if (longCount > shortCount)
      summaryLine = 'Mildly bullish — confirm price action.'
    else if (shortCount > longCount)
      summaryLine = 'Mildly bearish — confirm price action.'
    else summaryLine = 'Mixed read — no clean directional bias.'
  } else {
    if (longCount === n) summaryLine = `Alignement haussier : les ${n} UT sont cohérentes.`
    else if (shortCount === n) summaryLine = `Alignement baissier : les ${n} UT sont cohérentes.`
    else if (longCount >= 3 && shortCount === 0)
      summaryLine = `Majorité haussière · ${longCount}/${n} UT.`
    else if (shortCount >= 3 && longCount === 0)
      summaryLine = `Majorité baissière · ${shortCount}/${n} UT.`
    else if (longCount >= 2 && shortCount >= 2)
      summaryLine =
        'Signaux contradictoires sur les UT — attendre plus de clarté.'
    else if (longCount > shortCount)
      summaryLine = 'Biais haussier partiel — confirmer le prix.'
    else if (shortCount > longCount)
      summaryLine = 'Biais baissier partiel — confirmer le prix.'
    else
      summaryLine =
        'Lecture mixte — pas de biais net.'
  }

  return { slots, longCount, shortCount, neutralCount, summaryLine }
}

/** Alignement opportunités / pyramide : même lecture que le bandeau MTF ({@link planTfRowStripSetup}). */
export function countIntervalsAlignedWithTradeDirection(
  rows: PlanTfRow[],
  direction: 'long' | 'short'
): number {
  let n = 0
  for (const iv of MTF_SYNTHESIS_TF_ORDER) {
    const r = rows.find((x) => x.interval === iv)
    if (!r || r.error) continue
    const setup = planTfRowStripSetup(r)
    if (setup === direction) n++
  }
  return n
}

/** Priorité en cas d’égalité de score : UT fines d’abord pour scalping, puis horizons plus larges. */
const TRADABLE_TF_TIEBREAK: readonly HlInterval[] = [...MTF_SYNTHESIS_TF_ORDER]

export type PositionRelevance = 'high' | 'moderate' | 'low'

export interface PlanMtfActionBrief {
  bestInterval: HlInterval
  bestIntervalTitle: string
  /** Une phrase : UT privilégiée + pourquoi (court). */
  analysisLine: string
  relevance: PositionRelevance
  /** Libellé court pour pastille. */
  relevanceBadge: string
  /** Une phrase : avis sur la prise de position. */
  relevanceLine: string
  /**
   * Si pertinence modérée / faible : niveau indicatif à attendre sur l’UT suggérée (EMA / range).
   */
  waitPriceLine: string | null
}

export interface BuildPlanMtfActionBriefOptions {
  formatPrice?: (price: number) => string
}

type WaitLevelTag = 'ema20' | 'ema50' | 'range_low' | 'range_high'

function defaultFormatBriefPrice(price: number): string {
  if (!Number.isFinite(price)) return ''
  const ax = Math.abs(price)
  if (ax >= 100) return price.toFixed(2)
  if (ax >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function waitHintBias(
  heroKind: ConsensusHeroKind,
  strip: MtfConfluenceStrip,
  bestRow: PlanTfRow | null
): 'long' | 'short' | null {
  if (heroKind === 'long-strong' || heroKind === 'long-lean') return 'long'
  if (heroKind === 'short-strong' || heroKind === 'short-lean') return 'short'
  if (strip.longCount > strip.shortCount) return 'long'
  if (strip.shortCount > strip.longCount) return 'short'
  if (!bestRow || bestRow.error) return null
  const s = planTfRowStripSetup(bestRow)
  if (s === 'long') return 'long'
  if (s === 'short') return 'short'
  return null
}

/** Niveau de patience (EMA / extrême ~20 bougies) sur la ligne `bestRow`. */
function computeWaitLevel(
  row: PlanTfRow,
  bias: 'long' | 'short'
): { price: number; tag: WaitLevelTag } | null {
  const c = row.lastClose
  const e20 = row.ema20
  const e50 = row.ema50
  const lo = row.recentLow20
  const hi = row.recentHigh20
  if (c == null || !(c > 0) || row.error) return null

  const eps = Math.max(c * 1e-6, 1e-12)

  if (bias === 'long') {
    if (e20 != null && c > e20 + eps) return { price: e20, tag: 'ema20' }
    if (e50 != null && c > e50 + eps && (e20 == null || c <= e20 + eps))
      return { price: e50, tag: 'ema50' }
    if (lo != null && lo < c - eps) return { price: lo, tag: 'range_low' }
    if (e20 != null && c < e20 - eps) return { price: e20, tag: 'ema20' }
    if (e50 != null) return { price: e50, tag: 'ema50' }
    return null
  }

  if (e20 != null && c < e20 - eps) return { price: e20, tag: 'ema20' }
  if (e50 != null && c < e50 - eps && (e20 == null || c >= e20 - eps))
    return { price: e50, tag: 'ema50' }
  if (hi != null && hi > c + eps) return { price: hi, tag: 'range_high' }
  if (e20 != null && c > e20 + eps) return { price: e20, tag: 'ema20' }
  if (e50 != null) return { price: e50, tag: 'ema50' }
  return null
}

function waitLevelCaption(tag: WaitLevelTag, locale: Locale): string {
  if (locale === 'en') {
    if (tag === 'ema20') return 'EMA20 retest'
    if (tag === 'ema50') return 'EMA50 zone'
    if (tag === 'range_low') return 'recent range low'
    return 'recent range high'
  }
  if (tag === 'ema20') return 'retest EMA20'
  if (tag === 'ema50') return 'zone EMA50'
  if (tag === 'range_low') return 'bas du range récent'
  return 'haut du range récent'
}

function tradableTfScore(row: PlanTfRow, heroKind: ConsensusHeroKind): number {
  if (row.error) return -1e6
    const setup = planTfRowStripSetup(row)
  let s = 0

  if (heroKind === 'long-strong' || heroKind === 'long-lean') {
    if (setup === 'long') s += 50
    else if (setup === 'neutral') s += 14
    else s -= 40
  } else if (heroKind === 'short-strong' || heroKind === 'short-lean') {
    if (setup === 'short') s += 50
    else if (setup === 'neutral') s += 14
    else s -= 40
  } else {
    if (setup === 'long') s += 26
    else if (setup === 'short') s += 26
    else s += 8
    const skew = row.directionalSkew
    if (skew != null) s += Math.min(18, Math.abs(skew) * 14)
  }

  const reg = row.regime?.label
  if (reg === 'tendance') s += 30
  else if (reg === 'volatile') s += 14
  else if (reg === 'range') s += 8

  if (row.confirmedStrong) s += 22

  const atr = row.atrOverPricePct
  if (atr != null && atr > 0.6) s -= 14
  else if (atr != null && atr > 0.45) s -= 5

  return s
}

function tiebreakIndex(iv: HlInterval): number {
  const i = TRADABLE_TF_TIEBREAK.indexOf(iv)
  return i === -1 ? 99 : i
}

function pickBestTradableInterval(
  rows: PlanTfRow[],
  scoreFn: (row: PlanTfRow) => number
): { interval: HlInterval; row: PlanTfRow | null; score: number } {
  let bestIv: HlInterval = '1h'
  let bestRow: PlanTfRow | null = null
  let bestScore = -1e9

  for (const iv of MTF_SYNTHESIS_TF_ORDER) {
    const row = rows.find((x) => x.interval === iv) ?? null
    const sc = row ? scoreFn(row) : -1e6
    if (sc > bestScore) {
      bestScore = sc
      bestIv = iv
      bestRow = row
      continue
    }
    if (row && sc === bestScore && sc > -1e5) {
      if (tiebreakIndex(iv) < tiebreakIndex(bestIv)) {
        bestIv = iv
        bestRow = row
      }
    }
  }

  if (bestScore < -1e5) return { interval: '1h', row: null, score: bestScore }
  return { interval: bestIv, row: bestRow, score: bestScore }
}

function positionRelevanceFromContext(
  heroKind: ConsensusHeroKind,
  bestRow: PlanTfRow | null
): PositionRelevance {
  if (!bestRow || bestRow.error) return 'low'
  if (heroKind === 'clash') return 'low'
  if (heroKind === 'neutral') return 'low'

  /** Pile dominante : même avec un exécution en range, le biais multi‑UT prime — évite un « Prudence » systématique. */
  if (heroKind === 'long-strong' || heroKind === 'short-strong') {
    return 'high'
  }

  if (heroKind === 'long-lean' || heroKind === 'short-lean') {
    if (bestRow.regime?.label === 'range') return 'low'
    if (bestRow.regime?.label === 'volatile' && !bestRow.confirmedStrong) return 'moderate'
    return 'high'
  }

  return 'low'
}

function buildRelevanceLine(
  relevance: PositionRelevance,
  bestRow: PlanTfRow | null,
  locale: Locale
): string {
  if (locale === 'en') {
    if (relevance === 'high') return 'Stack largely aligned—keep risk rules.'
    if (relevance === 'low') return 'Fragile read—no full size until structure clears.'
    const reg = bestRow?.regime?.label
    if (reg === 'range') return 'Partial stack + range TF: smaller size, limit preferred.'
    if (reg === 'volatile') return 'Partial stack + volatile: limit first, trigger for market.'
    if (reg === 'tendance') return 'Partial stack but TF trending: moderate size, picky entries.'
    return 'Partial alignment: smaller size, limit, confirm when unsure.'
  }

  if (relevance === 'high') return 'UT cohérentes — garde ta discipline risque.'
  if (relevance === 'low') return 'Lecture fragile — pas de taille pleine.'
  const reg = bestRow?.regime?.label
  if (reg === 'range') return 'Pile partielle + range : taille réduite, limite.'
  if (reg === 'volatile') return 'Pile partielle + volatil : limite d’abord, marché sur déclencheur.'
  if (reg === 'tendance') return 'Pile partielle + tendance : taille modérée, entrée sélective.'
  return 'Alignement partiel : taille réduite, limite, confirmation.'
}

/**
 * Synthèse actionnable : UT la plus pertinente pour cadencer le trade + avis sur l’entrée.
 */
export function buildPlanMtfActionBrief(
  rows: PlanTfRow[],
  locale: Locale = 'fr',
  options?: BuildPlanMtfActionBriefOptions
): PlanMtfActionBrief {
  const strip = buildMtfConfluenceStrip(rows, locale)
  const hero = consensusHeroFromStrip(strip)
  const scoreFn = (r: PlanTfRow) => tradableTfScore(r, hero.kind)
  const { interval: bestInterval, row: bestRow } = pickBestTradableInterval(rows, scoreFn)
  const tf = tfShortTitle(bestInterval)
  const relevance = positionRelevanceFromContext(hero.kind, bestRow)

  let relevanceBadge: string
  let relevanceLine: string
  let analysisLine: string

  if (locale === 'en') {
    relevanceBadge =
      relevance === 'high'
        ? 'Strong setup'
        : relevance === 'moderate'
          ? 'Cautious'
          : 'Wait'
    relevanceLine = buildRelevanceLine(relevance, bestRow, 'en')

    if (!bestRow || bestRow.error) {
      analysisLine = 'Incomplete TF data.'
    } else {
      const rs =
        bestRow.regime?.label === 'tendance'
          ? 'trend'
          : bestRow.regime?.label === 'range'
            ? 'range'
            : bestRow.regime?.label === 'volatile'
              ? 'volatile'
              : 'mixed'
      if (hero.kind === 'long-strong' || hero.kind === 'short-strong') {
        analysisLine = `${tf} · ${rs} · stacked`
      } else if (hero.kind === 'long-lean' || hero.kind === 'short-lean') {
        analysisLine = `${tf} · ${rs} · partial`
      } else {
        analysisLine = `${tf} · ${rs} · weak`
      }
    }
  } else {
    relevanceBadge =
      relevance === 'high'
        ? 'Contexte favorable'
        : relevance === 'moderate'
          ? 'Prudence'
          : 'À patienter'
    relevanceLine = buildRelevanceLine(relevance, bestRow, 'fr')

    if (!bestRow || bestRow.error) {
      analysisLine = 'Données UT incomplètes.'
    } else {
      const rs =
        bestRow.regime?.label === 'tendance'
          ? 'tendance'
          : bestRow.regime?.label === 'range'
            ? 'range'
            : bestRow.regime?.label === 'volatile'
              ? 'volatile'
              : 'mixte'
      if (hero.kind === 'long-strong' || hero.kind === 'short-strong') {
        analysisLine = `${tf} · ${rs} · pile nette`
      } else if (hero.kind === 'long-lean' || hero.kind === 'short-lean') {
        analysisLine = `${tf} · ${rs} · pile partielle`
      } else {
        analysisLine = `${tf} · ${rs} · peu lisible`
      }
    }
  }

  const fmtPx = options?.formatPrice ?? defaultFormatBriefPrice
  let waitPriceLine: string | null = null
  if (relevance !== 'high' && bestRow && !bestRow.error) {
    const wb = waitHintBias(hero.kind, strip, bestRow)
    if (wb) {
      const level = computeWaitLevel(bestRow, wb)
      if (level != null) {
        const px = fmtPx(level.price)
        if (px) {
          const cap = waitLevelCaption(level.tag, locale)
          waitPriceLine =
            locale === 'en'
              ? `Watch ~${px} · ${tf} · ${cap} · confirm close`
              : `~${px} · ${tf} · ${cap} · confirmer clôture`
        }
      }
    }
  }

  return {
    bestInterval,
    bestIntervalTitle: tf,
    analysisLine,
    relevance,
    relevanceBadge,
    relevanceLine,
    waitPriceLine,
  }
}

export function consensusHeroFromStrip(strip: MtfConfluenceStrip): {
  kind: ConsensusHeroKind
  glyph: string
  ariaLabel: string
} {
  const { longCount, shortCount, summaryLine } = strip
  const n = strip.slots.length
  const strongMin = Math.max(3, Math.ceil(n * 0.75))
  if (longCount === n || (longCount >= strongMin && shortCount === 0)) {
    return { kind: 'long-strong', glyph: '↑', ariaLabel: summaryLine }
  }
  if (shortCount === n || (shortCount >= strongMin && longCount === 0)) {
    return { kind: 'short-strong', glyph: '↓', ariaLabel: summaryLine }
  }
  if (longCount >= 2 && shortCount >= 2) {
    return { kind: 'clash', glyph: '×', ariaLabel: summaryLine }
  }
  if (longCount > shortCount) return { kind: 'long-lean', glyph: '↑', ariaLabel: summaryLine }
  if (shortCount > longCount) return { kind: 'short-lean', glyph: '↓', ariaLabel: summaryLine }
  return { kind: 'neutral', glyph: '↔', ariaLabel: summaryLine }
}

/**
 * Cartes synthèse par temporalité — visuel d’abord, peu de texte.
 */
export function buildTraderTfCards(rows: PlanTfRow[], locale: Locale = 'fr'): TraderTfCard[] {
  const out: TraderTfCard[] = []
  const naTag = locale === 'en' ? 'Data unavailable.' : 'Données indisponibles.'
  for (const iv of TRADER_TF_ORDER) {
    const r = rows.find((x) => x.interval === iv)
    if (!r) {
      out.push({
        interval: iv,
        shortTitle: tfShortTitle(iv),
        setup: 'neutral',
        setupLabel: setupToLabel('neutral', locale),
        tagline: naTag,
        chips: [],
      })
      continue
    }
    if (r.error) {
      const errHint =
        r.error.length > 100 ? `${r.error.slice(0, 100)}…` : r.error
      out.push({
        interval: iv,
        shortTitle: tfShortTitle(iv),
        setup: 'neutral',
        setupLabel: setupToLabel('neutral', locale),
        tagline: errHint,
        chips: [],
      })
      continue
    }

    const setup = planTfRowStripSetup(r)
    const tagline = simpleTagline(setup, r, locale)
    const chips = cardChips(r, locale)

    out.push({
      interval: iv,
      shortTitle: tfShortTitle(iv),
      setup,
      setupLabel: setupToLabel(setup, locale),
      tagline,
      chips,
    })
  }
  return out
}

/** @deprecated Préférer buildMtfConfluenceStrip côté UI. */
export function pyramidDominantTrendSentence(rows: PlanTfRow[]): string | null {
  const strip = buildMtfConfluenceStrip(rows)
  if (strip.longCount + strip.shortCount + strip.neutralCount === 0) return null
  return strip.summaryLine
}

export interface PlanTfDetailSection {
  interval: HlInterval
  title: string
  bullets: string[]
}

function tfDetailTitle(iv: HlInterval): string {
  if (iv === '1m') return '1 minute'
  if (iv === '5m') return '5 minutes'
  if (iv === '15m') return '15 minutes'
  if (iv === '1h') return '1 heure'
  if (iv === '4h') return '4 heures'
  if (iv === '1d') return 'Daily'
  if (iv === '1w') return '1 semaine'
  return iv
}

function dominantTrendClause(r: PlanTfRow): string {
  const setup = planTfRowStripSetup(r)
  const axis =
    setup === 'long'
      ? 'tendance haussière'
      : setup === 'short'
        ? 'tendance baissière'
        : 'pas de tendance claire'

  let tail = ''
  if (setup !== 'neutral' && r.confirmedStrong) tail = ' · lecture soutenue (signal fort)'

  const regime = r.regimeLabel && r.regimeLabel !== '—' ? r.regimeLabel : null
  const regimeBit = regime ? ` · marché qualifié « ${regime} »` : ''

  return `${axis}${regimeBit}${tail}.`
}

/** @deprecated Utiliser buildTraderTfCards pour l’UI Plan — conservé si besoin legacy. */
export function buildPlanTfDetailSections(rows: PlanTfRow[]): PlanTfDetailSection[] {
  const out: PlanTfDetailSection[] = []
  for (const iv of TRADER_TF_ORDER) {
    const r = rows.find((x) => x.interval === iv)
    if (!r) {
      out.push({
        interval: iv,
        title: tfDetailTitle(iv),
        bullets: ['Données indisponibles pour cette temporalité.'],
      })
      continue
    }
    if (r.error) {
      out.push({
        interval: iv,
        title: tfDetailTitle(iv),
        bullets: [`Flux insuffisant (${iv}).`],
      })
      continue
    }

    const bullets: string[] = [dominantTrendClause(r)]
    bullets.push(`Structure / prix : ${r.emaStructure}.`)

    out.push({ interval: iv, title: tfDetailTitle(iv), bullets })
  }
  return out
}
