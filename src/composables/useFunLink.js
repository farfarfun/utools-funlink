import { computed, reactive, ref } from 'vue'
import { bookmarkMatches, initials, moveItem, parseBookmarkHtml, validateState } from '../lib/core.mjs'
import firstData from '../data/firstData.json'

const STORAGE_KEY = 'funlink-state-v1'
const COLORS = ['#16b8c7', '#2563eb', '#7c3aed', '#db2777', '#e85d3f', '#0f9f6e', '#64748b']
const SPECIAL_CATEGORY_IDS = new Set(['cat@default', 'cat@dustbin', 'cat@fly', 'cat@often'])

function categoryIdsOf(bookmark) {
  return bookmark.categoryIds || (bookmark.categoryId ? [bookmark.categoryId] : [])
}

function seedState() {
  const categories = firstData
    .filter(item => item.label && !SPECIAL_CATEGORY_IDS.has(item._id))
    .map(item => ({
      id: item._id,
      name: item.label,
      parentId: item.pid,
      tabPosition: item.tabPosition || 'top',
    }))
  const bookmarks = firstData
    .filter(item => item.title && item.url)
    .map(item => {
      const categoryIds = item.catIds || []
      const categoryId = categoryIds.find(id => !SPECIAL_CATEGORY_IDS.has(id)) || ''
      return {
        id: item._id,
        title: item.title,
        url: item.url,
        description: item.desc || '',
        categoryId,
        categoryIds,
        color: item.icon?.textColor || COLORS[0],
        iconType: item.icon?.type || 'text',
        icon: item.icon?.text || initials(item.title),
        iconSize: item.icon?.fontSize || 16,
        iconData: item.icon?.data || '',
        browser: '',
        favorite: Boolean(item.isOften),
        quick: Boolean(item.isFly),
        hasNote: Boolean(item.hasNote),
        note: '',
        deletedAt: categoryIds.includes('cat@dustbin') ? 1 : null,
      }
    })

  return {
    version: 1,
    theme: 'system',
    currentView: 'category:cat_demo',
    categories,
    bookmarks,
  }
}

function storage() {
  return window.utools?.dbStorage || {
    getItem: key => JSON.parse(localStorage.getItem(key) || 'null'),
    setItem: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  }
}

function loadState() {
  try {
    const saved = storage().getItem(STORAGE_KEY)
    return saved ? validateState(saved) : seedState()
  } catch (error) {
    console.error(error)
    return seedState()
  }
}

