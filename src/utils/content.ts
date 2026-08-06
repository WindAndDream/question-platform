import type { ContentBlock, Question, QuestionOption, RichContent } from '@/types/question'

export const defaultJudgementOptions = (): QuestionOption[] => [
  { id: 'true', content: '对' },
  { id: 'false', content: '错' },
]

export const getQuestionOptions = (question: Question): QuestionOption[] =>
  question.type === 'judgement' && !question.options
    ? defaultJudgementOptions()
    : (question.options ?? [])

export const normalizeContent = (content?: RichContent): ContentBlock[] => {
  if (!content) return []
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content
}

export const collectImageSources = (content?: RichContent): string[] =>
  normalizeContent(content)
    .filter((block): block is Extract<ContentBlock, { type: 'image' }> => block.type === 'image')
    .map((block) => block.src)

export const collectQuestionImageSources = (question: Question): string[] => {
  const sources = [
    ...collectImageSources(question.stem),
    ...collectImageSources(question.explanation),
  ]
  for (const option of getQuestionOptions(question)) {
    sources.push(...collectImageSources(option.content))
  }
  return [...new Set(sources)]
}
