<script setup>
import { ref } from 'vue'
import logoUrl from '../../logo.png'

defineProps({ modelValue: { type: String, required: true }, theme: { type: String, required: true } })
const emit = defineEmits(['update:modelValue', 'home', 'add', 'cycle-theme', 'settings'])
const searchInput = ref(null)

defineExpose({ focusSearch: () => searchInput.value?.focus() })
</script>

<template>
  <header class="topbar">
    <button class="brand" type="button" aria-label="返回全部网址" @click="emit('home')">
      <img :src="logoUrl" alt="" width="30" height="30" />
      <span>FunLink</span>
    </button>

    <label class="search-field">
      <span class="sr-only">搜索网址</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        ref="searchInput"
        type="search"
        :value="modelValue"
        placeholder="搜索卡片"
        autocomplete="off"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <kbd>/</kbd>
    </label>

    <div class="top-actions">
      <button class="icon-button" type="button" title="添加网址" aria-label="添加网址" @click="emit('add')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <button class="icon-button" type="button" title="切换主题" aria-label="切换主题" @click="emit('cycle-theme')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      </button>
      <button class="icon-button" type="button" title="设置" aria-label="打开设置" @click="emit('settings')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>
      </button>
    </div>
  </header>
</template>
