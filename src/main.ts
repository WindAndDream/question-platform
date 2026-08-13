import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { ensurePersistentStorage } from '@/services/storagePersistence'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useRecordStore } from '@/stores/recordStore'
import './assets/main.css'

const bootstrap = async (): Promise<void> => {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia).use(router)

  const initializationResults = await Promise.allSettled([
    useLibraryStore(pinia).initialize(),
    usePreferencesStore(pinia).initialize(),
    useRecordStore(pinia).initialize(),
    ensurePersistentStorage(),
  ])

  for (const result of initializationResults) {
    if (result.status === 'rejected') console.error('应用数据初始化失败：', result.reason)
  }

  app.mount('#app')
}

void bootstrap()
