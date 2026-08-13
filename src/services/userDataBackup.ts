import { z } from 'zod'
import { appDb } from '@/db/appDb'
import { questionSchema } from '@/services/schema'
import type { AppPreferences, QuestionProgress, RecordedQuestion } from '@/types/question'

const answerStatusSchema = z.enum(['unanswered', 'correct', 'incorrect'])

const questionProgressSchema = z.object({
  key: z.string().min(1),
  libraryId: z.string().min(1),
  bankId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string()),
  status: answerStatusSchema,
  answeredAt: z.string().optional(),
  updatedAt: z.string().min(1),
})

const recordedQuestionSchema = z.object({
  key: z.string().min(1),
  libraryId: z.string().min(1),
  libraryName: z.string(),
  bankId: z.string().min(1),
  bankName: z.string(),
  questionId: z.string().min(1),
  configPath: z.string(),
  assetsBase: z.string().optional(),
  question: questionSchema,
  progress: questionProgressSchema.optional(),
  recordedAt: z.string().min(1),
})

const preferencesSchema = z.object({
  id: z.literal('preferences'),
  recordMode: z.boolean(),
  defaultStudyMode: z.enum(['memorize', 'practice']),
  autoNext: z.boolean(),
  updatedAt: z.string().min(1),
})

const userDataBackupSchema = z.object({
  schemaVersion: z.literal(1),
  appId: z.literal('electrician-question-platform'),
  exportedAt: z.string().min(1),
  progress: z.array(questionProgressSchema),
  records: z.array(recordedQuestionSchema),
  preferences: preferencesSchema.optional(),
})

export type UserDataBackup = z.infer<typeof userDataBackupSchema>

export interface RestoreSummary {
  progress: number
  records: number
  preferences: number
}

const timestamp = (value: string): number => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const selectNewerRows = <T extends { key: string }>(
  incoming: T[],
  existing: T[],
  getUpdatedAt: (row: T) => string,
): T[] => {
  const existingByKey = new Map(existing.map((row) => [row.key, row]))
  return incoming.filter((row) => {
    const current = existingByKey.get(row.key)
    return !current || timestamp(getUpdatedAt(row)) >= timestamp(getUpdatedAt(current))
  })
}

export const createUserDataBackup = async (): Promise<UserDataBackup> => {
  const [progress, records, preferences] = await Promise.all([
    appDb.progress.toArray(),
    appDb.records.toArray(),
    appDb.preferences.get('preferences'),
  ])

  return {
    schemaVersion: 1,
    appId: 'electrician-question-platform',
    exportedAt: new Date().toISOString(),
    progress,
    records,
    ...(preferences ? { preferences } : {}),
  }
}

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const downloadUserDataBackup = async (): Promise<void> => {
  const backup = await createUserDataBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  triggerDownload(blob, `电工题库-学习数据备份-${backup.exportedAt.slice(0, 10)}.json`)
}

export const restoreUserDataBackup = async (input: unknown): Promise<RestoreSummary> => {
  const backup = userDataBackupSchema.parse(input)
  const [existingProgress, existingRecords, existingPreferences] = await Promise.all([
    appDb.progress.toArray(),
    appDb.records.toArray(),
    appDb.preferences.get('preferences'),
  ])

  const progress = selectNewerRows<QuestionProgress>(backup.progress, existingProgress, (row) => row.updatedAt)
  const records = selectNewerRows<RecordedQuestion>(backup.records, existingRecords, (row) => row.recordedAt)
  const shouldRestorePreferences = Boolean(
    backup.preferences &&
    (!existingPreferences || timestamp(backup.preferences.updatedAt) >= timestamp(existingPreferences.updatedAt)),
  )

  await appDb.transaction('rw', appDb.progress, appDb.records, appDb.preferences, async () => {
    if (progress.length > 0) await appDb.progress.bulkPut(progress)
    if (records.length > 0) await appDb.records.bulkPut(records)
    if (shouldRestorePreferences && backup.preferences) await appDb.preferences.put(backup.preferences)
  })

  return {
    progress: progress.length,
    records: records.length,
    preferences: shouldRestorePreferences ? 1 : 0,
  }
}

export const restoreUserDataBackupFile = async (file: File): Promise<RestoreSummary> => {
  const input: unknown = JSON.parse(await file.text())
  return restoreUserDataBackup(input)
}
