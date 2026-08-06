import JSZip, { type JSZipObject } from 'jszip'
import { appDb } from '@/db/appDb'
import { manifestSchema, questionBankSchema } from '@/services/schema'
import type {
  LoadedBank,
  LoadedLibrary,
  QuestionBank,
  QuestionLibraryManifest,
  StoredAsset,
  StoredLibrary,
} from '@/types/question'
import { normalizePath } from '@/utils/path'

interface VirtualFile {
  path: string
  blob: Blob
}

const readJson = async <T>(blob: Blob, parser: { parse: (value: unknown) => T }): Promise<T> => {
  const text = await blob.text()
  return parser.parse(JSON.parse(text))
}

const buildLoadedLibrary = (
  manifest: QuestionLibraryManifest,
  banks: Array<{ path: string; bank: QuestionBank }>,
  sourceType: LoadedLibrary['sourceType'],
): LoadedLibrary => {
  const bankByPath = new Map(banks.map((item) => [normalizePath(item.path), item.bank]))
  const loadedBanks: LoadedBank[] = manifest.banks.map((manifestItem) => {
    const configPath = normalizePath(manifestItem.file)
    const bank = bankByPath.get(configPath)
    if (!bank) throw new Error(`清单中的题库文件不存在：${manifestItem.file}`)
    if (bank.id !== manifestItem.id) {
      throw new Error(`清单题库 ID 与文件不一致：${manifestItem.id} / ${bank.id}`)
    }
    return {
      libraryId: manifest.libraryId,
      libraryName: manifest.name,
      manifestItem,
      bank,
      configPath,
    }
  })

  return {
    id: manifest.libraryId,
    name: manifest.name,
    description: manifest.description,
    sourceType,
    banks: loadedBanks,
    assetPaths: [],
  }
}

const parseVirtualFiles = async (
  files: VirtualFile[],
  sourceType: Exclude<LoadedLibrary['sourceType'], 'builtin' | 'indexeddb'>,
): Promise<LoadedLibrary> => {
  const fileMap = new Map(files.map((file) => [normalizePath(file.path), file.blob]))
  const manifestPath = [...fileMap.keys()].find((path) => path === 'manifest.json' || path.endsWith('/manifest.json'))

  if (!manifestPath) {
    const jsonFiles = [...fileMap.entries()].filter(([path]) => path.toLowerCase().endsWith('.json'))
    if (jsonFiles.length !== 1) {
      throw new Error('未找到 manifest.json；无清单导入时只能选择一个题库 JSON 文件')
    }
    const [path, blob] = jsonFiles[0]!
    const bank = await readJson<QuestionBank>(blob, questionBankSchema)
    const manifest: QuestionLibraryManifest = {
      schemaVersion: 1,
      libraryId: `library-${bank.id}`,
      name: bank.name,
      description: bank.description,
      banks: [{ id: bank.id, name: bank.name, file: path }],
    }
    return persistImportedLibrary(manifest, [{ path, bank }], files, sourceType)
  }

  const rootPrefix = manifestPath.slice(0, -'manifest.json'.length)
  const manifest = await readJson<QuestionLibraryManifest>(fileMap.get(manifestPath)!, manifestSchema)
  const banks: Array<{ path: string; bank: QuestionBank }> = []

  for (const item of manifest.banks) {
    const path = normalizePath(`${rootPrefix}${item.file}`)
    const blob = fileMap.get(path)
    if (!blob) throw new Error(`题库文件不存在：${item.file}`)
    banks.push({ path: normalizePath(item.file), bank: await readJson<QuestionBank>(blob, questionBankSchema) })
  }

  const relativeFiles = files.map((file) => ({
    path: normalizePath(file.path.startsWith(rootPrefix) ? file.path.slice(rootPrefix.length) : file.path),
    blob: file.blob,
  }))
  return persistImportedLibrary(manifest, banks, relativeFiles, sourceType)
}

