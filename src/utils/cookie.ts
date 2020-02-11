export const parseCookies = (cookieString: string = '') =>
  Object.fromEntries(
    cookieString.split(';').map(seg => seg.split('=').map(v => v.trim()))
  )
