import type { PlanTfRow } from '../hooks/usePlanMultiTf'
import type { Locale } from '../i18n/locale'
import type { HlInterval } from './interval'

/** Ordre affichage synthèse trader (court → large). */
export const TRADER_TF_ORDER: readonly HlInterval[] = ['15m', '1h', '4h', '1d']

export function tfShortTitle(iv: HlInterval): string {
  if (iv === '1d') return 'Daily'
  if (iv === '4h') return '4h'
  if (iv === '1h') return '1h'
  return '15m'
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

function rowToSetup(r: PlanTfRow): TraderSetup {
  if (r.error) return 'neutral'

  const d = r.bestVote?.direction ?? 'flat'
  if (d === 'long') return 'long'
  if (d === 'short') return 'short'

  /** Stratégies toutes « plates » : léger biais visuel si prix et EMA20/50 sont alignés (réduit les faux neutres). */
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

function cardChips(r: PlanTfRow, locale: Locale): string[] {
  const chips: string[] = []
  const rg = regimeChip(r, locale)
  if (rg) chips.push(rg)
  if (r.rsi != null) chips.push(`RSI ${Math.round(r.rsi)}`)
  const vc = volChip(r.atrOverPricePct, locale)
  if (vc) chips.push(vc)
  return chips.slice(0, 3)
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

  for (const iv of TRADER_TF_ORDER) {
    const row = rows.find((x) => x.interval === iv)
    let setup: TraderSetup = 'neutral'
    if (row && !row.error) {
      setup = rowToSetup(row)
      if (setup === 'long') longCount++
      else if (setup === 'short') shortCount++
      else neutralCount++
    } else {
      neutralCount++
    }
    slots.push({ interval: iv, setup })
  }

  let summaryLine: string
  const n = TRADER_TF_ORDER.length
  if (locale === 'en') {
    if (longCount === n)
      summaryLine = 'Aligned everywhere: long bias across all four timeframes.'
    else if (shortCount === n)
      summaryLine = 'Aligned everywhere: short bias across all four timeframes.'
    else if (longCount >= 3 && shortCount === 0)
      summaryLine = `Often bullish (${longCount} of ${n} timeframes).`
    else if (shortCount >= 3 && longCount === 0)
      summaryLine = `Often bearish (${shortCount} of ${n} timeframes).`
    else if (longCount >= 2 && shortCount >= 2)
      summaryLine = 'Timeframes disagree — stay cautious.'
    else if (longCount > shortCount)
      summaryLine = 'Slight bullish lean, but not everywhere.'
    else if (shortCount > longCount)
      summaryLine = 'Slight bearish lean, but not everywhere.'
    else summaryLine = 'No clean line: several timeframes stay neutral.'
  } else {
    if (longCount === n) summaryLine = 'Même sens partout : hausse sur les quatre temps.'
    else if (shortCount === n) summaryLine = 'Même sens partout : baisse sur les quatre temps.'
    else if (longCount >= 3 && shortCount === 0)
      summaryLine = `Hausse souvent d’accord (${longCount} temps sur ${n}).`
    else if (shortCount >= 3 && longCount === 0)
      summaryLine = `Baisse souvent d’accord (${shortCount} temps sur ${n}).`
    else if (longCount >= 2 && shortCount >= 2)
      summaryLine = 'Les temps ne sont pas d’accord : prudence.'
    else if (longCount > shortCount) summaryLine = 'Légère préférence haussière, mais pas partout.'
    else if (shortCount > longCount) summaryLine = 'Légère préférence baissière, mais pas partout.'
    else summaryLine = 'Pas de ligne claire : plusieurs temps restent neutres.'
  }

  return { slots, longCount, shortCount, neutralCount, summaryLine }
}

/** Synthèse globale pour UI 100 % visuelle (glyph + classe CSS). */
export type ConsensusHeroKind =
  | 'long-strong'
  | 'short-strong'
  | 'long-lean'
  | 'short-lean'
  | 'clash'
  | 'neutral'

export function consensusHeroFromStrip(strip: MtfConfluenceStrip): {
  kind: ConsensusHeroKind
  glyph: string
  ariaLabel: string
} {
  const { longCount, shortCount, summaryLine } = strip
  const n = TRADER_TF_ORDER.length
  if (longCount === n || (longCount >= 3 && shortCount === 0)) {
    return { kind: 'long-strong', glyph: '↑', ariaLabel: summaryLine }
  }
  if (shortCount === n || (shortCount >= 3 && longCount === 0)) {
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
  const shortTag = locale === 'en' ? 'Insufficient data.' : 'Données insuffisantes.'
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
      out.push({
        interval: iv,
        shortTitle: tfShortTitle(iv),
        setup: 'neutral',
        setupLabel: setupToLabel('neutral', locale),
        tagline: shortTag,
        chips: [],
      })
      continue
    }

    const setup = rowToSetup(r)
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
  if (iv === '15m') return '15 minutes'
  if (iv === '1h') return '1 heure'
  if (iv === '4h') return '4 heures'
  return iv === '1d' ? 'Daily' : iv
}

function dominantTrendClause(r: PlanTfRow): string {
  const rowDir = r.bestVote?.direction ?? null
  const axis =
    rowDir === 'long'
      ? 'tendance haussière'
      : rowDir === 'short'
        ? 'tendance baissière'
        : 'pas de tendance claire'

  let tail = ''
  if (rowDir !== 'flat' && r.confirmedStrong) tail = ' · lecture soutenue (signal fort)'

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
