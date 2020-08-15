import resolver from '../resolver'
import type { List } from '~/models'
import { hexToRGB, luminance, contrast } from '~/utils/color'

export const backgroundColor = resolver<string, List>()(
  ({ parent }) => parent.background_color
)

const light = '#fffe'
const dark = '#000e'
const [lightLum, darkLum] = [light, dark].map(v => luminance(...hexToRGB(v)))

export const textColor = resolver<string, List>()(
  ({ parent: { background_color, text_color } }) => {
    if (text_color) return text_color
    if (!background_color) return null
    const backLum = luminance(...hexToRGB(background_color))
    return contrast(lightLum, backLum) > contrast(darkLum, backLum)
      ? light
      : dark
  }
)

export const illustration = resolver<string, List>()(
  ({ parent: { illustration } }) =>
    illustration && `https://${process.env.ASSET_BUCKET}${illustration}`
)
