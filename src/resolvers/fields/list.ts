import resolver from '../resolver'
import { List } from '../../models/'

export const publicView = resolver<boolean, List>()(
  ({ parent: { public_view } }) => public_view
)

export const pictureUrl = resolver<string, List>()(
  ({ parent: { picture_url } }) => picture_url
)

export const backgroundColor = resolver<string, List>()(
  ({ parent: { background_color } }) => background_color
)

export const textColor = resolver<string, List>()(
  ({ parent: { text_color } }) => text_color
)
