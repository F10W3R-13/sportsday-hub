type Rgb = { r: number; g: number; b: number }

/** '#rgb' | '#rrggbb' → RGB. 파싱 실패 시 null */
export function hexToRgb(hex: string): Rgb | null {
  let h = hex.replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** WCAG 상대 휘도 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }

/**
 * 흰 배경(또는 color/20 같은 근사 흰 틴트) 위에서 minRatio 이상 대비 나는 전경색.
 * 조건을 만족할 때까지 검정과 섞어 어둡게 한다. 파싱 실패 시 원값 반환.
 */
export function readableColor(hex: string, minRatio = 4.5): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  if (contrastRatio(rgb, WHITE) >= minRatio) return hex
  // 이진 탐색: black(0) ↔ 원색(1) 혼합 비율
  let lo = 0
  let hi = 1
  let best = rgb
  for (let i = 0; i < 20; i++) {
    const t = (lo + hi) / 2
    const mixed: Rgb = {
      r: rgb.r * t,
      g: rgb.g * t,
      b: rgb.b * t,
    }
    if (contrastRatio(mixed, WHITE) >= minRatio) {
      best = mixed
      lo = t
    } else {
      hi = t
    }
  }
  // 검증된 float 값에서 내림 변환 — 반올림으로 밝아져 대비가 떨어지는 것 방지
  const to = (v: number) =>
    Math.floor(v)
      .toString(16)
      .padStart(2, '0')
  return `#${to(best.r)}${to(best.g)}${to(best.b)}`
}