export function useFunLink() {
  const state = ref(loadState())
  const search = ref('')
  const toast = reactive({ visible: false, message: '', error: false })
  let toastTimer

  const roots = computed(() => state.value.categories.filter(category => !category.parentId))
  const activeCategoryId = computed(() => state.value.currentView.startsWith('category:') ? state.value.currentView.slice(9) : '')
  const activeRootId = computed(() => {
    const category = state.value.categories.find(item => item.id === activeCategoryId.value)
    return category?.parentId || category?.id || ''
  })
  const childrenOf = parentId => state.value.categories.filter(category => category.parentId === parentId)
  const secondaryCategories = computed(() => childrenOf(activeRootId.value))
  const secondaryPosition = computed(() => state.value.categories.find(category => category.id === activeRootId.value)?.tabPosition || 'top')
  const trashCount = computed(() => state.value.bookmarks.filter(bookmark => bookmark.deletedAt).length)
  const currentBookmarks = computed(() => {
    const active = state.value.bookmarks.filter(bookmark => !bookmark.deletedAt)
    let bookmarks

    if (search.value.trim()) bookmarks = active
    else if (state.value.currentView === 'all') bookmarks = active
    else if (state.value.currentView === 'favorites') bookmarks = active.filter(bookmark => bookmark.favorite)
    else if (state.value.currentView === 'quick') bookmarks = active.filter(bookmark => bookmark.quick)
    else if (state.value.currentView === 'inbox') bookmarks = active.filter(bookmark => categoryIdsOf(bookmark).includes('cat@default') || !categoryIdsOf(bookmark).length)
    else if (state.value.currentView === 'trash') bookmarks = state.value.bookmarks.filter(bookmark => bookmark.deletedAt)
    else {
      const category = state.value.categories.find(item => item.id === activeCategoryId.value)
      const ids = category && !category.parentId
        ? new Set([category.id, ...childrenOf(category.id).map(item => item.id)])
        : new Set([activeCategoryId.value])
      bookmarks = active.filter(bookmark => categoryIdsOf(bookmark).some(id => ids.has(id)))
    }
    return bookmarks.filter(bookmark => bookmarkMatches(bookmark, search.value))
  })
  const defaultCategoryId = computed(() => state.value.categories.some(category => category.id === activeCategoryId.value) ? activeCategoryId.value : '')

  function saveState() {
    storage().setItem(STORAGE_KEY, JSON.parse(JSON.stringify(state.value)))
  }

  function showToast(message, error = false) {
    clearTimeout(toastTimer)
    Object.assign(toast, { visible: true, message, error })
    toastTimer = setTimeout(() => { toast.visible = false }, 3200)
  }

  function setView(view) {
    if (view.startsWith('category:')) {
      const categoryId = view.slice(9)
      const firstChild = childrenOf(categoryId)[0]
      state.value.currentView = `category:${firstChild?.id || categoryId}`
    } else state.value.currentView = view
    search.value = ''
    saveState()
  }

  function syncQuickFeature(bookmark) {
    if (!window.utools?.setFeature) return
    const code = `open-link@${bookmark.id}`
    if (!bookmark.quick) {
      window.utools.removeFeature?.(code)
      return
    }
    const cmds = bookmark.url.includes('{q}') ? [bookmark.title, { type: 'over', label: bookmark.title }] : [bookmark.title]
    window.utools.setFeature({ code, explain: `打开 ${bookmark.title}`, icon: 'logo.png', mainHide: true, cmds })
  }

  function saveBookmark(input, afterId = null) {
    const id = input.id || `bookmark-${Date.now()}`
    const previous = state.value.bookmarks.find(bookmark => bookmark.id === id)
    const bookmark = { ...previous, ...input, id, categoryIds: input.categoryId ? [input.categoryId] : ['cat@default'], note: previous?.note || '', deletedAt: null }
    if (previous) state.value.bookmarks[state.value.bookmarks.indexOf(previous)] = bookmark
    else if (afterId) state.value.bookmarks.splice(state.value.bookmarks.findIndex(item => item.id === afterId) + 1, 0, bookmark)
    else state.value.bookmarks.push(bookmark)
    syncQuickFeature(bookmark)
    saveState()
    showToast(previous ? '网址已更新' : '网址已添加')
  }

  function saveNote(id, note) {
    const bookmark = state.value.bookmarks.find(item => item.id === id)
    if (!bookmark) return
    bookmark.note = note
    saveState()
    showToast('笔记已保存')
  }

  function openLink(bookmark, query = '') {
    let url = bookmark.url
    if (url.includes('{q}')) {
      const keyword = query || search.value.trim() || window.prompt(`在 ${bookmark.title} 中搜索`) || ''
      if (!keyword) return
      url = url.replaceAll('{q}', encodeURIComponent(keyword))
    }
    if (window.funlink?.openExternal) window.funlink.openExternal(url, bookmark.browser)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  function toggleFavorite(bookmark) {
    bookmark.favorite = !bookmark.favorite
    saveState()
    showToast(bookmark.favorite ? '已加入常用' : '已取消常用')
  }

  function toggleQuick(bookmark) {
    bookmark.quick = !bookmark.quick
    syncQuickFeature(bookmark)
    saveState()
    showToast(bookmark.quick ? '已开启网页快开' : '已关闭网页快开')
  }

  function moveToTrash(bookmark) {
    bookmark.previousCategoryIds = categoryIdsOf(bookmark)
    bookmark.deletedAt = Date.now()
    bookmark.quick = false
    syncQuickFeature(bookmark)
    saveState()
    showToast('已移到废纸篓')
  }

  function restoreBookmark(bookmark) {
    bookmark.categoryIds = (bookmark.previousCategoryIds || []).filter(id => id === 'cat@default' || state.value.categories.some(category => category.id === id))
    bookmark.categoryId = bookmark.categoryIds.find(id => id !== 'cat@default') || ''
    bookmark.deletedAt = null
    delete bookmark.previousCategoryIds
    saveState()
    showToast('网址已恢复')
  }

  function deleteBookmark(bookmark) {
    if (!window.confirm(`永久删除“${bookmark.title}”？此操作无法撤销。`)) return
    state.value.bookmarks = state.value.bookmarks.filter(item => item.id !== bookmark.id)
    window.utools?.removeFeature?.(`open-link@${bookmark.id}`)
    saveState()
    showToast('网址已永久删除')
  }

  function emptyTrash() {
    const deleted = state.value.bookmarks.filter(bookmark => bookmark.deletedAt)
    if (!deleted.length) return showToast('废纸篓已经是空的')
    if (!window.confirm(`永久删除废纸篓中的 ${deleted.length} 个网址？此操作无法撤销。`)) return
    state.value.bookmarks = state.value.bookmarks.filter(bookmark => !bookmark.deletedAt)
    saveState()
    showToast('废纸篓已清空')
  }

  function reorderBookmarks(sourceId, targetId) {
    state.value.bookmarks = moveItem(state.value.bookmarks, sourceId, targetId)
    saveState()
  }

  function categoryCount(categoryId) {
    const ids = new Set([categoryId, ...childrenOf(categoryId).map(item => item.id)])
    return state.value.bookmarks.filter(bookmark => !bookmark.deletedAt && categoryIdsOf(bookmark).some(id => ids.has(id))).length
  }

  function addCategory(name, parentId) {
    if (!name.trim()) return
    state.value.categories.push({ id: `category-${Date.now()}`, name: name.trim(), parentId })
    saveState()
  }

  function categoryAction(id, action) {
    const category = state.value.categories.find(item => item.id === id)
    if (!category) return
    if (action === 'rename') {
      const name = window.prompt('新的分类名称', category.name)?.trim()
      if (name) category.name = name
    }
    if (action === 'delete') {
      const descendants = new Set([id, ...childrenOf(id).map(item => item.id)])
      if (!window.confirm(`删除“${category.name}”？分类中的网址会移到收集箱。`)) return
      state.value.categories = state.value.categories.filter(item => !descendants.has(item.id))
      state.value.bookmarks.forEach(bookmark => {
        bookmark.categoryIds = categoryIdsOf(bookmark).filter(categoryId => !descendants.has(categoryId))
        bookmark.categoryId = bookmark.categoryIds[0] || ''
      })
      if (descendants.has(activeCategoryId.value)) state.value.currentView = 'inbox'
    }
    if (action === 'up' || action === 'down') {
      const siblings = state.value.categories.filter(item => item.parentId === category.parentId)
      const target = siblings[siblings.findIndex(item => item.id === id) + (action === 'up' ? -1 : 1)]
      if (target) {
        const index = state.value.categories.indexOf(category)
        const targetIndex = state.value.categories.indexOf(target)
        state.value.categories[index] = target
        state.value.categories[targetIndex] = category
      }
    }
    saveState()
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.value.theme
  }

  function setTheme(theme) {
    state.value.theme = theme
    saveState()
    applyTheme()
  }

  function cycleTheme() {
    const order = ['system', 'light', 'dark']
    setTheme(order[(order.indexOf(state.value.theme) + 1) % order.length])
    showToast({ system: '跟随系统主题', light: '已切换浅色主题', dark: '已切换深色主题' }[state.value.theme])
  }

  function exportBackup() {
    const content = JSON.stringify(state.value, null, 2)
    if (window.funlink?.saveBackup?.(content)) return showToast('备份已导出')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    link.download = `funlink-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    showToast('备份已导出')
  }

  function processDataFile(type, content) {
    try {
      if (type === 'restore') {
        state.value = validateState(JSON.parse(content))
        saveState()
        applyTheme()
        showToast('备份已恢复')
        return true
      }
      const imported = parseBookmarkHtml(content)
      const categoryId = `category-import-${Date.now()}`
      state.value.categories.push({ id: categoryId, name: '导入书签', parentId: '' })
      const existing = new Set(state.value.bookmarks.map(bookmark => bookmark.url))
      const bookmarks = imported.filter(bookmark => !existing.has(bookmark.url)).map((bookmark, index) => ({
        ...bookmark,
        id: `bookmark-import-${Date.now()}-${index}`,
        description: displayHost(bookmark.url),
        categoryId,
        categoryIds: [categoryId],
        color: COLORS[index % COLORS.length],
        iconType: 'text',
        icon: initials(bookmark.title),
        browser: '', favorite: false, quick: false, note: '', deletedAt: null,
      }))
      state.value.bookmarks.push(...bookmarks)
      state.value.currentView = `category:${categoryId}`
      saveState()
      showToast(`已导入 ${bookmarks.length} 个网址`)
      return true
    } catch (error) {
      showToast(error.message, true)
      return false
    }
  }

  function resetData() {
    if (!window.confirm('恢复示例数据？当前数据会被覆盖。')) return false
    state.value.bookmarks.filter(bookmark => bookmark.quick).forEach(bookmark => window.utools?.removeFeature?.(`open-link@${bookmark.id}`))
    state.value = seedState()
    saveState()
    applyTheme()
    showToast('已恢复示例数据')
    return true
  }

  function setupUtools({ addBookmark }) {
    window.utools?.setExpendHeight?.(558)
    window.utools?.setSubInput?.(({ text }) => { search.value = text || '' }, '搜索卡片', true)
    window.funlink?.onEnter(action => {
      if (action.code?.startsWith('open-link@')) {
        const bookmark = state.value.bookmarks.find(item => item.id === action.code.slice(10))
        if (bookmark) {
          openLink(bookmark, action.payload)
          window.utools?.outPlugin?.()
        }
        return
      }
      window.utools?.setExpendHeight?.(558)
      if (action.code === 'add-link') addBookmark({ url: String(action.payload || '').trim() })
      if (action.code === 'search-link') search.value = String(action.payload || '')
    })
    window.utools?.onMainPush?.(({ payload }) => state.value.bookmarks
      .filter(bookmark => !bookmark.deletedAt && !bookmark.url.includes('{q}') && bookmarkMatches(bookmark, payload))
      .slice(0, 6)
      .map(bookmark => ({ icon: 'logo.png', text: bookmark.title, title: bookmark.description || displayHost(bookmark.url), bookmarkId: bookmark.id })),
    ({ payload, option }) => {
      const bookmark = state.value.bookmarks.find(item => item.id === option.bookmarkId)
      if (bookmark) openLink(bookmark, payload)
    })
  }

  applyTheme()

  return {
    state, search, toast, roots, activeCategoryId, activeRootId, secondaryCategories, secondaryPosition, trashCount,
    currentBookmarks, defaultCategoryId, childrenOf, categoryCount,
    setView, saveBookmark, saveNote, openLink, toggleFavorite, toggleQuick, moveToTrash,
    restoreBookmark, deleteBookmark, emptyTrash, reorderBookmarks, addCategory, categoryAction,
    setTheme, cycleTheme, exportBackup, processDataFile, resetData, setupUtools, showToast,
  }
}

export function displayHost(url) {
  try { return new URL(url).hostname || url } catch { return url }
}

export function safeColor(value) {
  return /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value || '') ? value : '#16b8c7'
}
