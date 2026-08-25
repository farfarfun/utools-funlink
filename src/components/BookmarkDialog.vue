<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { initials, normalizeUrl } from '../lib/core.mjs'
import { safeColor } from '../composables/useFunLink.js'

const COLORS = ['#8480f9', '#2792ff', '#1fd88b', '#fdcd05', '#ff7ba2', '#98d517', '#ff7f1b', '#07b882']
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
const expanded = ref(false)
const error = ref('')
const form = reactive({})
const roots = computed(() => props.categories.filter(category => !category.parentId))
const childrenOf = id => props.categories.filter(category => category.parentId === id)
const selectedCategory = computed(() => form.categoryId === 'cat@default'
  ? { name: '收集箱' }
  : props.categories.find(category => category.id === form.categoryId))

function blankForm() {
  return {
    id: '', url: '', urls: [], title: '', description: '', categoryId: props.defaultCategoryId || 'cat@default',
    iconType: 'image', icon: '', color: COLORS[props.bookmarkCount % COLORS.length], iconData: '', iconSize: 16,
    browser: 'default', favorite: false, quick: false,
  }
}

function open(bookmark = null, insertAfterId = null) {
  editing.value = Boolean(bookmark?.id)
  afterId.value = insertAfterId
  error.value = ''
  Object.assign(form, blankForm(), bookmark || {})
  form.categoryId = bookmark?.categoryId || bookmark?.categoryIds?.[0] || props.defaultCategoryId || 'cat@default'
  form.urls = Array.isArray(bookmark?.urls) ? bookmark.urls.map(item => typeof item === 'string' ? item : item.value) : []
  form.color = safeColor(form.color)
  expanded.value = editing.value || /^(https?|ftp|file):\/\//i.test(form.url)
  if (!dialog.value.open) dialog.value.showModal()
}

function close() { dialog.value?.close() }

function addUrl() { form.urls.push('') }

function submit() {
  try {
    if (!form.title.trim()) throw new Error('网站名称不能为空')
    emit('save', {
      id: form.id,
      url: normalizeUrl(form.url),
      urls: form.urls.filter(Boolean),
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId || 'cat@default',
      iconType: form.iconType,
      icon: form.icon.trim() || initials(form.title),
      iconData: form.iconData,
      iconSize: form.iconSize,
      color: safeColor(form.color),
      browser: form.browser,
      favorite: form.favorite,
      quick: form.quick,
    }, afterId.value)
    close()
  } catch (caught) {
    error.value = caught.message
    nextTick(() => urlInput.value?.focus())
  }
}

function closeOnBackdrop(event) { if (event.target === dialog.value) close() }

watch(() => form.url, value => {
  expanded.value = editing.value || /^(https?|ftp|file):\/\//i.test(String(value || '').trim())
  if (expanded.value && !form.title && editing.value) form.title = ''
  error.value = ''
})

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="bookmark-dialog" @click="closeOnBackdrop" @cancel.prevent="close">
    <form @submit.prevent="submit">
      <header class="bookmark-dialog-header">
        <span class="bookmark-dialog-heading-icon"><i class="iconfont icon-card" aria-hidden="true" /></span>
        <h2>{{ editing ? '编辑卡片' : '添加卡片' }}</h2>
        <button type="button" class="bookmark-add-url" aria-label="打开多个网页" title="打开多个网页" @click="addUrl"><i class="iconfont icon-add" aria-hidden="true" /></button>
      </header>

      <div class="bookmark-dialog-body">
        <input ref="urlInput" v-model="form.url" class="bookmark-url-input" inputmode="url" placeholder="请输入网站地址" required />
        <input v-for="(_, index) in form.urls" :key="index" v-model="form.urls[index]" class="bookmark-url-input extra-url" inputmode="url" :placeholder="`请输入附加网址 ${index + 1}`" />

        <div class="web-edit-card" :class="{ skeleton: !expanded }">
          <template v-if="expanded">
            <span class="web-preview-icon" :class="{ empty: form.iconType === 'image' && !form.iconData }" :style="{ backgroundColor: form.iconType === 'text' ? form.color : '' }">
              <img v-if="form.iconType === 'image' && form.iconData" :src="form.iconData" alt="" />
              <template v-else-if="form.iconType === 'text'">{{ form.icon || initials(form.title) }}</template>
            </span>
            <div class="web-preview-fields">
              <label><span class="sr-only">网站名称</span><input v-model="form.title" maxlength="20" placeholder="请输入网站名称" required /><small>{{ form.title.length }} / 20</small></label>
              <label><span class="sr-only">网站简介</span><textarea v-model="form.description" maxlength="60" placeholder="请输入网站简介" /></label>
            </div>
          </template>
          <template v-else>
            <span class="skeleton-circle" />
            <span class="skeleton-lines"><i /><i /></span>
          </template>
        </div>

        <template v-if="expanded">
          <div class="bookmark-options-row">
            <label class="bookmark-category-field"><span><b>*</b> 所在分类</span>
              <div class="category-select">
                <span class="selected-tag">{{ selectedCategory?.name || '收集箱' }} <i>×</i></span>
                <span class="select-arrow">⌄</span>
                <select v-model="form.categoryId" aria-label="所在分类">
                  <option value="cat@default">收集箱</option>
                  <template v-for="root in roots" :key="root.id">
                    <option :value="root.id">{{ root.name }}</option>
                    <option v-for="child in childrenOf(root.id)" :key="child.id" :value="child.id">　{{ child.name }}</option>
                  </template>
                </select>
              </div>
            </label>
            <label class="bookmark-browser-field"><span>打开方式</span>
              <select v-model="form.browser" aria-label="打开方式">
                <option value="default">默认设置</option><option value="system">系统浏览器</option><option value="inner">内置浏览器</option>
                <option value="chrome">Google Chrome</option><option value="chrome-incognito">Google Chrome（无痕）</option>
                <option value="edge">Microsoft Edge</option><option value="edge-inprivate">Microsoft Edge（无痕）</option>
                <option value="safari">Safari</option><option value="firefox">Firefox</option>
              </select>
            </label>
          </div>
          <label class="quick-switch"><input v-model="form.quick" type="checkbox" /><span class="switch-control" aria-hidden="true" /><span>网页快开</span><i class="iconfont icon-help" title="支持从 uTools 主搜索框快速打开网页" /></label>
          <div class="form-error" role="alert">{{ error }}</div>
          <footer class="bookmark-dialog-footer"><button class="button" type="button" @click="close">取消</button><button class="button primary" type="submit">保存</button></footer>
        </template>
      </div>
    </form>
  </dialog>
</template>
