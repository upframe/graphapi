export function hexToRGB(hex: string): [number, number, number] {
  if (hex.startsWith('#')) hex = hex.substring(1)
  if (hex.length < 7)
    hex = hex
      .split('')
      .flatMap(v => [v, v])
      .join('')
  const [r, g, b] = hex.match(/.{2}/g).map(v => parseInt(v, 16))
  return [r, g, b]
}

// https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
export const luminance = (r: number, g: number, b: number) =>
  [r, g, b]
    .map(v => (v /= 255))
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)

// https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
export const contrast = (l1: number, l2: number) =>
  (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
