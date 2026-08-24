<script setup>
import { computed, nextTick, ref } from 'vue'

const props = defineProps({
  categories: { type: Array, required: true },
  categoryCount: { type: Function, required: true },
})
const emit = defineEmits(['add', 'action'])
const dialog = ref(null)
const nameInput = ref(null)
const newName = ref('')
const parentId = ref('')
const roots = computed(() => props.categories.filter(category => !category.parentId))
const childrenOf = id => props.categories.filter(category => category.parentId === id)

function open() {
  if (!dialog.value.open) dialog.value.showModal()
  nextTick(() => nameInput.value?.focus())
}
function close() { dialog.value?.close() }
function submit() {
  if (!newName.value.trim()) return
  emit('add', newName.value, parentId.value)
  newName.value = ''
  nextTick(() => nameInput.value?.focus())
}
function closeOnBackdrop(event) { if (event.target === dialog.value) close() }
defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="modal category-modal" @click="closeOnBackdrop">
    <form method="dialog" @submit.prevent="submit">
      <div class="modal-header">
        <div><h2>分类管理</h2><p>一级分类显示在顶部，二级分类显示在侧边。</p></div>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </div>
      <div class="category-add-row">
        <label>分类名称 <input ref="nameInput" v-model="newName" maxlength="12" required /></label>
        <label>上级分类
          <select v-model="parentId"><option value="">无，创建一级分类</option><option v-for="root in roots" :key="root.id" :value="root.id">{{ root.name }}</option></select>
        </label>
        <button class="button primary" type="submit">添加</button>
      </div>
      <div class="category-list">
        <section v-for="root in roots" :key="root.id" class="category-group">
          <div class="category-row">
            <span class="category-level" aria-hidden="true">•</span><strong>{{ root.name }}</strong><span>{{ categoryCount(root.id) }}</span>
            <div class="category-actions">
              <button type="button" aria-label="上移" :disabled="roots.indexOf(root) === 0" @click="emit('action', root.id, 'up')">↑</button>
              <button type="button" aria-label="下移" :disabled="roots.indexOf(root) === roots.length - 1" @click="emit('action', root.id, 'down')">↓</button>
              <button type="button" @click="emit('action', root.id, 'rename')">重命名</button>
              <button class="danger-text" type="button" @click="emit('action', root.id, 'delete')">删除</button>
            </div>
          </div>
          <div class="category-children">
            <div v-for="(child, index) in childrenOf(root.id)" :key="child.id" class="category-row">
              <span class="category-level" aria-hidden="true">↳</span><strong>{{ child.name }}</strong><span>{{ categoryCount(child.id) }}</span>
              <div class="category-actions">
                <button type="button" aria-label="上移" :disabled="index === 0" @click="emit('action', child.id, 'up')">↑</button>
                <button type="button" aria-label="下移" :disabled="index === childrenOf(root.id).length - 1" @click="emit('action', child.id, 'down')">↓</button>
                <button type="button" @click="emit('action', child.id, 'rename')">重命名</button>
                <button class="danger-text" type="button" @click="emit('action', child.id, 'delete')">删除</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </form>
  </dialog>
</template>
