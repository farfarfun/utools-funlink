<script setup>
import { nextTick, ref } from 'vue'
import { initials } from '../lib/core.mjs'
import { safeColor } from '../composables/useFunLink.js'

const emit = defineEmits(['save'])
const dialog = ref(null)
const editor = ref(null)
const bookmark = ref(null)
const original = ref('')

function open(value) {
  bookmark.value = value
  original.value = value.note || ''
  if (!dialog.value.open) dialog.value.showModal()
  nextTick(() => {
    editor.value.innerHTML = original.value || '<p></p>'
    editor.value.focus()
  })
}

function close() {
  const content = editor.value?.innerHTML || ''
  if (bookmark.value && content !== original.value) emit('save', bookmark.value.id, content === '<p><br></p>' ? '' : content)
  dialog.value?.close()
}

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    close()
  }
  if (event.key === 'Escape') event.preventDefault()
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="note-dialog" aria-label="card-note-modal" @cancel.prevent @keydown="handleKeydown">
    <template v-if="bookmark">
      <header class="note-dialog-header">
        <button type="button" class="note-card-title">
          <span class="note-avatar" :style="{ backgroundColor: safeColor(bookmark.color), fontSize: `${(bookmark.iconSize || 16) * 0.6}px` }">
            <img v-if="bookmark.iconType === 'image' && bookmark.iconData" :src="bookmark.iconData" alt="" />
            <template v-else>{{ bookmark.icon || initials(bookmark.title) }}</template>
          </span>
          <span>{{ bookmark.title }}</span>
        </button>
        <span class="note-description">{{ bookmark.description }}</span>
        <button type="button" class="note-close" aria-label="关闭" @click="close">×</button>
      </header>
      <div ref="editor" class="note-editor prose" contenteditable="true" role="textbox" aria-label="笔记内容" aria-multiline="true" spellcheck="true" />
      <footer class="note-footer">
        <div class="note-footer-spacer" />
        <div class="note-footer-content">
          <button type="button" title="暂未开放"><i class="iconfont icon-help" aria-hidden="true" /> 帮助</button>
          <span class="note-shortcuts"><i /><kbd>/</kbd> 菜单命令 <i /><kbd>esc</kbd> 或 <kbd>ctrl</kbd> + <kbd>s</kbd> 保存</span>
        </div>
      </footer>
    </template>
  </dialog>
</template>
