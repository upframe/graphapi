import account from './account'
import profile from './profile'
import messaging from './messaging'
import calendar from './calendar'
import scheduling from './scheduling'

export default {
  ...account,
  ...profile,
  ...messaging,
  ...calendar,
  ...scheduling,
}
