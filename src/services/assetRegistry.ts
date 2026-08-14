import { appDb } from '@/db/appDb'
import { dirname, isExternalAsset, joinPath, normalizePath, resolvePublicPath } from '@/utils/path'

class AssetRegistry {
  private objectUrlCache = new Map<string, string>()

  async resolve(libraryId: string, configPath: string, assetsBase: string | undefined, src: string): Promise<string> {
    if (isExternalAsset(src)) return src

    const configDirectory = dirname(configPath)
    const resolvedPath = joinPath(configDirectory, assetsBase ?? '', src)

    if (libraryId === 'builtin-electrician-library') {
      return resolvePublicPath(`question-banks/${resolvedPath}`)
    }

    const cacheKey = `${libraryId}::${resolvedPath}`
    const cached = this.objectUrlCache.get(cacheKey)
    if (cached) return cached

    const asset = await appDb.assets.get(cacheKey)
    if (!asset) return ''

    const objectUrl = URL.createObjectURL(asset.blob)
    this.objectUrlCache.set(cacheKey, objectUrl)
    return objectUrl
  }

  revokeLibrary(libraryId: string): void {
    for (const [key, value] of this.objectUrlCache.entries()) {
      if (key.startsWith(`${libraryId}::`)) {
        URL.revokeObjectURL(value)
        this.objectUrlCache.delete(key)
      }
    }
  }

  clear(): void {
    for (const url of this.objectUrlCache.values()) URL.revokeObjectURL(url)
    this.objectUrlCache.clear()
  }

  normalize(path: string): string {
    return normalizePath(path)
  }
}

export const assetRegistry = new AssetRegistry()
