<script setup lang="ts">
import type { AnswerStatus } from '@/types/question'

defineProps<{ status: AnswerStatus }>()
</script>

<template>
  <span :class="['status-badge', `status-${status}`]">
    {{ status === 'correct' ? '回答正确' : status === 'incorrect' ? '回答错误' : '尚未作答' }}
  </span>
</template>
