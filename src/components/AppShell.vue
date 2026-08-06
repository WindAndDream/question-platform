<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const navItems = [
  { to: '/', label: '题库', icon: '▦' },
  { to: '/records', label: '记录', icon: '★' },
  { to: '/export', label: '导出', icon: '⇩' },
  { to: '/settings', label: '设置', icon: '⚙' },
]
const isStudy = computed(() => route.name === 'study')
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">⚡</span>
        <span>
          <strong>电工题库训练平台</strong>
          <small>本地题包 · 离线记录 · 图片题支持</small>
        </span>
      </RouterLink>
      <nav class="desktop-nav" aria-label="主导航">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
          <span>{{ item.icon }}</span>{{ item.label }}
        </RouterLink>
      </nav>
    </header>

    <main :class="['page-container', { 'study-container': isStudy }]">
      <slot />
    </main>

    <nav class="mobile-nav" aria-label="移动端导航">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">
        <span>{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </RouterLink>
    </nav>
  </div>
</template>
