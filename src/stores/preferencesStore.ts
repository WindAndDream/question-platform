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
  let initializationPromise: Promise<void> | undefined

  const initialize = async (): Promise<void> => {
    if (initialized.value) return
    if (initializationPromise) return initializationPromise
    initializationPromise = (async () => {
      preferences.value = (await appDb.preferences.get('preferences')) ?? defaults()
      initialized.value = true
      initializationPromise = undefined
    })()
    return initializationPromise
  }

  const persist = async (): Promise<void> => {
    preferences.value.updatedAt = new Date().toISOString()
    await appDb.preferences.put({ ...preferences.value })
  }

  const setRecordMode = async (enabled: boolean): Promise<void> => {
    preferences.value.recordMode = enabled
    await persist()
  }

  const setDefaultStudyMode = async (mode: StudyMode): Promise<void> => {
    preferences.value.defaultStudyMode = mode
    await persist()
  }

  const setAutoNext = async (enabled: boolean): Promise<void> => {
    preferences.value.autoNext = enabled
    await persist()
  }

  return { preferences, initialized, initialize, setRecordMode, setDefaultStudyMode, setAutoNext }
})
