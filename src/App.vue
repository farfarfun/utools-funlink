<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import BookmarkDialog from './components/BookmarkDialog.vue'
import BookmarkGrid from './components/BookmarkGrid.vue'
import CategoryDialog from './components/CategoryDialog.vue'
import ContextMenu from './components/ContextMenu.vue'
import NoteDialog from './components/NoteDialog.vue'
import SecondaryNavigation from './components/SecondaryNavigation.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { useFunLink } from './composables/useFunLink.js'

const funlink = useFunLink()
const {
  state, toast, roots, activeCategoryId, activeRootId, secondaryCategories, secondaryPosition,
  trashCount, currentBookmarks, defaultCategoryId,
} = funlink
const bookmarkDialog = ref(null)
const categoryDialog = ref(null)
const noteDialog = ref(null)
const settingsDialog = ref(null)
const draggedBookmarkId = ref(null)
const context = reactive({ visible: false, type: '', bookmark: null, x: 0, y: 0 })
const specialView = computed(() => ({
  inbox: { label: '收集箱', icon: 'icon-inbox' },
  quick: { label: '网页快开', icon: 'icon-fly' },
  trash: { label: '废纸篓', icon: 'icon-dust' },
}[state.value.currentView] || null))

const contextItems = computed(() => {
  if (context.type === 'category') return [{ action: 'manage', label: '管理分类', icon: 'icon-add-circle' }]
  const bookmark = context.bookmark
  if (!bookmark) return []
  return bookmark.deletedAt
    ? [{ action: 'restore', label: '恢复', icon: 'icon-back' }, { action: 'delete', label: '删除', icon: 'icon-delete' }]
    : [
        { action: 'append', label: '追加', icon: 'icon-add-circle' },
        { action: 'edit', label: '编辑', icon: 'icon-edit', divided: true },
        { action: 'quick', label: bookmark.quick ? '取消快开' : '网页快开', icon: bookmark.quick ? 'icon-quick-fill' : 'icon-quick', divided: true },
        { action: 'copy', label: '复制链接', icon: 'icon-remarks' },
        { action: 'move', label: '移到...', icon: 'icon-move', arrow: true },
        { action: 'trash', label: '移除', icon: 'icon-delete' },
      ]
})

function openContextMenu(bookmark, event) {
  const rect = event.currentTarget?.getBoundingClientRect?.()
  Object.assign(context, {
    visible: true,
    type: 'bookmark',
    bookmark,
    x: event.type === 'contextmenu' ? event.clientX : rect.right - 134,
    y: event.type === 'contextmenu' ? event.clientY : rect.bottom + 4,
  })
}

function openCategoryContextMenu(event) {
  Object.assign(context, { visible: true, type: 'category', bookmark: null, x: event.clientX, y: event.clientY })
}

function closeContextMenu() {
  context.visible = false
  context.type = ''
  context.bookmark = null
}

function handleContextAction(action) {
  const bookmark = context.bookmark
  closeContextMenu()
  if (action === 'manage') return categoryDialog.value.open()
  if (!bookmark) return
  if (action === 'append') bookmarkDialog.value.open(null, bookmark.id)
  if (action === 'edit') bookmarkDialog.value.open(bookmark)
  if (action === 'quick') funlink.toggleQuick(bookmark)
  if (action === 'copy') {
    if (window.utools?.copyText) window.utools.copyText(bookmark.url)
    else navigator.clipboard?.writeText(bookmark.url)
  }
  if (action === 'trash') funlink.moveToTrash(bookmark)
  if (action === 'restore') funlink.restoreBookmark(bookmark)
  if (action === 'delete') funlink.deleteBookmark(bookmark)
}

function handleDragStart(id, event) {
  draggedBookmarkId.value = id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handleDrop(targetId) {
  if (!draggedBookmarkId.value || draggedBookmarkId.value === targetId) return
  funlink.reorderBookmarks(draggedBookmarkId.value, targetId)
  draggedBookmarkId.value = null
}

function handleDataFile(type, content, options) {
  if (funlink.processDataFile(type, content, options)) settingsDialog.value.close()
}

function handleReset() {
  if (funlink.resetData()) settingsDialog.value.close()
}

function handleKeydown(event) { if (event.key === 'Escape') closeContextMenu() }

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
  document.addEventListener('keydown', handleKeydown)
  funlink.setupUtools({ addBookmark: bookmark => bookmarkDialog.value.open(bookmark) })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :roots="roots"
      :current-view="state.currentView"
      :active-root-id="activeRootId"
      :theme="state.theme"
      :rounded="state.settings.navbar.rounded"
      @select="funlink.setView"
      @manage="openCategoryContextMenu"
      @cycle-theme="funlink.cycleTheme"
      @settings="settingsDialog.open()"
    />

    <main class="main">
      <div class="main-view">
        <div v-if="specialView" class="special-view-header">
          <span class="special-view-title" :class="{ danger: state.currentView === 'trash' }"><i class="iconfont" :class="specialView.icon" aria-hidden="true" />{{ specialView.label }}</span>
          <button type="button" aria-label="帮助" title="帮助"><i class="iconfont icon-help" aria-hidden="true" /></button>
        </div>
        <div class="detail-content" :class="secondaryCategories.length ? `tabs-${secondaryPosition}` : ''">
          <SecondaryNavigation
            :categories="secondaryCategories"
            :active-category-id="activeCategoryId"
            :position="secondaryPosition"
            @select="funlink.setView"
          />
          <BookmarkGrid
            :bookmarks="currentBookmarks"
            :trash-view="state.currentView === 'trash'"
            :show-add="!['trash', 'quick', 'favorites'].includes(state.currentView)"
            @add="bookmarkDialog.open()"
            @open="funlink.openLink"
            @note="noteDialog.open($event)"
            @context-menu="openContextMenu"
            @drag-start="handleDragStart"
            @drop="handleDrop"
          />
        </div>
      </div>
    </main>

    <button class="trash-button" type="button" aria-label="打开废纸篓" title="废纸篓" @click="funlink.setView('trash')" @contextmenu.prevent="funlink.emptyTrash">
      <span class="trash-badge">
        <i class="iconfont icon-dust" aria-hidden="true" />
        <sup v-if="trashCount">{{ trashCount }}</sup>
      </span>
    </button>

    <ContextMenu v-if="context.visible" :items="contextItems" :x="context.x" :y="context.y" @select="handleContextAction" />
    <div v-if="toast.visible" class="toast" :class="{ error: toast.error }" role="status" aria-live="polite">{{ toast.message }}</div>

    <BookmarkDialog
      ref="bookmarkDialog"
      :categories="state.categories"
      :default-category-id="defaultCategoryId"
      :bookmark-count="state.bookmarks.length"
      @save="funlink.saveBookmark"
    />
    <CategoryDialog ref="categoryDialog" :categories="state.categories" :category-count="funlink.categoryCount" @add="funlink.addCategory" @action="funlink.categoryAction" />
    <NoteDialog ref="noteDialog" @save="funlink.saveNote" />
    <SettingsDialog
      ref="settingsDialog"
      :settings="state.settings"
      :bookmarks="state.bookmarks"
      :backup-data="state"
      @save-settings="funlink.saveSettings"
      @clear-cookies="funlink.clearCookies"
      @message="funlink.showToast"
      @export="funlink.exportBackup"
      @data-file="handleDataFile"
      @reset="handleReset"
    />
  </div>
</template>
