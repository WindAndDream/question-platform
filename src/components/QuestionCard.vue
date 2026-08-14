<script setup lang="ts">
import { computed } from 'vue'
import ContentRenderer from '@/components/ContentRenderer.vue'
import QuestionStatusBadge from '@/components/QuestionStatusBadge.vue'
import type { AnswerStatus, LoadedBank, Question, StudyMode } from '@/types/question'
import { getQuestionOptions } from '@/utils/content'

const props = defineProps<{
  bank: LoadedBank
  question: Question
  index: number
  total: number
  mode: StudyMode
  selectedOptionIds: string[]
  submitted: boolean
  status: AnswerStatus
  recorded: boolean
  recordMode: boolean
}>()

const emit = defineEmits<{
  select: [optionId: string]
  submit: []
  reset: []
  toggleRecord: []
}>()

defineSlots<{
  navigation(): unknown
}>()

const options = computed(() => getQuestionOptions(props.question))
const typeLabel = computed(() => ({ single: '单选题', multiple: '多选题', judgement: '判断题' })[props.question.type])
const showResult = computed(() => props.mode === 'memorize' || props.submitted)

const optionClass = (optionId: string): Record<string, boolean> => {
  const selected = props.selectedOptionIds.includes(optionId)
  const correct = props.question.answer.includes(optionId)
  return {
    selected,
    correct: showResult.value && correct,
    wrong: showResult.value && selected && !correct,
    locked: showResult.value,
  }
}

const optionHint = (optionId: string): string => {
  if (!showResult.value) return ''
  if (props.question.answer.includes(optionId)) return '正确答案'
  if (props.selectedOptionIds.includes(optionId)) return '你的选择'
  return ''
}
</script>

<template>
  <article class="question-card">
    <header class="question-header">
      <div class="question-meta">
        <span class="type-chip">{{ typeLabel }}</span>
        <span>第 {{ index + 1 }} / {{ total }} 题</span>
        <span v-if="question.tags?.length" class="tags">{{ question.tags.join(' · ') }}</span>
      </div>
      <button
        v-if="recordMode"
        type="button"
        :class="['icon-button', { active: recorded }]"
        :aria-pressed="recorded"
        @click="emit('toggleRecord')"
      >
        {{ recorded ? '★ 已记录' : '☆ 记录本题' }}
      </button>
    </header>

    <section class="question-stem">
      <ContentRenderer
        :content="question.stem"
        :library-id="bank.libraryId"
        :config-path="bank.configPath"
        :assets-base="bank.bank.assetsBase"
      />
    </section>

    <section class="option-list" :aria-label="`${typeLabel}选项`">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :class="['option-item', optionClass(option.id)]"
        :disabled="showResult"
        @click="emit('select', option.id)"
      >
        <span class="option-key">{{ option.id }}</span>
        <ContentRenderer
          class="option-content"
          :content="option.content"
          :library-id="bank.libraryId"
          :config-path="bank.configPath"
          :assets-base="bank.bank.assetsBase"
        />
        <span v-if="optionHint(option.id)" class="option-hint">{{ optionHint(option.id) }}</span>
      </button>
    </section>

    <div v-if="mode === 'practice' && question.type === 'multiple' && !submitted" class="question-actions">
      <button class="primary-button" type="button" :disabled="selectedOptionIds.length === 0" @click="emit('submit')">
        提交答案
      </button>
    </div>

    <slot name="navigation" />

    <section v-if="showResult" class="answer-panel">
      <div class="answer-summary">
        <QuestionStatusBadge :status="mode === 'memorize' ? 'correct' : status" />
        <span>正确答案：<strong>{{ question.answer.join('、') }}</strong></span>
        <button v-if="mode === 'practice'" class="text-button" type="button" @click="emit('reset')">重新作答</button>
      </div>
      <div class="explanation">
        <h3>答案解析</h3>
        <ContentRenderer
          :content="question.explanation || '暂无解析。'"
          :library-id="bank.libraryId"
          :config-path="bank.configPath"
          :assets-base="bank.bank.assetsBase"
        />
      </div>
    </section>
  </article>
</template>
