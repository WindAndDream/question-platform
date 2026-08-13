import { ref } from 'vue'
import { defineStore } from 'pinia'
import { appDb } from '@/db/appDb'
import type { AppPreferences, StudyMode } from '@/types/question'

const defaults = (): AppPreferences => ({
  id: 'preferences',
  recordMode: false,
  defaultStudyMode: 'practice',
  autoNext: false,
  updatedAt: new Date().toISOString(),
})

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<AppPreferences>(defaults())
  const initialized = ref(false)
  const error = ref('')
  let initializationPromise: Promise<void> | undefined

  const load = async (force: boolean): Promise<void> => {
    if (!force && initialized.value) return
    if (initializationPromise) {
      await initializationPromise
      if (!force) return
    }

    initializationPromise = (async () => {
      error.value = ''
      try {
        preferences.value = (await appDb.preferences.get('preferences')) ?? defaults()
        initialized.value = true
      } catch (reason) {
        initialized.value = false
        error.value = reason instanceof Error ? reason.message : '偏好设置读取失败'
        throw reason
      } finally {
        initializationPromise = undefined
      }
    })()
    return initializationPromise
  }

  const initialize = (): Promise<void> => load(false)
  const reload = (): Promise<void> => load(true)

  const persist = async (changes: Partial<AppPreferences>): Promise<void> => {
    const next: AppPreferences = {
      ...preferences.value,
      ...changes,
      id: 'preferences',
      updatedAt: new Date().toISOString(),
    }
    await appDb.preferences.put(next)
    preferences.value = next
  }

  const setRecordMode = async (enabled: boolean): Promise<void> => {
    await persist({ recordMode: enabled })
  }

  const setDefaultStudyMode = async (mode: StudyMode): Promise<void> => {
    await persist({ defaultStudyMode: mode })
  }

  const setAutoNext = async (enabled: boolean): Promise<void> => {
    await persist({ autoNext: enabled })
  }

  return {
    preferences,
    initialized,
    error,
    initialize,
    reload,
    setRecordMode,
    setDefaultStudyMode,
    setAutoNext,
  }
})
