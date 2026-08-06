<script setup lang="ts">
import { computed, ref } from 'vue'
import ContentRenderer from '@/components/ContentRenderer.vue'
import { downloadRecordedZip } from '@/services/exporter'
import { useRecordStore } from '@/stores/recordStore'

const store = useRecordStore()
const selectedKeys = ref<string[]>([])
const exporting = ref(false)
const message = ref('')
const allSelected = computed(() => store.records.length > 0 && selectedKeys.value.length === store.records.length)

const toggleAll = (): void => {
  selectedKeys.value = allSelected.value ? [] : store.records.map((record) => record.key)
}

const removeSelected = async (): Promise<void> => {
  if (selectedKeys.value.length === 0) return
  if (!confirm(`确定移除选中的 ${selectedKeys.value.length} 道记录题目吗？`)) return
  await store.remove(selectedKeys.value)
  selectedKeys.value = []
}

const exportRecords = async (includeState: boolean): Promise<void> => {
  exporting.value = true
  message.value = ''
  try {
    const target = selectedKeys.value.length > 0
      ? store.records.filter((record) => selectedKeys.value.includes(record.key))
      : store.records
    await downloadRecordedZip(target, includeState, includeState ? '记录题目-有状态' : '记录题目-无状态')
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : '导出失败'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="section-heading page-title">
    <div>
      <span class="eyebrow">IndexedDB 记录库</span>
      <h1>已记录题目</h1>
      <p>可批量选择、移除，也可导出为能够再次导入平台的 ZIP 题包。</p>
    </div>
  </section>

  <section class="record-toolbar card-panel">
    <label class="checkbox-label">
      <input type="checkbox" :checked="allSelected" @change="toggleAll" />
      全选（{{ selectedKeys.length }}/{{ store.records.length }}）
    </label>
    <div class="button-row compact">
      <button class="secondary-button" type="button" :disabled="exporting || store.records.length === 0" @click="exportRecords(false)">导出无状态题包</button>
      <button class="secondary-button" type="button" :disabled="exporting || store.records.length === 0" @click="exportRecords(true)">导出有状态题包</button>
      <button class="danger-button" type="button" :disabled="selectedKeys.length === 0" @click="removeSelected">批量移除</button>
    </div>
  </section>
  <p v-if="message" class="inline-message">{{ message }}</p>

  <div v-if="store.records.length === 0" class="empty-state">
    暂无记录题目。请在答题页面开启“记录模式”，再点击“记录本题”。
  </div>

  <div v-else class="record-list">
    <article v-for="record in store.records" :key="record.key" class="record-card card-panel">
      <label class="record-select">
        <input v-model="selectedKeys" type="checkbox" :value="record.key" />
      </label>
      <div class="record-content">
        <div class="record-meta">
          <span>{{ record.bankName }}</span>
          <span>{{ record.question.type }}</span>
          <span>{{ new Date(record.recordedAt).toLocaleString() }}</span>
        </div>
        <ContentRenderer
          :content="record.question.stem"
          :library-id="record.libraryId"
          :config-path="record.configPath"
          :assets-base="record.assetsBase"
        />
        <p class="record-answer">答案：{{ record.question.answer.join('、') }}</p>
      </div>
      <button class="danger-text-button" type="button" @click="store.remove([record.key])">移除</button>
    </article>
  </div>
</template>
