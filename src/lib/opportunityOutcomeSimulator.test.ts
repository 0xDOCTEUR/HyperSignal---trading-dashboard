import { describe, expect, it } from 'vitest'
import { simulateTpSlRace } from './opportunityOutcomeSimulator'

describe('simulateTpSlRace', () => {
  it('long : TP touché avant SL', () => {
    const highs = [0, 0, 112, 112]
    const lows = [0, 0, 100, 100]
    const r = simulateTpSlRace({
      direction: 'long',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 99,
      takeProfit1: 110,
      maxBarsForward: 5,
      sameBarPriority: 'stop_first',
    })
    expect(r).toBe('tp1_first')
  })

  it('long : SL avant TP', () => {
    const highs = [0, 0, 101, 101]
    const lows = [0, 0, 98, 98]
    const r = simulateTpSlRace({
      direction: 'long',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 99,
      takeProfit1: 110,
      maxBarsForward: 5,
      sameBarPriority: 'stop_first',
    })
    expect(r).toBe('sl_first')
  })

  it('long : même barre SL+TP → stop_first', () => {
    const highs = [0, 0, 115, 115]
    const lows = [0, 0, 98, 98]
    const r = simulateTpSlRace({
      direction: 'long',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 99,
      takeProfit1: 110,
      maxBarsForward: 5,
      sameBarPriority: 'stop_first',
    })
    expect(r).toBe('sl_first')
  })

  it('long : même barre SL+TP → tp_first si priorité inverse', () => {
    const highs = [0, 0, 115, 115]
    const lows = [0, 0, 98, 98]
    const r = simulateTpSlRace({
      direction: 'long',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 99,
      takeProfit1: 110,
      maxBarsForward: 5,
      sameBarPriority: 'tp_first',
    })
    expect(r).toBe('tp1_first')
  })

  it('short : SL touché via high', () => {
    const highs = [0, 0, 105, 105]
    const lows = [0, 0, 100, 100]
    const r = simulateTpSlRace({
      direction: 'short',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 104,
      takeProfit1: 95,
      maxBarsForward: 5,
      sameBarPriority: 'stop_first',
    })
    expect(r).toBe('sl_first')
  })

  it('timeout si rien dans l’horizon', () => {
    const highs = [0, 0, 100.1, 100.1]
    const lows = [0, 0, 99.9, 99.9]
    const r = simulateTpSlRace({
      direction: 'long',
      highs,
      lows,
      entryBarIndex: 1,
      stopLoss: 50,
      takeProfit1: 200,
      maxBarsForward: 1,
      sameBarPriority: 'stop_first',
    })
    expect(r).toBe('timeout')
  })
})
