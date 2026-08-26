import { computed, reactive, ref } from 'vue'
import { bookmarkMatches, createId, initials, isSafeUrl, moveCategory, moveItem, normalizeCategoryIds, parseBookmarkHtml, splitTitle } from '../lib/core.mjs'
import { STORAGE_KEY, categoryIdsOf, loadState, prepareState } from '../lib/state.mjs'
import { convertLegacyExport, isLegacyExport } from '../lib/legacy.mjs'
import { readStorage, writeStorage } from '../lib/storage.js'
import firstData from '../data/firstData.json'

const COLORS = ['#16b8c7', '#2563eb', '#7c3aed', '#db2777', '#e85d3f', '#0f9f6e', '#64748b']

// 示例数据本身就是「网址精灵」的文档格式，直接复用导入用的转换器，
// 免得示例数据和真实导入走两套映射、行为不一致。
function seedState() {
  return convertLegacyExport(firstData).state
}

export function useFunLink() {
  const loaded = loadState({ read: readStorage, seed: seedState })
  const state = ref(loaded.state)
  const storageError = ref(loaded.blocked)
  const search = ref('')
  const toast = reactive({ visible: false, message: '', error: false })
  const keywordPrompt = reactive({ visible: false, title: '', value: '' })
  let keywordResolve = null
  let toastTimer

  const roots = computed(() => state.value.categories.filter(category => !category.parentId))
  const activeCategoryId = computed(() => state.value.currentView.startsWith('category:')
    ? state.value.currentView.slice(9)
    : state.value.currentView === 'trash' ? state.value.lastCategoryId : '')
  const activeRootId = computed(() => {
    const category = state.value.categories.find(item => item.id === activeCategoryId.value)
    return category?.parentId || category?.id || ''
  })
  const childrenOf = parentId => state.value.categories.filter(category => category.parentId === parentId)
  const secondaryCategories = computed(() => state.value.currentView.startsWith('category:') && activeRootId.value ? childrenOf(activeRootId.value) : [])
  const secondaryPosition = computed(() => state.value.categories.find(category => category.id === activeRootId.value)?.tabPosition || 'top')
  const trashCount = computed(() => state.value.bookmarks.filter(bookmark => bookmark.deletedAt).length)
  const currentBookmarks = computed(() => {
    const active = state.value.bookmarks.filter(bookmark => !bookmark.deletedAt)
    let bookmarks

    // 废纸篓要先判断：否则一搜索就跳去搜全部未删除卡片，废纸篓里反而搜不到东西。
    if (state.value.currentView === 'trash') bookmarks = state.value.bookmarks.filter(bookmark => bookmark.deletedAt)
    else if (search.value.trim()) bookmarks = active
    else if (state.value.currentView === 'all') bookmarks = active
    else if (state.value.currentView === 'favorites') bookmarks = active.filter(bookmark => bookmark.favorite)
    else if (state.value.currentView === 'quick') bookmarks = active.filter(bookmark => bookmark.quick)
    else if (state.value.currentView === 'inbox') bookmarks = active.filter(bookmark => categoryIdsOf(bookmark).includes('cat@default') || !categoryIdsOf(bookmark).length)
    else {
      const category = state.value.categories.find(item => item.id === activeCategoryId.value)
      const ids = category && !category.parentId
        ? new Set([category.id, ...childrenOf(category.id).map(item => item.id)])
        : new Set([activeCategoryId.value])
      bookmarks = active.filter(bookmark => categoryIdsOf(bookmark).some(id => ids.has(id)))
    }
    return bookmarks.filter(bookmark => bookmarkMatches(bookmark, search.value, state.value.settings.search))
  })
  const defaultCategoryId = computed(() => state.value.currentView === 'inbox'
    ? 'cat@default'
    : state.value.categories.some(category => category.id === activeCategoryId.value) ? activeCategoryId.value : 'cat@default')

  function saveState() {
    if (storageError.value) return
    writeStorage(STORAGE_KEY, state.value)
  }

  function showToast(message, error = false) {
    clearTimeout(toastTimer)
    Object.assign(toast, { visible: true, message, error })
    toastTimer = setTimeout(() => { toast.visible = false }, 3200)
  }

  // Electron 不实现 window.prompt，站内搜索的关键词改用应用内对话框获取。
  function askKeyword(title) {
    return new Promise(resolve => {
      keywordResolve = resolve
      Object.assign(keywordPrompt, { visible: true, title, value: '' })
    })
  }

  function resolveKeyword(value = '') {
    keywordPrompt.visible = false
    const resolve = keywordResolve
    keywordResolve = null
    resolve?.(String(value).trim())
  }

  function setView(view) {
    if (view.startsWith('category:')) {
      const categoryId = view.slice(9)
      const firstChild = childrenOf(categoryId)[0]
      state.value.currentView = `category:${firstChild?.id || categoryId}`
      state.value.lastCategoryId = firstChild?.id || categoryId
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

  // 整体替换数据后（恢复备份 / 重置）重建快开入口，否则旧入口还在、新的一个都没注册。
  function syncAllQuickFeatures() {
    if (!window.utools?.setFeature) return
    window.utools.getFeatures?.()?.forEach(feature => {
      if (feature?.code?.startsWith('open-link@')) window.utools.removeFeature?.(feature.code)
    })
    state.value.bookmarks.filter(bookmark => bookmark.quick && !bookmark.deletedAt).forEach(syncQuickFeature)
  }

  function saveBookmark(input, afterId = null) {
    const id = input.id || createId('bookmark')
    const previous = state.value.bookmarks.find(bookmark => bookmark.id === id)
    const categoryIds = normalizeCategoryIds(input.categoryIds || (input.categoryId ? [input.categoryId] : []))
    const bookmark = { ...previous, ...input, id, categoryId: categoryIds[0], categoryIds, note: previous?.note || '', deletedAt: null }
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

  function urlsOf(bookmark) {
    const extras = Array.isArray(bookmark.urls) ? bookmark.urls : []
    return [bookmark.url, ...extras.map(item => (typeof item === 'string' ? item : item?.value))]
      .map(url => String(url || '').trim())
      .filter(url => url && isSafeUrl(url))
  }

  function openUrl(bookmark, url) {
    const followsDefault = !bookmark.browser || bookmark.browser === 'default'
    const useInner = bookmark.browser === 'inner' || (followsDefault && state.value.settings.browser.isOpenIn)
    if (useInner && window.utools?.ubrowser) {
      window.utools.ubrowser.goto(url).run({ width: state.value.settings.browser.width, height: state.value.settings.browser.height })
    } else if (window.funlink?.openExternal) {
      // 'default' / 'system' 都表示交给系统默认浏览器。
      window.funlink.openExternal(url, followsDefault || bookmark.browser === 'system' ? '' : bookmark.browser)
    } else window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openLink(bookmark, query = '') {
    const urls = urlsOf(bookmark)
    if (!urls.length) return
    let keyword = String(query || '').trim() || search.value.trim()
    if (urls.some(url => url.includes('{q}')) && !keyword) {
      keyword = await askKeyword(`在 ${bookmark.title} 中搜索`)
      if (!keyword) return
    }
    urls.forEach(url => openUrl(bookmark, url.replaceAll('{q}', encodeURIComponent(keyword))))
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
    bookmark.categoryId = bookmark.categoryIds[0] || 'cat@default'
    if (!bookmark.categoryIds.length) bookmark.categoryIds = ['cat@default']
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
    return state.value.bookmarks.filter(bookmark => !bookmark.deletedAt && categoryIdsOf(bookmark).includes(categoryId)).length
  }

  function addCategory(name, parentId, afterId = '') {
    if (!name.trim()) return
    const category = { id: createId('category'), name: name.trim(), parentId, tabPosition: 'top' }
    const index = afterId ? state.value.categories.findIndex(item => item.id === afterId) : -1
    if (index >= 0) state.value.categories.splice(index + 1, 0, category)
    else state.value.categories.push(category)
    saveState()
  }

  function categoryAction(id, action, value) {
    const category = state.value.categories.find(item => item.id === id)
    if (!category) return
    if (action === 'rename') {
      const name = typeof value === 'string' ? value.trim() : ''
      if (name) category.name = name
    }
    if (action === 'delete') {
      const descendants = new Set([id, ...childrenOf(id).map(item => item.id)])
      if (value !== true && !window.confirm(`删除“${category.name}”？分类中的网址会移到收集箱。`)) return
      state.value.categories = state.value.categories.filter(item => !descendants.has(item.id))
      state.value.bookmarks.forEach(bookmark => {
        bookmark.categoryIds = categoryIdsOf(bookmark).filter(categoryId => !descendants.has(categoryId))
        if (!bookmark.categoryIds.length) bookmark.categoryIds = ['cat@default']
        bookmark.categoryId = bookmark.categoryIds[0]
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
    if (action === 'position' && ['left', 'right', 'top', 'bottom'].includes(value)) category.tabPosition = value
    if (action === 'move' && value) state.value.categories = moveCategory(state.value.categories, id, value.parentId, value.targetId)
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

  function saveSettings() {
    saveState()
    showToast('设置已保存！')
  }

  function clearCookies() {
    window.utools?.db?.allDocs?.('cookie@')?.forEach(document => window.utools.db.remove(document._id))
    showToast('cookies已清空！')
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

  function processDataFile(type, content, options = {}) {
    try {
      if (type === 'restore') {
        const parsed = JSON.parse(content)
        // 既接受 FunLink 自己的备份，也接受「网址精灵」导出的 { db, flyDb } / 裸数组。
        const source = isLegacyExport(parsed) ? convertLegacyExport(parsed).state : parsed
        const { state: restored, dropped } = prepareState(source)
        state.value = restored
        // 恢复成功即说明拿到了可用数据，可以解除只读保护。
        storageError.value = ''
        saveState()
        applyTheme()
        syncAllQuickFeatures()
        showToast(dropped ? `备份已恢复，已跳过 ${dropped} 条无效网址` : '备份已恢复')
        return true
      }
      const imported = parseBookmarkHtml(content)
      if (options.mode === 'replace') {
        state.value.bookmarks.filter(bookmark => bookmark.quick).forEach(bookmark => window.utools?.removeFeature?.(`open-link@${bookmark.id}`))
        state.value.categories = []
        state.value.bookmarks = []
      }
      const categoryId = createId('category-import')
      state.value.categories.push({ id: categoryId, name: '导入书签', parentId: '', tabPosition: options.tabPosition || 'left' })
      const existing = new Set(state.value.bookmarks.map(bookmark => bookmark.url))
      const bookmarks = imported.filter(bookmark => !existing.has(bookmark.url)).map((bookmark, index) => {
        // 浏览器书签常写成「名称 - 简介」，按设置里的分隔符拆开。
        const { title, description } = splitTitle(bookmark.title, state.value.settings.importSplit)
        return {
          ...bookmark,
          id: createId('bookmark-import'),
          title: title || bookmark.title,
          description: description || displayHost(bookmark.url),
          categoryId,
          categoryIds: [categoryId],
          color: COLORS[index % COLORS.length],
          iconType: 'text',
          icon: initials(title || bookmark.title),
          urls: [],
          browser: '', favorite: false, quick: false, note: '', deletedAt: null,
        }
      })
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
    // 用户明确选择了覆盖，此时解除只读保护。
    storageError.value = ''
    saveState()
    applyTheme()
    syncAllQuickFeatures()
    showToast('已恢复示例数据')
    return true
  }

  function setupUtools({ addBookmark }) {
    window.utools?.setExpendHeight?.(558)
    window.utools?.setSubInput?.(({ text }) => { search.value = text || '' }, '搜索卡片', true)
    window.funlink?.onEnter(async action => {
      if (action.code?.startsWith('open-link@')) {
        const bookmark = state.value.bookmarks.find(item => item.id === action.code.slice(10))
        if (bookmark) {
          // 等 openLink 结束再退出，否则关键词还没输入插件就被关掉了。
          await openLink(bookmark, action.payload)
          window.utools?.outPlugin?.()
        }
        return
      }
      window.utools?.setExpendHeight?.(558)
      if (action.code === 'add-link') addBookmark({ url: String(action.payload || '').trim() })
      if (action.code === 'search-link') search.value = String(action.payload || '')
    })
    window.utools?.onMainPush?.(({ payload }) => state.value.bookmarks
      .filter(bookmark => !bookmark.deletedAt && !bookmark.url.includes('{q}') && bookmarkMatches(bookmark, payload, state.value.settings.search))
      .slice(0, 6)
      .map(bookmark => ({ icon: 'logo.png', text: bookmark.title, title: bookmark.description || displayHost(bookmark.url), bookmarkId: bookmark.id })),
    ({ payload, option }) => {
      const bookmark = state.value.bookmarks.find(item => item.id === option.bookmarkId)
      if (bookmark) openLink(bookmark, payload)
    })
  }

  applyTheme()

  return {
    state, search, toast, storageError, keywordPrompt, roots, activeCategoryId, activeRootId,
    secondaryCategories, secondaryPosition, trashCount,
    currentBookmarks, defaultCategoryId, childrenOf, categoryCount,
    setView, saveBookmark, saveNote, openLink, toggleFavorite, toggleQuick, moveToTrash,
    restoreBookmark, deleteBookmark, emptyTrash, reorderBookmarks, addCategory, categoryAction,
    setTheme, cycleTheme, saveSettings, clearCookies, exportBackup, processDataFile, resetData,
    setupUtools, showToast, resolveKeyword,
  }
}

export function displayHost(url) {
  try { return new URL(url).hostname || url } catch { return url }
}

export function safeColor(value) {
  return /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value || '') ? value : '#16b8c7'
}
