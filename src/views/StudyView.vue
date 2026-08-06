<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestionCard from '@/components/QuestionCard.vue'
import QuestionNavigator from '@/components/QuestionNavigator.vue'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useRecordStore } from '@/stores/recordStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { AnswerStatus, StudyMode } from '@/types/question'
import { progressKey } from '@/utils/answer'

const props = defineProps<{ libraryId: string; bankId: string }>()
const route = useRoute()
const router = useRouter()
const libraries = useLibraryStore()
const session = useSessionStore()
const preferences = usePreferencesStore()
const records = useRecordStore()

const modeFromRoute = computed<StudyMode>(() => route.query.mode === 'memorize' ? 'memorize' : 'practice')
const bank = computed(() => session.loadedBank)
const currentStatus = computed<AnswerStatus>(() => {
  if (session.mode === 'memorize') return 'correct'
  return session.currentProgress?.status ?? 'unanswered'
})
const currentRecorded = computed(() => {
  if (!bank.value || !session.currentQuestion) return false
  return records.isRecorded(bank.value, session.currentQuestion)
})

const getStatus = (questionId: string): AnswerStatus => {
  if (!bank.value) return 'unanswered'
  const key = progressKey(bank.value.libraryId, bank.value.bank.id, questionId)
  return session.progressByQuestion[key]?.status ?? 'unanswered'
}

const initialize = async (): Promise<void> => {
  await Promise.all([libraries.initialize(), preferences.initialize(), records.initialize()])
  const found = libraries.findBank(props.libraryId, props.bankId)
  if (!found) {
    await router.replace('/')
    return
  }
  await session.openBank(found, modeFromRoute.value)
}

onMounted(initialize)
watch(() => [props.libraryId, props.bankId], initialize)
watch(modeFromRoute, (mode) => session.setMode(mode))

const switchMode = async (mode: StudyMode): Promise<void> => {
  await router.replace({ query: { ...route.query, mode } })
}

const syncRecordedSnapshot = async (): Promise<void> => {
  if (!bank.value || !session.currentQuestion || !records.isRecorded(bank.value, session.currentQuestion)) return
  await records.add(bank.value, session.currentQuestion, session.currentProgress)
}

const selectOption = async (optionId: string): Promise<void> => {
  const question = session.currentQuestion
  if (!question || session.mode === 'memorize') return
  if (question.type === 'multiple') {
    await session.toggleOption(optionId)
    await syncRecordedSnapshot()
    return
  }
  const result = await session.answerImmediately(optionId)
  await syncRecordedSnapshot()
  if (preferences.preferences.autoNext && result === 'correct' && session.currentIndex < session.questions.length - 1) {
    setTimeout(() => session.next(), 450)
  }
}

const submit = async (): Promise<void> => {
  const result = await session.submit()
  await syncRecordedSnapshot()
  if (preferences.preferences.autoNext && result === 'correct' && session.currentIndex < session.questions.length - 1) {
    setTimeout(() => session.next(), 450)
  }
}

const resetCurrent = async (): Promise<void> => {
  await session.resetCurrent()
  await syncRecordedSnapshot()
}

const toggleRecord = async (): Promise<void> => {
  if (!bank.value || !session.currentQuestion) return
  await records.toggle(bank.value, session.currentQuestion, session.currentProgress)
}
</script>

<template>
  <div v-if="bank && session.currentQuestion" class="study-layout">
    <div class="study-main">
      <section class="study-toolbar card-panel">
        <div>
          <RouterLink to="/" class="back-link">← 返回题库</RouterLink>
          <h1>{{ bank.bank.name }}</h1>
        </div>
        <div class="toolbar-controls">
          <div class="segmented-control" aria-label="答题模式">
            <button :class="{ active: session.mode === 'practice' }" type="button" @click="switchMode('practice')">练习模式</button>
            <button :class="{ active: session.mode === 'memorize' }" type="button" @click="switchMode('memorize')">背题模式</button>
          </div>
          <label class="toggle-label">
            <input
              type="checkbox"
              :checked="preferences.preferences.recordMode"
              @change="preferences.setRecordMode(($event.target as HTMLInputElement).checked)"
            />
            <span>记录模式</span>
          </label>
        </div>
      </section>

      <section class="progress-strip">
        <span>正确 {{ session.statistics.correct }}</span>
        <span>错误 {{ session.statistics.incorrect }}</span>
        <span>未答 {{ session.statistics.unanswered }}</span>
        <div class="progress-track">
          <i :style="{ width: `${((session.statistics.correct + session.statistics.incorrect) / Math.max(session.statistics.total, 1)) * 100}%` }" />
        </div>
      </section>

      <QuestionCard
        :bank="bank"
        :question="session.currentQuestion"
        :index="session.currentIndex"
        :total="session.questions.length"
        :mode="session.mode"
        :selected-option-ids="session.draftSelection"
        :submitted="session.submitted"
        :status="currentStatus"
        :recorded="currentRecorded"
        :record-mode="preferences.preferences.recordMode"
        @select="selectOption"
        @submit="submit"
        @reset="resetCurrent"
        @toggle-record="toggleRecord"
      />

      <div class="study-footer-actions">
        <button class="secondary-button" type="button" :disabled="session.currentIndex === 0" @click="session.previous">上一题</button>
        <span>{{ session.currentIndex + 1 }} / {{ session.questions.length }}</span>
        <button class="primary-button" type="button" :disabled="session.currentIndex >= session.questions.length - 1" @click="session.next">下一题</button>
      </div>
    </div>

    <QuestionNavigator
      :questions="session.questions"
      :current-index="session.currentIndex"
      :get-status="getStatus"
      @select="session.goTo"
    />
  </div>
  <div v-else class="empty-state">正在准备题目…</div>
</template>
