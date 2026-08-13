<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue'
import { ensurePersistentStorage, type StoragePersistenceStatus } from '@/services/storagePersistence'
import {
  downloadUserDataBackup,
  restoreUserDataBackupFile,
} from '@/services/userDataBackup'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useRecordStore } from '@/stores/recordStore'

const preferences = usePreferencesStore()
const records = useRecordStore()
const backupInput = useTemplateRef<HTMLInputElement>('backupInput')
const persistenceStatus = shallowRef<StoragePersistenceStatus>()
const busy = shallowRef(false)
const message = shallowRef('')
const failed = shallowRef(false)
const currentOrigin = window.location.origin

onMounted(async () => {
  persistenceStatus.value = await ensurePersistentStorage()
})

const downloadBackup = async (): Promise<void> => {
  busy.value = true
  failed.value = false
  message.value = ''
  try {
    await downloadUserDataBackup()
    message.value = '完整学习数据备份已下载。'
  } catch (reason) {
    failed.value = true
    message.value = reason instanceof Error ? reason.message : '备份下载失败'
  } finally {
    busy.value = false
  }
}

const restoreBackup = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  busy.value = true
  failed.value = false
  message.value = ''
  try {
    const summary = await restoreUserDataBackupFile(file)
    await Promise.all([records.reload(), preferences.reload()])
    message.value = `恢复完成：${summary.progress} 条答题进度、${summary.records} 道记录题目。较新的现有数据未被覆盖。`
  } catch (reason) {
    failed.value = true
    message.value = reason instanceof Error ? `恢复失败：${reason.message}` : '恢复失败：备份文件无效'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card-panel data-safety-panel">
    <div>
      <span class="eyebrow">数据安全</span>
      <h2>备份与浏览器迁移</h2>
      <p>
        数据保存在当前浏览器配置中；Chrome、Edge、无痕窗口以及不同网址之间不会共享。
        当前数据地址：<code>{{ currentOrigin }}</code>
      </p>
      <p>备份包含答题进度、记录题目和偏好设置；自行导入的题包及其图片仍需单独保留。</p>
      <p v-if="persistenceStatus === 'persisted'" class="storage-status success-status">
        当前浏览器已授予持久存储，正常的空间回收不会清除此站点数据。
      </p>
      <p v-else-if="persistenceStatus === 'best-effort'" class="storage-status warning-status">
        当前浏览器未授予持久存储，建议定期下载完整备份。
      </p>
      <p v-else-if="persistenceStatus === 'unsupported'" class="storage-status warning-status">
        当前浏览器不支持持久存储申请，建议定期下载完整备份。
      </p>
    </div>
    <div class="button-row">
      <button class="primary-button" type="button" :disabled="busy" @click="downloadBackup">
        下载完整学习数据备份
      </button>
      <button class="secondary-button" type="button" :disabled="busy" @click="backupInput?.click()">
        从备份恢复
      </button>
      <input ref="backupInput" hidden type="file" accept=".json,application/json" @change="restoreBackup" />
    </div>
    <p v-if="message" :class="['inline-message', { 'error-message': failed }]">{{ message }}</p>
  </section>
</template>

<style scoped>
.data-safety-panel {
  display: grid;
  gap: 18px;
  margin-bottom: 22px;
  padding: 24px;
}

.data-safety-panel h2 {
  margin: 0.4rem 0;
}

.data-safety-panel p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
}

.storage-status {
  margin-top: 12px !important;
  font-weight: 700;
}

.success-status {
  color: var(--success) !important;
}

.warning-status {
  color: var(--warning) !important;
}

.error-message {
  background: var(--danger-soft);
  color: var(--danger) !important;
}
</style>
