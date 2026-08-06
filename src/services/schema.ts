import { z } from 'zod'

const textBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().min(1),
  alt: z.string().default('题目图片'),
  caption: z.string().optional(),
  maxWidth: z.string().optional(),
})

const noteBlockSchema = z.object({
  type: z.literal('note'),
  title: z.string().optional(),
  text: z.string(),
})

export const contentBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  imageBlockSchema,
  noteBlockSchema,
])

export const richContentSchema = z.union([
  z.string(),
  z.array(contentBlockSchema).min(1),
])

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  content: richContentSchema,
})

export const exportedQuestionStateSchema = z.object({
  selectedOptionIds: z.array(z.string()),
  status: z.enum(['unanswered', 'correct', 'incorrect']),
  answeredAt: z.string().optional(),
})

export const questionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['single', 'multiple', 'judgement']),
    stem: richContentSchema,
    options: z.array(questionOptionSchema).optional(),
    answer: z.array(z.string()).min(1),
    explanation: richContentSchema.optional(),
    tags: z.array(z.string()).optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    source: z.string().optional(),
    state: exportedQuestionStateSchema.optional(),
  })
  .superRefine((question, context) => {
    if (question.type !== 'judgement' && (!question.options || question.options.length < 2)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: '单选题和多选题至少需要两个选项',
      })
    }

    const optionIds = question.type === 'judgement'
      ? (question.options?.map((option) => option.id) ?? ['true', 'false'])
      : (question.options?.map((option) => option.id) ?? [])
    const uniqueOptionIds = new Set(optionIds)
    if (uniqueOptionIds.size !== optionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: '同一道题的选项 ID 不能重复',
      })
    }

    if (question.type === 'judgement' && (uniqueOptionIds.size !== 2 || !uniqueOptionIds.has('true') || !uniqueOptionIds.has('false'))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: '判断题自定义选项时必须使用 true 和 false 两个 ID',
      })
    }

    for (const answer of question.answer) {
      if (!uniqueOptionIds.has(answer)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answer'],
          message: `答案 ${answer} 不存在于选项中`,
        })
      }
    }

    if (new Set(question.answer).size !== question.answer.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answer'],
        message: '正确答案不能重复',
      })
    }

    if (question.type !== 'multiple' && question.answer.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answer'],
        message: '单选题和判断题只能有一个正确答案',
      })
    }
  })

export const questionBankSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    version: z.string().min(1),
    category: z.string().optional(),
    assetsBase: z.string().optional(),
    questions: z.array(questionSchema).min(1),
  })
  .superRefine((bank, context) => {
    const ids = new Set<string>()
    bank.questions.forEach((question, index) => {
      if (ids.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions', index, 'id'],
          message: `题目 ID 重复：${question.id}`,
        })
      }
      ids.add(question.id)
    })
  })

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  libraryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  banks: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        file: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .min(1),
}).superRefine((manifest, context) => {
  const ids = new Set<string>()
  const files = new Set<string>()
  manifest.banks.forEach((bank, index) => {
    if (ids.has(bank.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['banks', index, 'id'], message: `题库 ID 重复：${bank.id}` })
    }
    if (files.has(bank.file)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['banks', index, 'file'], message: `题库文件重复：${bank.file}` })
    }
    ids.add(bank.id)
    files.add(bank.file)
  })
})
