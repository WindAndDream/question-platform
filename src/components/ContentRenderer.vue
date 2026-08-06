<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { assetRegistry } from '@/services/assetRegistry'
import type { RichContent } from '@/types/question'
import { normalizeContent } from '@/utils/content'

const props = defineProps<{
  content?: RichContent
  libraryId: string
  configPath: string
  assetsBase?: string
}>()

const resolvedImages = ref<Record<number, string>>({})
let generation = 0

const resolveImages = async (): Promise<void> => {
  const currentGeneration = ++generation
  const entries = await Promise.all(
    normalizeContent(props.content).map(async (block, index) => {
      if (block.type !== 'image') return [index, ''] as const
      const resolved = await assetRegistry.resolve(
        props.libraryId,
        props.configPath,
        props.assetsBase,
        block.src,
      )
      return [index, resolved] as const
    }),
  )
  if (currentGeneration === generation) resolvedImages.value = Object.fromEntries(entries)
}

watch(() => [props.content, props.libraryId, props.configPath, props.assetsBase], resolveImages, {
  immediate: true,
  deep: true,
})

onBeforeUnmount(() => {
  generation += 1
})
</script>

<template>
  <div class="rich-content">
    <template v-for="(block, index) in normalizeContent(content)" :key="index">
      <p v-if="block.type === 'text'" class="content-text">{{ block.text }}</p>
      <figure v-else-if="block.type === 'image'" class="content-image-wrap">
        <img
          v-if="resolvedImages[index]"
          class="content-image"
          :src="resolvedImages[index]"
          :alt="block.alt"
          :style="{ maxWidth: block.maxWidth ?? '100%' }"
        />
        <div v-else class="image-missing">图片资源未找到：{{ block.src }}</div>
        <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
      </figure>
      <aside v-else class="content-note">
        <strong v-if="block.title">{{ block.title }}</strong>
        <p>{{ block.text }}</p>
      </aside>
    </template>
  </div>
</template>
