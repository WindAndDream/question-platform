<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { downloadBankJson, downloadBankZip, getQuestionsByStatus } from '@/services/exporter'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { LoadedBank } from '@/types/question'

const libraries = useLibraryStore()
const session = useSessionStore()
const selectedLibraryId = ref('')
const selectedBankId = ref('')
const exporting = ref(false)
const message = ref('')

const selectedLibrary = computed(() => libraries.getLibrary(selectedLibraryId.value))
const availableBanks = computed(() => selectedLibrary.value?.banks ?? [])
const selectedBank = computed<LoadedBank | undefined>(() => libraries.findBank(selectedLibraryId.value, selectedBankId.value))

const selectDefaults = (): void => {
  const firstLibrary = libraries.libraries[0]
  if (!selectedLibraryId.value && firstLibrary) selectedLibraryId.value = firstLibrary.id
  const firstBank = libraries.getLibrary(selectedLibraryId.value)?.banks[0]
  if (firstBank && !selectedBankId.value) selectedBankId.value = firstBank.bank.id
}

onMounted(async () => {
  await libraries.initialize()
  selectDefaults()
})

watch(selectedLibraryId, () => {
  selectedBankId.value = availableBanks.value[0]?.bank.id ?? ''
})

watch(selectedBank, async (bank) => {
  if (bank) await session.openBank(bank, 'practice')
}, { immediate: true })

const counts = computed(() => {
  const bank = selectedBank.value
  if (!bank) return { all: 0, correct: 0, incorrect: 0, unanswered: 0 }
  return {
    all: bank.bank.questions.length,
    correct: getQuestionsByStatus(bank, session.progressByQuestion, 'correct').length,
    incorrect: getQuestionsByStatus(bank, session.progressByQuestion, 'incorrect').length,
    unanswered: getQuestionsByStatus(bank, session.progressByQuestion, 'unanswered').length,
  }
})

const exportGroup = async (
  status: 'all' | 'correct' | 'incorrect' | 'unanswered',
  includeState: boolean,
  format: 'json' | 'zip',
): Promise<void> => {
  const bank = selectedBank.value
  if (!bank) return
  const questions = getQuestionsByStatus(bank, session.progressByQuestion, status)
  if (questions.length === 0) {
    message.value = '当前分类没有可导出的题目。'
    return
  }
  const labelMap = { all: '全部题目', correct: '正确题目', incorrect: '错误题目', unanswered: '未选择题目' }
  const fileBaseName = `${bank.bank.name}-${labelMap[status]}-${includeState ? '有状态' : '无状态'}`
  exporting.value = true
  message.value = ''
  try {
    if (format === 'json') downloadBankJson(bank, questions, session.progressByQuestion, { includeState, fileBaseName })
    else await downloadBankZip(bank, questions, session.progressByQuestion, { includeState, fileBaseName })
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : '导出失败'
  } finally {
    exporting.value = false
  }
}

const groups = computed(() => [
  { status: 'all' as const, title: '导出当前默认题目', description: '导出当前题库的全部题目。', count: counts.value.all },
  { status: 'incorrect' as const, title: '导出错误题目', description: '仅导出练习模式中回答错误的题目。', count: counts.value.incorrect },
  { status: 'correct' as const, title: '导出正确题目', description: '仅导出已经回答正确的题目。', count: counts.value.correct },
  { status: 'unanswered' as const, title: '导出未选择题目', description: '导出尚未作答或已重置的题目。', count: counts.value.unanswered },
])
</script>

<template>
  <section class="section-heading page-title">
    <div>
      <span class="eyebrow">可移植题包</span>
      <h1>题目导出中心</h1>
      <p>“有状态”会写入已选选项与正误；“无状态”只保留原始题目。含图片时推荐导出 ZIP。</p>
    </div>
  </section>

  <section class="card-panel export-selector">
    <label>
      <span>题库集合</span>
      <select v-model="selectedLibraryId">
        <option v-for="library in libraries.libraries" :key="library.id" :value="library.id">{{ library.name }}</option>
      </select>
    </label>
    <label>
      <span>配套题库</span>
      <select v-model="selectedBankId">
        <option v-for="bank in availableBanks" :key="bank.bank.id" :value="bank.bank.id">{{ bank.bank.name }}</option>
      </select>
    </label>
  </section>

  <p v-if="message" class="inline-message">{{ message }}</p>

  <div class="export-grid">
    <article v-for="group in groups" :key="group.status" class="export-card card-panel">
      <div>
        <span class="export-count">{{ group.count }} 题</span>
        <h2>{{ group.title }}</h2>
        <p>{{ group.description }}</p>
      </div>
      <div class="export-actions">
        <div>
          <strong>ZIP 题包</strong>
          <button class="primary-button" type="button" :disabled="exporting || group.count === 0" @click="exportGroup(group.status, false, 'zip')">无状态</button>
          <button class="secondary-button" type="button" :disabled="exporting || group.count === 0" @click="exportGroup(group.status, true, 'zip')">有状态</button>
        </div>
        <div>
          <strong>仅 JSON</strong>
          <button class="text-button" type="button" :disabled="exporting || group.count === 0" @click="exportGroup(group.status, false, 'json')">无状态 JSON</button>
          <button class="text-button" type="button" :disabled="exporting || group.count === 0" @click="exportGroup(group.status, true, 'json')">有状态 JSON</button>
        </div>
      </div>
    </article>
  </div>
</template>
