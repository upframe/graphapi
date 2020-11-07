export const catchError = <T extends (...args: any[]) => any>(
  func: T,
  rethrow = true
) => (errorHandler: (error: any, ...args: Parameters<T>) => void) => (
  ...args: Parameters<T>
): ReturnType<T> => {
  try {
    const v = func(...args)
    if (typeof v?.then === 'function')
      return new Promise((res, rej) => {
        v.then(res).catch(e => {
          errorHandler(e, ...args)
          if (rethrow) rej(e)
          else res()
        })
      }) as ReturnType<T>
    return v
  } catch (error) {
    errorHandler(error, ...args)
    if (rethrow) throw error
  }
}
