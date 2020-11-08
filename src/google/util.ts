import { catchError } from '~/utils/error'
import { GoogleAuthError } from '~/error'

export const catchInvalid: MethodDecorator = (
  target,
  key,
  descriptor: PropertyDescriptor
) => {
  const org = descriptor.value
  descriptor.value = function (...args: any[]) {
    return catchError(org.bind(this))(error => {
      logger.warn(`[@catchInvalid] error caught in ${String(key)}`, { error })
      logger.info(this.credentials)
      logger.info(this)
      logger.info(this.constructor.db)
      if (!this.userId)
        logger.warn(
          "[@catchInvalid] can't remove credentials because userId isn't set",
          { client: this }
        )
      else
        this.constructor.tasks.push(
          (this.constructor.db as DB)('connect_google')
            .where({ user_id: this.userId })
            .update({ refresh_token: null, access_token: null, scopes: null })
        )
      throw GoogleAuthError()
    })(...args)
  }
}
