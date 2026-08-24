<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppNavigation from './components/AppNavigation.vue'
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
  state, search, toast, roots, activeCategoryId, activeRootId, secondaryCategories, trashCount,
  currentBookmarks, viewTitle, viewMeta, defaultCategoryId,
} = funlink
const header = ref(null)
const bookmarkDialog = ref(null)
const categoryDialog = ref(null)
const noteDialog = ref(null)
const settingsDialog = ref(null)
const draggedBookmarkId = ref(null)
const context = reactive({ visible: false, bookmark: null, x: 0, y: 0 })

const contextItems = computed(() => {
  const bookmark = context.bookmark
  if (!bookmark) return []
  return bookmark.deletedAt
    ? [{ action: 'restore', label: '恢复' }, { action: 'delete', label: '永久删除' }]
    : [
        { action: 'append', label: '追加网址' },
        { action: 'edit', label: '编辑' },
        { action: 'note', label: bookmark.note ? '编辑笔记' : '记录笔记' },
        { action: 'quick', label: bookmark.quick ? '关闭网页快开' : '网页快开' },
        { action: 'favorite', label: bookmark.favorite ? '取消常用' : '加入常用' },
        { action: 'trash', label: '移到废纸篓' },
      ]
})

function openContextMenu(bookmark, event) {
  const rect = event.currentTarget?.getBoundingClientRect?.()
  Object.assign(context, {
    visible: true,
    bookmark,
    x: event.type === 'contextmenu' ? event.clientX : rect.right - 184,
    y: event.type === 'contextmenu' ? event.clientY : rect.bottom + 4,
  })
}

function closeContextMenu() {
  context.visible = false
  context.bookmark = null
}

function handleContextAction(action) {
  const bookmark = context.bookmark
  closeContextMenu()
  if (!bookmark) return
  if (action === 'append') bookmarkDialog.value.open(null, bookmark.id)
  if (action === 'edit') bookmarkDialog.value.open(bookmark)
  if (action === 'note') noteDialog.value.open(bookmark)
  if (action === 'quick') funlink.toggleQuick(bookmark)
  if (action === 'favorite') funlink.toggleFavorite(bookmark)
  if (action === 'trash') funlink.moveToTrash(bookmark)
  if (action === 'restore') funlink.restoreBookmark(bookmark)
  if (action === 'delete') funlink.deleteBookmark(bookmark)
}

function handleManage() {
  if (state.value.currentView === 'trash') funlink.emptyTrash()
  else categoryDialog.value.open()
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

function handleDataFile(type, content) {
  if (funlink.processDataFile(type, content)) settingsDialog.value.close()
}

function handleReset() {
  if (funlink.resetData()) settingsDialog.value.close()
}

function handleKeydown(event) {
  if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    event.preventDefault()
    header.value?.focusSearch()
  }
  if (event.key === 'Escape') closeContextMenu()
}

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
      ref="header"
      v-model="search"
      :theme="state.theme"
      @home="funlink.setView('all')"
      @add="bookmarkDialog.open()"
      @cycle-theme="funlink.cycleTheme"
      @settings="settingsDialog.open()"
    />
    <AppNavigation
      :roots="roots"
      :current-view="state.currentView"
      :active-root-id="activeRootId"
      @select="funlink.setView"
    />

    <main class="workspace">
      <SecondaryNavigation :categories="secondaryCategories" :active-category-id="activeCategoryId" @select="funlink.setView" />
      <BookmarkGrid
        :bookmarks="currentBookmarks"
        :title="viewTitle"
        :meta="viewMeta"
        :trash-view="state.currentView === 'trash'"
        @add="bookmarkDialog.open()"
        @manage="handleManage"
        @open="funlink.openLink"
        @favorite="funlink.toggleFavorite"
        @note="noteDialog.open($event)"
        @menu="openContextMenu"
        @context-menu="openContextMenu"
        @drag-start="handleDragStart"
        @drop="handleDrop"
      />
    </main>

    <button class="trash-button" type="button" aria-label="打开废纸篓" title="废纸篓" @click="funlink.setView('trash')" @contextmenu.prevent="funlink.emptyTrash">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></svg>
      <span v-if="trashCount">{{ trashCount }}</span>
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
      :theme="state.theme"
      @theme="funlink.setTheme"
      @export="funlink.exportBackup"
      @data-file="handleDataFile"
      @reset="handleReset"
    />
  </div>
</template>
