<script setup>
import { ref } from 'vue'

defineProps({ theme: { type: String, required: true } })
const emit = defineEmits(['theme', 'export', 'data-file', 'reset'])
const dialog = ref(null)
const restoreInput = ref(null)
const importInput = ref(null)

function open() { if (!dialog.value.open) dialog.value.showModal() }
function close() { dialog.value?.close() }
function closeOnBackdrop(event) { if (event.target === dialog.value) close() }
function choose(type) {
  const extensions = type === 'restore' ? ['json'] : ['html', 'htm']
  const content = window.funlink?.chooseTextFile?.(extensions)
  if (typeof content === 'string') emit('data-file', type, content)
  else (type === 'restore' ? restoreInput : importInput).value?.click()
}
async function readFile(type, event) {
  const file = event.target.files[0]
  if (file) emit('data-file', type, await file.text())
  event.target.value = ''
}
defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="modal settings-modal" @click="closeOnBackdrop">
    <form method="dialog">
      <div class="modal-header">
        <div><h2>设置</h2><p>外观与数据管理</p></div>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </div>
      <section class="settings-section">
        <h3>主题</h3>
        <div class="segmented">
          <label><input type="radio" name="theme" value="light" :checked="theme === 'light'" @change="emit('theme', 'light')" /><span>浅色</span></label>
          <label><input type="radio" name="theme" value="dark" :checked="theme === 'dark'" @change="emit('theme', 'dark')" /><span>深色</span></label>
          <label><input type="radio" name="theme" value="system" :checked="theme === 'system'" @change="emit('theme', 'system')" /><span>跟随系统</span></label>
        </div>
      </section>
      <section class="settings-section">
        <h3>数据管理</h3>
        <div class="settings-actions">
          <button class="button secondary" type="button" @click="emit('export')">导出备份</button>
          <button class="button secondary" type="button" @click="choose('restore')">恢复备份</button>
          <button class="button secondary" type="button" @click="choose('import')">导入浏览器书签</button>
        </div>
        <p>支持 FunLink JSON 备份，以及 Chrome、Edge、Firefox 导出的 HTML 书签。</p>
      </section>
      <section class="settings-section danger-zone">
        <h3>重置</h3>
        <button class="button danger" type="button" @click="emit('reset')">恢复示例数据</button>
      </section>
      <input ref="restoreInput" type="file" accept="application/json,.json" hidden @change="readFile('restore', $event)" />
      <input ref="importInput" type="file" accept="text/html,.html,.htm" hidden @change="readFile('import', $event)" />
    </form>
  </dialog>
</template>
