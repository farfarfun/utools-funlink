<script setup>
import { nextTick, ref } from 'vue'

const emit = defineEmits(['save'])
const dialog = ref(null)
const textarea = ref(null)
const bookmarkId = ref('')
const title = ref('')
const note = ref('')

function open(bookmark) {
  bookmarkId.value = bookmark.id
  title.value = `${bookmark.title} · 笔记`
  note.value = bookmark.note || ''
  if (!dialog.value.open) dialog.value.showModal()
  nextTick(() => textarea.value?.focus())
}
function close() { dialog.value?.close() }
function submit() {
  emit('save', bookmarkId.value, note.value)
  close()
}
function closeOnBackdrop(event) { if (event.target === dialog.value) close() }
function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    submit()
  }
}
defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="modal note-modal" @click="closeOnBackdrop" @keydown="handleKeydown">
    <form method="dialog" @submit.prevent="submit">
      <div class="modal-header">
        <div><h2>{{ title }}</h2><p>自动保存在网址卡片中</p></div>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </div>
      <label class="note-field"><span class="sr-only">笔记内容</span><textarea ref="textarea" v-model="note" placeholder="记录账号提示、使用说明或待办事项..." spellcheck="true" /></label>
      <div class="modal-actions">
        <span class="keyboard-help"><kbd>Ctrl</kbd> + <kbd>S</kbd> 保存</span>
        <button class="button secondary" type="button" @click="close">取消</button>
        <button class="button primary" type="submit">保存笔记</button>
      </div>
    </form>
  </dialog>
</template>
