import resolver from '../resolver'
import { List } from '../../models/'

export const publicView = resolver<boolean, List>()(
  ({ parent: { public_view } }) => public_view
)

export const pictureUrl = resolver<string, List>()(
  ({ parent: { picture_url } }) => picture_url
)