const persistImportedLibrary = async (
  manifest: QuestionLibraryManifest,
  banks: Array<{ path: string; bank: QuestionBank }>,
  files: VirtualFile[],
  sourceType: Exclude<LoadedLibrary['sourceType'], 'builtin' | 'indexeddb'>,
): Promise<LoadedLibrary> => {
  const stored: StoredLibrary = {
    id: manifest.libraryId,
    name: manifest.name,
    description: manifest.description,
    sourceType,
    manifest,
    banks,
    importedAt: new Date().toISOString(),
  }

  const assets: StoredAsset[] = files
    .filter((file) => !file.path.toLowerCase().endsWith('.json'))
    .map((file) => ({
      key: `${manifest.libraryId}::${normalizePath(file.path)}`,
      libraryId: manifest.libraryId,
      path: normalizePath(file.path),
      blob: file.blob,
    }))

  await appDb.transaction('rw', appDb.libraries, appDb.assets, async () => {
    await appDb.assets.where('libraryId').equals(manifest.libraryId).delete()
    await appDb.libraries.put(stored)
    if (assets.length > 0) await appDb.assets.bulkPut(assets)
  })

  const loaded = buildLoadedLibrary(manifest, banks, sourceType)
  loaded.assetPaths = assets.map((asset) => asset.path)
  return loaded
}

export const loadBuiltinLibrary = async (): Promise<LoadedLibrary> => {
  const manifestResponse = await fetch('/question-banks/manifest.json')
  if (!manifestResponse.ok) throw new Error('内置题库清单加载失败')
  const manifest: QuestionLibraryManifest = manifestSchema.parse(await manifestResponse.json())
  const banks: Array<{ path: string; bank: QuestionBank }> = []

  for (const item of manifest.banks) {
    const response = await fetch(`/question-banks/${item.file}`)
    if (!response.ok) throw new Error(`内置题库加载失败：${item.file}`)
    banks.push({ path: item.file, bank: questionBankSchema.parse(await response.json()) })
  }

  return buildLoadedLibrary(manifest, banks, 'builtin')
}

const walkDirectory = async (handle: FileSystemDirectoryHandle, prefix = ''): Promise<VirtualFile[]> => {
  const files: VirtualFile[] = []
  for await (const entry of handle.values()) {
    const path = normalizePath(`${prefix}/${entry.name}`)
    if (entry.kind === 'file') files.push({ path, blob: await entry.getFile() })
    else files.push(...(await walkDirectory(entry, path)))
  }
  return files
}

export const importDirectory = async (): Promise<LoadedLibrary> => {
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持文件夹选择，请使用 Chrome/Edge，或改用 ZIP 导入')
  }
  const handle = await window.showDirectoryPicker()
  return parseVirtualFiles(await walkDirectory(handle), 'folder')
}

export const importZip = async (file: File): Promise<LoadedLibrary> => {
  const zip = await JSZip.loadAsync(file)
  const files: VirtualFile[] = []
  for (const [path, entry] of Object.entries(zip.files) as Array<[string, JSZipObject]>) {
    if (entry.dir) continue
    files.push({ path: normalizePath(path), blob: await entry.async('blob') })
  }
  return parseVirtualFiles(files, 'zip')
}

export const importJsonFiles = async (files: File[]): Promise<LoadedLibrary> => {
  return parseVirtualFiles(files.map((file) => ({ path: file.webkitRelativePath || file.name, blob: file })), 'json')
}

export const loadStoredLibraries = async (): Promise<LoadedLibrary[]> => {
  const stored = await appDb.libraries.orderBy('importedAt').reverse().toArray()
  return Promise.all(
    stored.map(async (library) => {
      const loaded = buildLoadedLibrary(library.manifest, library.banks, 'indexeddb')
      loaded.assetPaths = (await appDb.assets.where('libraryId').equals(library.id).toArray()).map((asset) => asset.path)
      return loaded
    }),
  )
}

export const removeStoredLibrary = async (libraryId: string): Promise<void> => {
  await appDb.transaction('rw', appDb.libraries, appDb.assets, async () => {
    await appDb.libraries.delete(libraryId)
    await appDb.assets.where('libraryId').equals(libraryId).delete()
  })
}
