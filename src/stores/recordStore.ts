import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { appDb } from '@/db/appDb'
import type {
  LoadedBank,
  Question,
  QuestionProgress,
  RecordedQuestion,
} from '@/types/question'
import { progressKey } from '@/utils/answer'

export const useRecordStore = defineStore('records', () => {
  const records = ref<RecordedQuestion[]>([])
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref('')
  let initializationPromise: Promise<void> | undefined
  const recordKeySet = computed(
    () => new Set(records.value.map((record) => record.key)),
  )

  const load = async (force: boolean): Promise<void> => {
    if (!force && initialized.value) return
    if (initializationPromise) {
      await initializationPromise
      if (!force) return
    }

    initializationPromise = (async () => {
      loading.value = true
      error.value = ''
      try {
        records.value = await appDb.records.orderBy('recordedAt').reverse().toArray()
        initialized.value = true
      } catch (reason) {
        initialized.value = false
        error.value = reason instanceof Error ? reason.message : '记录题目读取失败'
        throw reason
      } finally {
        loading.value = false
        initializationPromise = undefined
      }
    })()
    return initializationPromise
  }

  const initialize = (): Promise<void> => load(false)
  const reload = (): Promise<void> => load(true)

  const isRecorded = (bank: LoadedBank, question: Question): boolean =>
    recordKeySet.value.has(
      progressKey(bank.libraryId, bank.bank.id, question.id),
    )

  const add = async (
    bank: LoadedBank,
    question: Question,
    progress?: QuestionProgress,
  ): Promise<void> => {
    const key = progressKey(bank.libraryId, bank.bank.id, question.id)
    const row: RecordedQuestion = {
      key,
      libraryId: bank.libraryId,
      libraryName: bank.libraryName,
      bankId: bank.bank.id,
      bankName: bank.bank.name,
      questionId: question.id,
      configPath: bank.configPath,
      ...(bank.bank.assetsBase ? { assetsBase: bank.bank.assetsBase } : {}),
      question: structuredClone(toRaw(question)),
      ...(progress ? { progress: structuredClone(toRaw(progress)) } : {}),
      recordedAt: new Date().toISOString(),
    }
    await appDb.records.put(row)
    records.value = [
      row,
      ...records.value.filter((record) => record.key !== key),
    ]
  }

  const remove = async (keys: string[]): Promise<void> => {
    if (keys.length === 0) return
    await appDb.records.bulkDelete(keys)
    const keySet = new Set(keys)
    records.value = records.value.filter((record) => !keySet.has(record.key))
  }

  const resetProgressForBank = async (
    libraryId: string,
    bankId: string,
  ): Promise<void> => {
    const updatedRows = records.value
      .filter(
        (record) =>
          record.libraryId === libraryId && record.bankId === bankId,
      )
      .map((record) => {
        const row = structuredClone(toRaw(record));
        delete row.progress;
        return row
      })

    if (updatedRows.length === 0) return

    await appDb.records.bulkPut(updatedRows)
    const updatedByKey = new Map(
      updatedRows.map((record) => [record.key, record]),
    )
    records.value = records.value.map(
      (record) => updatedByKey.get(record.key) ?? record,
    )
  }

  const toggle = async (
    bank: LoadedBank,
    question: Question,
    progress?: QuestionProgress,
  ): Promise<boolean> => {
    const key = progressKey(bank.libraryId, bank.bank.id, question.id)
    if (recordKeySet.value.has(key)) {
      await remove([key])
      return false
    }
    await add(bank, question, progress)
    return true
  }

  return {
    records,
    initialized,
    loading,
    error,
    recordKeySet,
    initialize,
    reload,
    isRecorded,
    add,
    remove,
    resetProgressForBank,
    toggle,
  }
})
