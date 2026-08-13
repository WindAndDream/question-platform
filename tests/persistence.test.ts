import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { appDb } from '@/db/appDb'
import { createUserDataBackup, restoreUserDataBackup } from '@/services/userDataBackup'
import { useRecordStore } from '@/stores/recordStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { LoadedBank, QuestionProgress } from '@/types/question'
import { progressKey } from '@/utils/answer'

const bank: LoadedBank = {
  libraryId: 'library-1',
  libraryName: '测试题库集合',
  manifestItem: {
    id: 'bank-1',
    name: '测试题库',
    file: 'banks/test.json',
  },
  bank: {
    schemaVersion: 1,
    id: 'bank-1',
    name: '测试题库',
    version: '1.0.0',
    questions: [
      {
        id: 'q1',
        type: 'single',
        stem: '请选择 A',
        options: [
          { id: 'A', content: 'A' },
          { id: 'B', content: 'B' },
        ],
        answer: ['A'],
      },
    ],
  },
  configPath: 'banks/test.json',
}

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-12T08:00:00.000Z'))
  await appDb.delete()
  await appDb.open()
  setActivePinia(createPinia())
})

afterAll(async () => {
  vi.useRealTimers()
  await appDb.delete()
})

describe('learning data persistence', () => {
  it('restores recorded questions and answer colors in a fresh session on the next day', async () => {
    const firstSession = useSessionStore()
    const firstRecords = useRecordStore()
    await firstSession.openBank(bank, 'practice')
    expect(await firstSession.answerImmediately('A')).toBe('correct')
    await firstRecords.add(bank, bank.bank.questions[0]!, firstSession.currentProgress)

    vi.setSystemTime(new Date('2026-08-13T08:00:00.000Z'))
    setActivePinia(createPinia())

    const restoredSession = useSessionStore()
    const restoredRecords = useRecordStore()
    await Promise.all([
      restoredSession.openBank(bank, 'practice'),
      restoredRecords.initialize(),
    ])

    expect(restoredSession.currentProgress?.status).toBe('correct')
    expect(restoredSession.statistics).toEqual({ correct: 1, incorrect: 0, unanswered: 0, total: 1 })
    expect(restoredRecords.records).toHaveLength(1)
    expect(restoredRecords.isRecorded(bank, bank.bank.questions[0]!)).toBe(true)
  })

  it('merges a backup without replacing newer progress already in the browser', async () => {
    const key = progressKey(bank.libraryId, bank.bank.id, 'q1')
    const olderProgress: QuestionProgress = {
      key,
      libraryId: bank.libraryId,
      bankId: bank.bank.id,
      questionId: 'q1',
      selectedOptionIds: ['B'],
      status: 'incorrect',
      answeredAt: '2026-08-12T08:00:00.000Z',
      updatedAt: '2026-08-12T08:00:00.000Z',
    }
    await appDb.progress.put(olderProgress)
    const backup = await createUserDataBackup()

    const newerProgress: QuestionProgress = {
      ...olderProgress,
      selectedOptionIds: ['A'],
      status: 'correct',
      answeredAt: '2026-08-13T08:00:00.000Z',
      updatedAt: '2026-08-13T08:00:00.000Z',
    }
    await appDb.progress.put(newerProgress)

    const summary = await restoreUserDataBackup(backup)

    expect(summary.progress).toBe(0)
    expect(await appDb.progress.get(key)).toEqual(newerProgress)
  })

  it('restores progress and recorded questions into an empty browser database', async () => {
    const sourceSession = useSessionStore()
    const sourceRecords = useRecordStore()
    await sourceSession.openBank(bank, 'practice')
    await sourceSession.answerImmediately('A')
    await sourceRecords.add(bank, bank.bank.questions[0]!, sourceSession.currentProgress)
    const backup = await createUserDataBackup()

    await appDb.delete()
    await appDb.open()
    const summary = await restoreUserDataBackup(backup)
    setActivePinia(createPinia())

    const targetSession = useSessionStore()
    const targetRecords = useRecordStore()
    await Promise.all([targetSession.openBank(bank, 'practice'), targetRecords.initialize()])

    expect(summary.progress).toBe(1)
    expect(summary.records).toBe(1)
    expect(targetSession.currentProgress?.status).toBe('correct')
    expect(targetRecords.isRecorded(bank, bank.bank.questions[0]!)).toBe(true)
  })

  it('does not show an answer as saved when IndexedDB rejects the write', async () => {
    const session = useSessionStore()
    await session.openBank(bank, 'practice')
    vi.spyOn(appDb.progress, 'put').mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(session.answerImmediately('A')).rejects.toThrow('quota exceeded')

    expect(session.currentProgress).toBeUndefined()
    expect(session.submitted).toBe(false)
    expect(session.draftSelection).toEqual([])
    expect(session.statistics.correct).toBe(0)
  })
})
