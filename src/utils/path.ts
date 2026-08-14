export const normalizePath = (path: string): string => {
  const parts: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

export const dirname = (path: string): string => {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index < 0 ? '' : normalized.slice(0, index)
}

export const joinPath = (...parts: string[]): string => normalizePath(parts.filter(Boolean).join('/'))

export const resolvePublicPath = (path: string, baseUrl = import.meta.env.BASE_URL): string => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${normalizePath(path)}`
}

export const isExternalAsset = (src: string): boolean =>
  /^(https?:|data:|blob:)/i.test(src)
