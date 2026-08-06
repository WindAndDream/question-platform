<script setup lang="ts">
import type { AnswerStatus, Question } from '@/types/question'

const props = defineProps<{
  questions: Question[]
  currentIndex: number
  getStatus: (questionId: string) => AnswerStatus
}>()

const emit = defineEmits<{ select: [index: number] }>()
</script>

<template>
  <aside class="question-navigator">
    <div class="navigator-title">
      <strong>题目导航</strong>
      <span>{{ questions.length }} 题</span>
    </div>
    <div class="number-grid">
      <button
        v-for="(question, index) in questions"
        :key="question.id"
        type="button"
        :class="['number-button', getStatus(question.id), { current: index === currentIndex }]"
        :aria-label="`第 ${index + 1} 题，${getStatus(question.id)}`"
        @click="emit('select', index)"
      >
        {{ index + 1 }}
      </button>
    </div>
    <div class="navigator-legend">
      <span><i class="legend-dot correct" />正确</span>
      <span><i class="legend-dot incorrect" />错误</span>
      <span><i class="legend-dot unanswered" />未答</span>
    </div>
  </aside>
</template>
