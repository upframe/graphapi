import markdownIt from 'markdown-it'
import dns from 'dns'

const md = new markdownIt({
  breaks: true,
}).enable('table')

const tableDefault =
  md.renderer.rules.table_open ??
  ((tokens, i, options, env, self) => self.renderToken(tokens, i, options))

md.renderer.rules.table_open = (tokens, i, options, env, self) => {
  tokens[i].attrPush([
    'style',
    `--columns: ${tokens.filter(({ type }) => type === 'th_open').length}`,
  ])
  return tableDefault(tokens, i, options, env, self)
}

const isRegistered = async (url: string) =>
  await new Promise(res => dns.lookup(url, (_, address) => res(!!address)))

const batchLookup = async (
  urls: string[],
  timeout = 500
): Promise<(boolean | undefined)[]> => {
  if (urls.length === 0) return []
  return await new Promise(res => {
    const resolved = new Array(urls.length).fill(undefined)

    const toId = setTimeout(() => {
      res(resolved)
    }, timeout)

    urls.forEach((url, i) =>
      isRegistered(url).then(v => {
        resolved[i] = v
        if (resolved.filter(v => typeof v === 'boolean').length < urls.length)
          return
        clearTimeout(toId)
        res(resolved)
      })
    )
  })
}

const autoLink = async (input: string) => {
  const linkCandidates = Array.from(
    input.matchAll(
      /(?<=\s|^)(http(s?):\/\/)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){0,2}\.[a-z]{2,10}(\/([\w-.~!$&'()*+,;=:@]|(%[0-9a-fA-F]{2}))+)*\/?(\?[^?#]*)?(#(([\w!$&'()*+,;=\-.~:@/?]|(%[0-9a-fA-F]{2}))*))?(?=\s|$)/g
    )
  )

  const domains = linkCandidates.map(([url]) =>
    url.replace(/^https?:\/\//, '').replace(/[/?].*/, '')
  )

  const urlStatus = await batchLookup(domains)

  const valid = urlStatus.flatMap((v, i) => (v ? [linkCandidates[i]] : []))

  let offset = 0
  for (const { 0: url, index } of valid) {
    input = `${input.slice(0, index + offset)}[${url}](${url})${input.slice(
      index + url.length + offset
    )}`
    offset += url.length + 4
  }

  return input
}

export const render = async (input: string) => md.render(await autoLink(input))
