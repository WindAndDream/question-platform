import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const questionBanksRoot = path.resolve('public/question-banks')
const bankConfigsRoot = path.join(questionBanksRoot, 'banks')
const externalAssetPattern = /^(https?:|data:|blob:)/i

const normalizePath = (value) => {
  const parts = []
  for (const segment of value.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

const collectBankConfigs = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectBankConfigs(entryPath)
    return entry.name.endsWith('.json') ? [entryPath] : []
  })

const collectImageSources = (value, sources = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectImageSources(item, sources)
  } else if (value && typeof value === 'object') {
    if (value.type === 'image' && typeof value.src === 'string') sources.push(value.src)
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'src') collectImageSources(child, sources)
    }
  }
  return sources
}

const missingAssets = []
let imageReferenceCount = 0
let svgReferenceCount = 0

for (const configFile of collectBankConfigs(bankConfigsRoot)) {
  const configPath = normalizePath(path.relative(questionBanksRoot, configFile))
  const config = JSON.parse(readFileSync(configFile, 'utf8'))
  const configDirectory = path.posix.dirname(configPath)

  for (const source of collectImageSources(config.questions)) {
    imageReferenceCount += 1
    if (externalAssetPattern.test(source)) continue
    if (path.posix.extname(source).toLowerCase() === '.svg') svgReferenceCount += 1

    const resolvedPath = normalizePath(`${configDirectory}/${config.assetsBase ?? ''}/${source}`)
    const absolutePath = path.join(questionBanksRoot, ...resolvedPath.split('/'))
    if (!existsSync(absolutePath)) {
      missingAssets.push({ configPath, source, resolvedPath })
    }
  }
}

if (missingAssets.length > 0) {
  console.error('Question bank asset validation failed:')
  for (const asset of missingAssets) {
    console.error(`- ${asset.configPath}: ${asset.source} -> ${asset.resolvedPath}`)
  }
  process.exitCode = 1
} else {
  console.log(
    `Validated ${imageReferenceCount} image references (${svgReferenceCount} SVG); all local assets exist.`,
  )
}
