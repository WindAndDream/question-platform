<script setup lang="ts">
import DataSafetyPanel from '@/components/settings/DataSafetyPanel.vue'
import { usePreferencesStore } from '@/stores/preferencesStore'

const store = usePreferencesStore()
</script>

<template>
  <section class="section-heading page-title">
    <div>
      <span class="eyebrow">使用偏好</span>
      <h1>问答配置</h1>
      <p>这些设置会保存到当前浏览器的 IndexedDB。</p>
    </div>
  </section>

  <DataSafetyPanel />

  <section class="settings-list card-panel">
    <label class="setting-row">
      <span>
        <strong>记录模式</strong>
        <small>开启后，答题页面显示“记录本题”按钮，可建立专项复习题库。</small>
      </span>
      <input
        type="checkbox"
        :checked="store.preferences.recordMode"
        @change="store.setRecordMode(($event.target as HTMLInputElement).checked)"
      />
    </label>

    <label class="setting-row">
      <span>
        <strong>默认学习模式</strong>
        <small>从题库页进入时仍可单独选择练习或背题模式。</small>
      </span>
      <select
        :value="store.preferences.defaultStudyMode"
        @change="store.setDefaultStudyMode(($event.target as HTMLSelectElement).value as 'practice' | 'memorize')"
      >
        <option value="practice">练习模式</option>
        <option value="memorize">背题模式</option>
      </select>
    </label>

    <label class="setting-row">
      <span>
        <strong>答对后自动下一题</strong>
        <small>仅在练习模式中生效，答错时仍停留并显示正确答案与解析。</small>
      </span>
      <input
        type="checkbox"
        :checked="store.preferences.autoNext"
        @change="store.setAutoNext(($event.target as HTMLInputElement).checked)"
      />
    </label>
  </section>

  <section class="card-panel schema-summary">
    <h2>题包设计原则</h2>
    <ul>
      <li>题干、选项与解析统一使用内容块，图片不是 HTML 字符串，而是结构化的 <code>image</code> 块。</li>
      <li>图片路径相对于题库 JSON 的 <code>assetsBase</code> 解析，文件夹和 ZIP 导入后都会保存到 IndexedDB。</li>
      <li>题目 ID、选项 ID、正确答案在导入时通过 Zod 校验，重复 ID 或不存在的答案会直接阻止导入。</li>
    </ul>
    <a class="secondary-button inline-button" href="/question-banks/README.md" target="_blank" rel="noreferrer">查看配置说明</a>
  </section>
</template>
