import type { AnswerStatus, Question } from '@/types/question'

const normalizedSet = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))

export const isSameAnswer = (selected: readonly string[], correct: readonly string[]): boolean => {
  const left = normalizedSet(selected)
  const right = normalizedSet(correct)
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export const evaluateAnswer = (question: Question, selected: readonly string[]): AnswerStatus => {
  if (selected.length === 0) return 'unanswered'
  return isSameAnswer(selected, question.answer) ? 'correct' : 'incorrect'
}

export const progressKey = (libraryId: string, bankId: string, questionId: string): string =>
  `${libraryId}::${bankId}::${questionId}`
