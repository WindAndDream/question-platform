import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { assetRegistry } from '@/services/assetRegistry'
import {
  importDirectory,
  importJsonFiles,
  importZip,
  loadBuiltinLibrary,
  loadStoredLibraries,
  removeStoredLibrary,
} from '@/services/libraryLoader'
import type { LoadedBank, LoadedLibrary } from '@/types/question'

export const useLibraryStore = defineStore('libraries', () => {
  const libraries = ref<LoadedLibrary[]>([])
  const loading = ref(false)
  const error = ref('')
  const initialized = ref(false)
  let initializationPromise: Promise<void> | undefined

  const bankCount = computed(() => libraries.value.reduce((sum, library) => sum + library.banks.length, 0))

  const initialize = async (): Promise<void> => {
    if (initialized.value) return
    if (initializationPromise) return initializationPromise
    initializationPromise = (async () => {
      loading.value = true
      error.value = ''
      try {
        const [builtin, stored] = await Promise.all([loadBuiltinLibrary(), loadStoredLibraries()])
        libraries.value = [builtin, ...stored.filter((item) => item.id !== builtin.id)]
        initialized.value = true
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : '题库初始化失败'
        throw reason
      } finally {
        loading.value = false
        initializationPromise = undefined
      }
    })()
    return initializationPromise
  }

  const upsertLibrary = (library: LoadedLibrary): void => {
    const index = libraries.value.findIndex((item) => item.id === library.id)
    if (index >= 0) libraries.value.splice(index, 1, library)
    else libraries.value.push(library)
  }

  const importFromFolder = async (): Promise<LoadedLibrary> => {
    const library = await importDirectory()
    upsertLibrary(library)
    return library
  }

  const importFromZip = async (file: File): Promise<LoadedLibrary> => {
    const library = await importZip(file)
    upsertLibrary(library)
    return library
  }

  const importFromJson = async (files: File[]): Promise<LoadedLibrary> => {
    const library = await importJsonFiles(files)
    upsertLibrary(library)
    return library
  }

  const findBank = (libraryId: string, bankId: string): LoadedBank | undefined =>
    libraries.value.find((library) => library.id === libraryId)?.banks.find((item) => item.bank.id === bankId)

  const getLibrary = (libraryId: string): LoadedLibrary | undefined =>
    libraries.value.find((library) => library.id === libraryId)

  const removeLibrary = async (libraryId: string): Promise<void> => {
    const library = getLibrary(libraryId)
    if (!library || library.sourceType === 'builtin') return
    await removeStoredLibrary(libraryId)
    assetRegistry.revokeLibrary(libraryId)
    libraries.value = libraries.value.filter((item) => item.id !== libraryId)
  }

  return {
    libraries,
    loading,
    error,
    initialized,
    bankCount,
    initialize,
    importFromFolder,
    importFromZip,
    importFromJson,
    findBank,
    getLibrary,
    removeLibrary,
  }
})
