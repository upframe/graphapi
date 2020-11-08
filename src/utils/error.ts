export const catchError = <T extends (...args: any[]) => any>(
  func: T,
  rethrow = false
) => (errorHandler: (error: any, ...args: Parameters<T>) => void) => (
  ...args: Parameters<T>
): ReturnType<T> => {
  let returnValue: ReturnType<T>
  try {
    returnValue = func(...args)
    if (typeof returnValue?.then !== 'function') return returnValue
    // if (typeof v?.then === 'function')
    //   return new Promise((res, rej) => {
    //     v.then(res).catch(e => {
    //       errorHandler(e, ...args)
    //       if (rethrow) rej(e)
    //       else res()
    //     })
    //   }) as ReturnType<T>
    // return v
  } catch (error) {
    errorHandler(error, ...args)
    if (rethrow) throw error
  }
  return returnValue.catch(err => {
    errorHandler(err, ...args)
    if (rethrow) throw err
  })
}
