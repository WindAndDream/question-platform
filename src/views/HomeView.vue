<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import type { LoadedBank, LoadedLibrary, StudyMode } from '@/types/question'

const router = useRouter()
const store = useLibraryStore()
const preferences = usePreferencesStore()
const zipInput = ref<HTMLInputElement>()
const jsonInput = ref<HTMLInputElement>()
const directoryInput = ref<HTMLInputElement>()
const message = ref('')
const importing = ref(false)

const questionCount = computed(() =>
  store.libraries.reduce(
    (sum, library) => sum + library.banks.reduce((bankSum, item) => bankSum + item.bank.questions.length, 0),
    0,
  ),
)

const runImport = async (action: () => Promise<LoadedLibrary>): Promise<void> => {
  importing.value = true
  message.value = ''
  try {
    const library = await action()
    message.value = `已导入“${library.name}”，包含 ${library.banks.length} 个题库。`
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : '导入失败'
  } finally {
    importing.value = false
  }
}

const importFolder = async (): Promise<void> => {
  if (window.showDirectoryPicker) await runImport(() => store.importFromFolder())
  else directoryInput.value?.click()
}

const handleZip = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await runImport(() => store.importFromZip(file))
  ;(event.target as HTMLInputElement).value = ''
}

const handleFiles = async (event: Event): Promise<void> => {
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  if (files.length > 0) await runImport(() => store.importFromJson(files))
  ;(event.target as HTMLInputElement).value = ''
}

const start = (bank: LoadedBank, mode: StudyMode): void => {
  void router.push({
    name: 'study',
    params: { libraryId: bank.libraryId, bankId: bank.bank.id },
    query: { mode },
  })
}

const removeLibrary = async (library: LoadedLibrary): Promise<void> => {
  if (!confirm(`确定移除本地题库“${library.name}”吗？答题进度和记录题目不会自动删除。`)) return
  await store.removeLibrary(library.id)
}
</script>

<template>
  <section class="hero-section">
    <div>
      <span class="eyebrow">配置驱动的本地题库</span>
      <h1>把题目、图片与解析装进题包，随时背题与练习</h1>
      <p>支持判断题、单选题、多选题，题干、选项和解析均可混排图片。所有答题进度与记录保存在浏览器 IndexedDB。</p>
    </div>
    <div class="hero-stat-grid">
      <div><strong>{{ store.libraries.length }}</strong><span>题库集合</span></div>
      <div><strong>{{ store.bankCount }}</strong><span>配套题库</span></div>
      <div><strong>{{ questionCount }}</strong><span>可用题目</span></div>
    </div>
  </section>

  <section class="import-panel card-panel">
    <div>
      <h2>导入本地题包</h2>
      <p>推荐选择包含 <code>manifest.json</code>、<code>banks/</code> 和 <code>assets/</code> 的文件夹或 ZIP。</p>
    </div>
    <div class="button-row">
      <button class="primary-button" type="button" :disabled="importing" @click="importFolder">选择题包文件夹</button>
      <button class="secondary-button" type="button" :disabled="importing" @click="zipInput?.click()">导入 ZIP</button>
      <button class="secondary-button" type="button" :disabled="importing" @click="jsonInput?.click()">导入单个 JSON</button>
    </div>
    <p v-if="message" class="inline-message">{{ message }}</p>
    <input ref="zipInput" hidden type="file" accept=".zip,application/zip" @change="handleZip" />
    <input ref="jsonInput" hidden type="file" accept=".json,application/json" @change="handleFiles" />
    <input ref="directoryInput" hidden type="file" webkitdirectory multiple @change="handleFiles" />
  </section>

  <section class="section-heading">
    <div>
      <span class="eyebrow">题库列表</span>
      <h2>选择配套题目</h2>
    </div>
  </section>

  <div v-if="store.loading" class="empty-state">正在加载题库…</div>
  <div v-else-if="store.error" class="empty-state error-state">{{ store.error }}</div>
  <div v-else class="library-list">
    <section v-for="library in store.libraries" :key="library.id" class="library-card card-panel">
      <header>
        <div>
          <span class="source-chip">{{ library.sourceType === 'builtin' ? '内置' : '本地' }}</span>
          <h3>{{ library.name }}</h3>
          <p>{{ library.description || '暂无题库说明' }}</p>
        </div>
        <button v-if="library.sourceType !== 'builtin'" class="danger-text-button" type="button" @click="removeLibrary(library)">移除题包</button>
      </header>

      <div class="bank-grid">
        <article v-for="bank in library.banks" :key="bank.bank.id" class="bank-card">
          <div>
            <span class="bank-category">{{ bank.bank.category || '未分类' }}</span>
            <h4>{{ bank.bank.name }}</h4>
            <p>{{ bank.bank.description || bank.manifestItem.description || '暂无说明' }}</p>
          </div>
          <dl>
            <div><dt>题目</dt><dd>{{ bank.bank.questions.length }}</dd></div>
            <div><dt>版本</dt><dd>{{ bank.bank.version }}</dd></div>
          </dl>
          <div class="button-row compact">
            <button class="primary-button" type="button" @click="start(bank, preferences.preferences.defaultStudyMode)">
              按默认模式开始
            </button>
            <button class="secondary-button" type="button" @click="start(bank, 'practice')">练习</button>
            <button class="secondary-button" type="button" @click="start(bank, 'memorize')">背题</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
