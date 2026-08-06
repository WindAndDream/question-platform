import { describe, expect, it } from 'vitest'
import { questionBankSchema } from '@/services/schema'

describe('question bank schema', () => {
  it('accepts a judgement question without explicit options', () => {
    const parsed = questionBankSchema.parse({
      schemaVersion: 1,
      id: 'bank',
      name: '题库',
      version: '1.0.0',
      questions: [{ id: 'q1', type: 'judgement', stem: '测试', answer: ['true'] }],
    })
    expect(parsed.questions).toHaveLength(1)
  })

  it('rejects an answer that is not present in options', () => {
    expect(() => questionBankSchema.parse({
      schemaVersion: 1,
      id: 'bank',
      name: '题库',
      version: '1.0.0',
      questions: [{
        id: 'q1',
        type: 'single',
        stem: '测试',
        options: [{ id: 'A', content: 'A' }, { id: 'B', content: 'B' }],
        answer: ['C'],
      }],
    })).toThrow()
  })
})
