import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToRgb,
  readableColor,
  relativeLuminance,
} from '@/lib/color'

describe('hexToRgb', () => {
  it('6자리 hex 파싱', () => {
    expect(hexToRgb('#10b981')).toEqual({ r: 16, g: 185, b: 129 })
  })
  it('3자리 hex 확장 파싱', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
  it('잘못된 입력은 null', () => {
    expect(hexToRgb('not-a-color')).toBeNull()
    expect(hexToRgb('#12345')).toBeNull()
  })
})

describe('relativeLuminance / contrastRatio', () => {
  it('흰색 휘도 1, 검정 휘도 0', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1)
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0)
  })
  it('흰-검정 대비비 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1)
  })
})

describe('readableColor — 실제 팀 색상 시나리오', () => {
  const TEAM_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4']

  it.each(TEAM_COLORS)('%s → 보정 후 흰 배경 대비 4.5:1 이상 (본문 텍스트)', (color) => {
    const fixed = readableColor(color)
    const ratio = contrastRatio(hexToRgb(fixed)!, hexToRgb('#ffffff')!)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('이미 충분한 어두운 색은 그대로 반환', () => {
    // green-700 #15803d는 흰 배경 4.5:1 이상
    expect(readableColor('#15803d')).toBe('#15803d')
  })

  it('큰 텍스트 기준(3:1)으로도 요청 가능', () => {
    const fixed = readableColor('#f59e0b', 3)
    const ratio = contrastRatio(hexToRgb(fixed)!, hexToRgb('#ffffff')!)
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('원본 색상보다 밝아지지 않음 (어둡게만 보정)', () => {
    const original = relativeLuminance(hexToRgb('#f59e0b')!)
    const fixed = relativeLuminance(hexToRgb(readableColor('#f59e0b'))!)
    expect(fixed).toBeLessThanOrEqual(original)
  })
})
