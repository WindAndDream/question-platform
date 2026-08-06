import { describe, expect, it } from 'vitest'
import { evaluateAnswer, isSameAnswer } from '@/utils/answer'
import type { Question } from '@/types/question'

const multiple: Question = {
  id: 'm1',
  type: 'multiple',
  stem: '测试',
  options: [
    { id: 'A', content: 'A' },
    { id: 'B', content: 'B' },
    { id: 'C', content: 'C' },
  ],
  answer: ['A', 'C'],
}

describe('answer evaluation', () => {
  it('compares multiple answers as sets', () => {
    expect(isSameAnswer(['C', 'A'], ['A', 'C'])).toBe(true)
    expect(isSameAnswer(['A'], ['A', 'C'])).toBe(false)
  })

  it('returns unanswered, correct and incorrect', () => {
    expect(evaluateAnswer(multiple, [])).toBe('unanswered')
    expect(evaluateAnswer(multiple, ['C', 'A'])).toBe('correct')
    expect(evaluateAnswer(multiple, ['A', 'B'])).toBe('incorrect')
  })
})
