import resolver from '../resolver'
import { User } from '../../models'
import { tz } from 'moment-timezone'
import st from 'spacetime-informal'

export const iana = resolver<string, User>()(({ parent }) => parent.timezone)

export const utcOffset = resolver<number, User>()(({ parent }) => {
  return tz(parent.timezone).utcOffset()
})

export const nonDstOff = resolver<number, User>()(({ parent }) => {
  const zone = tz(parent.timezone)
  const off = zone.utcOffset()
  if (zone.isDST()) return off - 60
  return off
})

export const isDst = resolver<boolean, User>()(({ parent }) =>
  tz(parent.timezone).isDST()
)

export const hasDst = resolver<boolean, User>()(
  ({ parent }) =>
    tz(`${new Date().getFullYear()}-01-01`, parent.timezone).isDST() !==
    tz(`${new Date().getFullYear()}-06-01`, parent.timezone).isDST()
)

export const informal = resolver<any, User>()(({ parent }) => {
  const inf = st.display(parent.timezone)
  if (!inf?.standard) return null
  const standard = {
    name: inf.standard.name,
    abbr: inf.standard.abbrev,
  }
  const dst = !inf.daylight
    ? null
    : {
        name: inf.daylight.name,
        abbr: inf.daylight.abbrev,
      }
  return {
    standard,
    dst,
    current: tz(parent.timezone).isDST() ? dst : standard,
  }
})
