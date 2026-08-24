<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { initials, normalizeUrl } from '../lib/core.mjs'
import { displayHost, safeColor } from '../composables/useFunLink.js'

const COLORS = ['#16b8c7', '#2563eb', '#7c3aed', '#db2777', '#e85d3f', '#0f9f6e', '#64748b']
const props = defineProps({
  categories: { type: Array, required: true },
  defaultCategoryId: { type: String, required: true },
  bookmarkCount: { type: Number, required: true },
})
const emit = defineEmits(['save'])
const dialog = ref(null)
const urlInput = ref(null)
const afterId = ref(null)
const editing = ref(false)
const error = ref('')
const form = reactive({})
const roots = computed(() => props.categories.filter(category => !category.parentId))
const childrenOf = id => props.categories.filter(category => category.parentId === id)
const previewText = computed(() => form.icon || initials(form.title) || 'FL')

function blankForm() {
  return {
    id: '', url: '', title: '', description: '', categoryId: props.defaultCategoryId,
    iconType: 'text', icon: '', color: COLORS[props.bookmarkCount % COLORS.length],
    browser: '', favorite: false, quick: false,
  }
}

function open(bookmark = null, insertAfterId = null) {
  editing.value = Boolean(bookmark?.id)
  afterId.value = insertAfterId
  error.value = ''
  Object.assign(form, blankForm(), bookmark || {})
  form.color = safeColor(form.color)
  if (!dialog.value.open) dialog.value.showModal()
  nextTick(() => urlInput.value?.focus())
}

function close() {
  dialog.value?.close()
}

function normalizeOnBlur() {
  if (!form.url.trim()) return
  try {
    form.url = normalizeUrl(form.url)
    if (!form.title) form.title = displayHost(form.url).replace(/^www\./, '')
    if (!form.icon) form.icon = initials(form.title)
    error.value = ''
  } catch (caught) {
    error.value = caught.message
  }
}

function submit() {
  try {
    const bookmark = {
      id: form.id,
      url: normalizeUrl(form.url),
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      iconType: form.iconType,
      icon: form.icon.trim() || initials(form.title),
      color: safeColor(form.color),
      browser: form.browser,
      favorite: form.favorite,
      quick: form.quick,
    }
    emit('save', bookmark, afterId.value)
    close()
  } catch (caught) {
    error.value = caught.message
    nextTick(() => urlInput.value?.focus())
  }
}

function closeOnBackdrop(event) {
  if (event.target === dialog.value) close()
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="modal bookmark-modal" @click="closeOnBackdrop">
    <form method="dialog" @submit.prevent="submit">
      <div class="modal-header">
        <div class="modal-title-icon" :style="{ background: form.color }">
          <img v-if="form.iconType === 'image' && form.icon" :src="form.icon" alt="" />
          <template v-else>{{ previewText }}</template>
        </div>
        <div><h2>{{ editing ? '编辑卡片' : '添加卡片' }}</h2><p>保存到你的网址导航</p></div>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </div>

      <label>网址 <input ref="urlInput" v-model="form.url" type="url" placeholder="https://example.com" required @blur="normalizeOnBlur" /></label>
      <div class="form-row">
        <label>名称 <input v-model="form.title" maxlength="30" required /></label>
        <label>分类
          <select v-model="form.categoryId">
            <option value="">收集箱</option>
            <template v-for="root in roots" :key="root.id">
              <option :value="root.id">{{ root.name }}</option>
              <option v-for="child in childrenOf(root.id)" :key="child.id" :value="child.id">　{{ child.name }}</option>
            </template>
          </select>
        </label>
      </div>
      <label>简介 <input v-model="form.description" maxlength="80" /></label>
      <div class="form-row icon-row">
        <fieldset>
          <legend>图标</legend>
          <div class="segmented">
            <label><input v-model="form.iconType" type="radio" value="text" /><span>文字</span></label>
            <label><input v-model="form.iconType" type="radio" value="image" /><span>图片</span></label>
          </div>
        </fieldset>
        <label>{{ form.iconType === 'image' ? '图片地址' : '图标文字' }}
          <input v-model="form.icon" :maxlength="form.iconType === 'image' ? undefined : 4" :placeholder="form.iconType === 'image' ? 'https://.../logo.png' : 'FL'" />
        </label>
        <label>图标颜色 <input v-model="form.color" type="color" /></label>
      </div>
      <label>指定浏览器
        <select v-model="form.browser">
          <option value="">系统默认</option><option value="chrome">Chrome</option><option value="chrome-incognito">Chrome 无痕</option>
          <option value="edge">Edge</option><option value="edge-inprivate">Edge InPrivate</option><option value="firefox">Firefox</option><option value="safari">Safari</option>
        </select>
      </label>
      <div class="check-row">
        <label><input v-model="form.favorite" type="checkbox" /> 加入常用</label>
        <label><input v-model="form.quick" type="checkbox" /> 网页快开</label>
      </div>
      <div class="form-error" role="alert">{{ error }}</div>
      <div class="modal-actions">
        <button class="button secondary" type="button" @click="close">取消</button>
        <button class="button primary" type="submit">保存</button>
      </div>
    </form>
  </dialog>
</template>
