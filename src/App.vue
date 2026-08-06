<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useRecordStore } from '@/stores/recordStore'

const libraries = useLibraryStore()
const preferences = usePreferencesStore()
const records = useRecordStore()

onMounted(async () => {
  await Promise.all([libraries.initialize(), preferences.initialize(), records.initialize()])
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
