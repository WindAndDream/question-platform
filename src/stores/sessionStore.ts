import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { appDb } from '@/db/appDb'
import type { AnswerStatus, LoadedBank, Question, QuestionProgress, StudyMode } from '@/types/question'
import { evaluateAnswer, progressKey } from '@/utils/answer'

export const useSessionStore = defineStore('session', () => {
  const loadedBank = ref<LoadedBank>()
  const currentIndex = ref(0)
  const mode = ref<StudyMode>('practice')
  const progressByQuestion = ref<Record<string, QuestionProgress>>({})
  const draftSelection = ref<string[]>([])
  const submitted = ref(false)

  const questions = computed(() => loadedBank.value?.bank.questions ?? [])
  const currentQuestion = computed<Question | undefined>(() => questions.value[currentIndex.value])
  const currentProgress = computed<QuestionProgress | undefined>(() => {
    const bank = loadedBank.value
    const question = currentQuestion.value
    if (!bank || !question) return undefined
    return progressByQuestion.value[progressKey(bank.libraryId, bank.bank.id, question.id)]
  })

  const statistics = computed(() => {
    let correct = 0
    let incorrect = 0
    let unanswered = 0
    for (const question of questions.value) {
      const key = loadedBank.value
        ? progressKey(loadedBank.value.libraryId, loadedBank.value.bank.id, question.id)
        : ''
      const status = progressByQuestion.value[key]?.status ?? 'unanswered'
      if (status === 'correct') correct += 1
      else if (status === 'incorrect') incorrect += 1
      else unanswered += 1
    }
    return { correct, incorrect, unanswered, total: questions.value.length }
  })

  const restoreQuestionState = (): void => {
    if (mode.value === 'memorize') {
      draftSelection.value = [...(currentQuestion.value?.answer ?? [])]
      submitted.value = true
      return
    }
    draftSelection.value = [...(currentProgress.value?.selectedOptionIds ?? [])]
    submitted.value = currentProgress.value?.status !== undefined && currentProgress.value.status !== 'unanswered'
  }

  const openBank = async (bank: LoadedBank, studyMode: StudyMode, startIndex = 0): Promise<void> => {
    loadedBank.value = bank
    mode.value = studyMode
    currentIndex.value = Math.min(Math.max(startIndex, 0), Math.max(bank.bank.questions.length - 1, 0))
    const rows = await appDb.progress.where('[libraryId+bankId]').equals([bank.libraryId, bank.bank.id]).toArray()
    const rowMap = new Map(rows.map((row) => [row.key, row]))
    const importedRows: QuestionProgress[] = []
    for (const question of bank.bank.questions) {
      if (!question.state) continue
      const key = progressKey(bank.libraryId, bank.bank.id, question.id)
      if (rowMap.has(key)) continue
      const row: QuestionProgress = {
        key,
        libraryId: bank.libraryId,
        bankId: bank.bank.id,
        questionId: question.id,
        selectedOptionIds: [...question.state.selectedOptionIds],
        status: question.state.status,
        ...(question.state.answeredAt ? { answeredAt: question.state.answeredAt } : {}),
        updatedAt: new Date().toISOString(),
      }
      rowMap.set(key, row)
      importedRows.push(row)
    }
    if (importedRows.length > 0) await appDb.progress.bulkPut(importedRows)
    progressByQuestion.value = Object.fromEntries(rowMap)
    restoreQuestionState()
  }

  const setMode = (studyMode: StudyMode): void => {
    mode.value = studyMode
    restoreQuestionState()
  }

  const goTo = (index: number): void => {
    if (index < 0 || index >= questions.value.length) return
    currentIndex.value = index
    restoreQuestionState()
  }

  const next = (): void => goTo(currentIndex.value + 1)
  const previous = (): void => goTo(currentIndex.value - 1)

  const toggleOption = async (optionId: string): Promise<void> => {
    const question = currentQuestion.value
    if (!question || mode.value === 'memorize' || submitted.value) return

    if (question.type === 'multiple') {
      draftSelection.value = draftSelection.value.includes(optionId)
        ? draftSelection.value.filter((id) => id !== optionId)
        : [...draftSelection.value, optionId]
      await saveProgress('unanswered')
    } else {
      draftSelection.value = [optionId]
    }
  }

  const saveProgress = async (status: AnswerStatus): Promise<QuestionProgress | undefined> => {
    const bank = loadedBank.value
    const question = currentQuestion.value
    if (!bank || !question) return undefined
    const key = progressKey(bank.libraryId, bank.bank.id, question.id)
    const now = new Date().toISOString()
    const row: QuestionProgress = {
      key,
      libraryId: bank.libraryId,
      bankId: bank.bank.id,
      questionId: question.id,
      selectedOptionIds: [...draftSelection.value],
      status,
      updatedAt: now,
      ...(status === 'unanswered' ? {} : { answeredAt: now }),
    }
    progressByQuestion.value = { ...progressByQuestion.value, [key]: row }
    await appDb.progress.put(row)
    return row
  }

  const submit = async (): Promise<AnswerStatus> => {
    const question = currentQuestion.value
    if (!question) return 'unanswered'
    const status = evaluateAnswer(question, draftSelection.value)
    if (status === 'unanswered') return status
    submitted.value = true
    await saveProgress(status)
    return status
  }

  const answerImmediately = async (optionId: string): Promise<AnswerStatus> => {
    await toggleOption(optionId)
    return submit()
  }

  const resetCurrent = async (): Promise<void> => {
    const bank = loadedBank.value
    const question = currentQuestion.value
    if (!bank || !question) return
    const key = progressKey(bank.libraryId, bank.bank.id, question.id)
    delete progressByQuestion.value[key]
    progressByQuestion.value = { ...progressByQuestion.value }
    draftSelection.value = []
    submitted.value = false
    await appDb.progress.delete(key)
  }

  return {
    loadedBank,
    currentIndex,
    mode,
    progressByQuestion,
    draftSelection,
    submitted,
    questions,
    currentQuestion,
    currentProgress,
    statistics,
    openBank,
    setMode,
    goTo,
    next,
    previous,
    toggleOption,
    submit,
    answerImmediately,
    resetCurrent,
  }
})
