import { bookmarkMatches, initials, moveItem, normalizeUrl, parseBookmarkHtml, validateState } from './core.mjs'

const STORAGE_KEY = 'funlink-state-v1'
const COLORS = ['#16b8c7', '#2563eb', '#7c3aed', '#db2777', '#e85d3f', '#0f9f6e', '#64748b']

const seedState = () => ({
  version: 1,
  theme: 'system',
  currentView: 'category:design-assets',
  categories: [
    { id: 'life', name: '生活', parentId: '' },
    { id: 'life-tools', name: '工具', parentId: 'life' },
    { id: 'life-reading', name: '阅读', parentId: 'life' },
    { id: 'design', name: '设计', parentId: '' },
    { id: 'design-assets', name: '素材', parentId: 'design' },
    { id: 'design-community', name: '社区', parentId: 'design' },
    { id: 'design-icons', name: '图标', parentId: 'design' },
    { id: 'frontend', name: '前端', parentId: '' },
    { id: 'frontend-tools', name: '工具', parentId: 'frontend' },
    { id: 'frontend-frameworks', name: '框架', parentId: 'frontend' },
    { id: 'frontend-docs', name: '文档', parentId: 'frontend' },
    { id: 'work', name: '工作', parentId: '' },
    { id: 'work-tools', name: '协作', parentId: 'work' },
  ],
  bookmarks: [
    sample('figma', 'Figma', 'https://www.figma.com/', '协作式界面设计工具', 'design-assets', '#f24e1e', 'Fi'),
    sample('iconfont', 'iconfont', 'https://www.iconfont.cn/', '阿里巴巴矢量图标库', 'design-icons', '#00c9b7', 'iF'),
    sample('unsplash', 'Unsplash', 'https://unsplash.com/', '免费高质量图片素材', 'design-assets', '#111827', 'Un'),
    sample('pexels', 'Pexels', 'https://www.pexels.com/', '免费图片和视频素材', 'design-assets', '#05a081', 'Pe'),
    sample('coolors', 'Coolors', 'https://coolors.co/', '快速生成配色方案', 'design-assets', '#6658d3', 'Co'),
    sample('dribbble', 'Dribbble', 'https://dribbble.com/', '设计师作品与灵感社区', 'design-community', '#ea4c89', 'Dr'),
    sample('github', 'GitHub', 'https://github.com/', '代码托管与协作平台', 'frontend-tools', '#24292f', 'GH'),
    sample('mdn', 'MDN Web Docs', 'https://developer.mozilla.org/zh-CN/', '权威 Web 开发文档', 'frontend-docs', '#2563eb', 'MD'),
    sample('vue', 'Vue.js', 'https://cn.vuejs.org/', '渐进式 JavaScript 框架', 'frontend-frameworks', '#42b883', 'V'),
    sample('vite', 'Vite', 'https://cn.vite.dev/', '下一代前端构建工具', 'frontend-tools', '#7c3aed', 'Vi'),
    sample('notion', 'Notion', 'https://www.notion.so/', '笔记、知识库与项目协作', 'work-tools', '#111827', 'N'),
    sample('utools', 'uTools 官网', 'https://www.u-tools.cn/', '新一代效率工具平台', 'life-tools', '#5966e9', 'uT'),
  ],
})

function sample(id, title, url, description, categoryId, color, icon) {
  return { id, title, url, description, categoryId, color, iconType: 'text', icon, browser: '', favorite: false, quick: false, note: '', deletedAt: null }
}

const elements = Object.fromEntries([
  'primaryNav', 'secondaryNav', 'bookmarkGrid', 'emptyState', 'viewTitle', 'viewMeta', 'searchInput',
  'trashButton', 'trashCount', 'contextMenu', 'toast', 'bookmarkDialog', 'bookmarkForm', 'bookmarkDialogTitle',
  'bookmarkId', 'bookmarkUrl', 'bookmarkTitle', 'bookmarkCategory', 'bookmarkDescription', 'bookmarkIconValue',
  'bookmarkColor', 'bookmarkBrowser', 'bookmarkFavorite', 'bookmarkQuick', 'bookmarkPreview', 'bookmarkError',
  'iconValueLabel', 'categoryDialog', 'categoryForm', 'newCategoryName', 'newCategoryParent', 'categoryList',
  'noteDialog', 'noteForm', 'noteTitle', 'noteBookmarkId', 'noteContent', 'settingsDialog', 'themeOptions',
  'restoreInput', 'importInput',
].map(id => [id, document.getElementById(id)]))

let state = loadState()
let contextBookmarkId = null
let insertAfterId = null
let toastTimer = null
let draggedBookmarkId = null

function storage() {
  return window.utools?.dbStorage || {
    getItem: key => JSON.parse(localStorage.getItem(key) || 'null'),
    setItem: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    removeItem: key => localStorage.removeItem(key),
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

function saveState() {
  storage().setItem(STORAGE_KEY, state)
}

function roots() {
  return state.categories.filter(category => !category.parentId)
}

function childrenOf(parentId) {
  return state.categories.filter(category => category.parentId === parentId)
}

function categoryName(id) {
  return state.categories.find(category => category.id === id)?.name || '收集箱'
}

function activeCategoryId() {
  return state.currentView.startsWith('category:') ? state.currentView.slice(9) : ''
}

function rootForCategory(id) {
  const category = state.categories.find(item => item.id === id)
  return category?.parentId || category?.id || ''
}

function viewBookmarks() {
  const keyword = elements.searchInput.value
  const active = state.bookmarks.filter(bookmark => !bookmark.deletedAt)
  let bookmarks

  if (keyword.trim()) bookmarks = active
  else if (state.currentView === 'all') bookmarks = active
  else if (state.currentView === 'favorites') bookmarks = active.filter(bookmark => bookmark.favorite)
  else if (state.currentView === 'quick') bookmarks = active.filter(bookmark => bookmark.quick)
  else if (state.currentView === 'inbox') bookmarks = active.filter(bookmark => !bookmark.categoryId)
  else if (state.currentView === 'trash') bookmarks = state.bookmarks.filter(bookmark => bookmark.deletedAt)
  else {
    const categoryId = activeCategoryId()
    const category = state.categories.find(item => item.id === categoryId)
    const ids = category && !category.parentId ? new Set([categoryId, ...childrenOf(categoryId).map(item => item.id)]) : new Set([categoryId])
    bookmarks = active.filter(bookmark => ids.has(bookmark.categoryId))
  }

  return bookmarks.filter(bookmark => bookmarkMatches(bookmark, keyword))
}

function render() {
  applyTheme()
  renderNavigation()
  renderBookmarks()
  updateCategoryOptions()
  const trashCount = state.bookmarks.filter(bookmark => bookmark.deletedAt).length
  elements.trashCount.textContent = trashCount
  elements.trashCount.hidden = trashCount === 0
}

function renderNavigation() {
  const activeRoot = rootForCategory(activeCategoryId())
  const navItems = [navButton('all', '全部', state.currentView === 'all')]
  for (const category of roots()) navItems.push(navButton(`category:${category.id}`, category.name, activeRoot === category.id))
  navItems.push('<span class="nav-spacer"></span>')
  navItems.push(navButton('favorites', '常用', state.currentView === 'favorites', 'star'))
  navItems.push(navButton('quick', '快开', state.currentView === 'quick', 'rocket'))
  navItems.push(navButton('inbox', '收集箱', state.currentView === 'inbox', 'inbox'))
  elements.primaryNav.innerHTML = navItems.join('')

  const secondary = childrenOf(activeRoot)
  elements.secondaryNav.hidden = secondary.length === 0
  elements.secondaryNav.innerHTML = secondary.map(category => `
    <button type="button" data-view="category:${escapeHtml(category.id)}" class="${activeCategoryId() === category.id ? 'active' : ''}">${escapeHtml(category.name)}</button>
  `).join('')
}

function navButton(view, label, active, icon = '') {
  return `<button type="button" data-view="${view}" class="${active ? 'active' : ''}">${icon ? `<span aria-hidden="true" class="nav-symbol ${icon}"></span>` : ''}${escapeHtml(label)}</button>`
}

function renderBookmarks() {
  const bookmarks = viewBookmarks()
  const title = viewTitle()
  elements.viewTitle.textContent = title
  elements.viewMeta.textContent = elements.searchInput.value.trim() ? `找到 ${bookmarks.length} 张卡片` : `${bookmarks.length} 张卡片`
  document.getElementById('manageCategoriesButton').textContent = state.currentView === 'trash' ? '清空废纸篓' : '管理分类'
  elements.emptyState.hidden = bookmarks.length !== 0
  elements.bookmarkGrid.hidden = bookmarks.length === 0
  elements.bookmarkGrid.innerHTML = bookmarks.map(bookmarkCard).join('')
}

function viewTitle() {
  if (elements.searchInput.value.trim()) return '搜索结果'
  const names = { all: '全部网址', favorites: '常用', quick: '网页快开', inbox: '收集箱', trash: '废纸篓' }
  return names[state.currentView] || categoryName(activeCategoryId())
}

function bookmarkCard(bookmark) {
  const icon = bookmark.iconType === 'image' && bookmark.icon
    ? `<img src="${escapeHtml(bookmark.icon)}" alt="" />`
    : escapeHtml(bookmark.icon || initials(bookmark.title))
  const note = bookmark.note ? `<button class="card-note" type="button" data-action="note" aria-label="打开 ${escapeHtml(bookmark.title)} 的笔记" title="卡片笔记"><span aria-hidden="true">≡</span></button>` : ''
  const favorite = bookmark.favorite ? '★' : '☆'

  return `<article class="bookmark-card" data-id="${escapeHtml(bookmark.id)}" draggable="${state.currentView !== 'trash'}">
    <button class="card-open" type="button" data-action="open" aria-label="打开 ${escapeHtml(bookmark.title)}"></button>
    <div class="bookmark-icon ${bookmark.iconType === 'image' ? 'image' : ''}" style="--bookmark-color:${safeColor(bookmark.color)}">${icon}</div>
    <div class="bookmark-copy"><h2>${escapeHtml(bookmark.title)}</h2><p>${escapeHtml(bookmark.description || displayHost(bookmark.url))}</p></div>
    <div class="card-actions">${note}<button type="button" data-action="favorite" class="favorite-button ${bookmark.favorite ? 'active' : ''}" aria-label="${bookmark.favorite ? '取消常用' : '加入常用'}" title="常用">${favorite}</button><button type="button" data-action="menu" aria-label="更多操作" title="更多操作">⋮</button></div>
  </article>`
}

function updateCategoryOptions() {
  const options = ['<option value="">收集箱</option>']
  for (const root of roots()) {
    options.push(`<option value="${escapeHtml(root.id)}">${escapeHtml(root.name)}</option>`)
    for (const child of childrenOf(root.id)) options.push(`<option value="${escapeHtml(child.id)}">　${escapeHtml(child.name)}</option>`)
  }
  elements.bookmarkCategory.innerHTML = options.join('')
}

function setView(view) {
  state.currentView = view
  elements.searchInput.value = ''
  saveState()
  closeContextMenu()
  render()
}

function openBookmarkDialog(bookmark = null, afterId = null) {
  const isEditing = Boolean(bookmark?.id)
  insertAfterId = afterId
  elements.bookmarkForm.reset()
  elements.bookmarkError.textContent = ''
  elements.bookmarkId.value = bookmark?.id || ''
  elements.bookmarkUrl.value = bookmark?.url || ''
  elements.bookmarkTitle.value = bookmark?.title || ''
  elements.bookmarkDescription.value = bookmark?.description || ''
  elements.bookmarkCategory.value = bookmark?.categoryId ?? defaultCategoryId()
  elements.bookmarkIconValue.value = bookmark?.icon || ''
  elements.bookmarkColor.value = safeColor(bookmark?.color || COLORS[state.bookmarks.length % COLORS.length])
  elements.bookmarkBrowser.value = bookmark?.browser || ''
  elements.bookmarkFavorite.checked = bookmark?.favorite || false
  elements.bookmarkQuick.checked = bookmark?.quick || false
  const iconType = bookmark?.iconType || 'text'
  elements.bookmarkForm.elements.iconType.value = iconType
  elements.bookmarkDialogTitle.textContent = isEditing ? '编辑卡片' : '添加卡片'
  updateIconField(iconType)
  updateBookmarkPreview()
  showDialog(elements.bookmarkDialog, elements.bookmarkUrl)
}

function defaultCategoryId() {
  const id = activeCategoryId()
  return state.categories.some(category => category.id === id) ? id : ''
}

function updateIconField(type) {
  elements.iconValueLabel.firstChild.textContent = type === 'image' ? '图片地址 ' : '图标文字 '
  elements.bookmarkIconValue.placeholder = type === 'image' ? 'https://.../logo.png' : 'FL'
}

function updateBookmarkPreview() {
  const type = elements.bookmarkForm.elements.iconType.value
  const value = elements.bookmarkIconValue.value || initials(elements.bookmarkTitle.value)
  elements.bookmarkPreview.style.background = elements.bookmarkColor.value
  elements.bookmarkPreview.innerHTML = type === 'image' && value ? `<img src="${escapeHtml(value)}" alt="" />` : escapeHtml(value || 'FL')
}

function saveBookmark(event) {
  event.preventDefault()
  let url
  try {
    url = normalizeUrl(elements.bookmarkUrl.value)
  } catch (error) {
    elements.bookmarkError.textContent = error.message
    elements.bookmarkUrl.focus()
    return
  }

  const id = elements.bookmarkId.value || `bookmark-${Date.now()}`
  const previous = state.bookmarks.find(bookmark => bookmark.id === id)
  const bookmark = {
    ...previous,
    id,
    url,
    title: elements.bookmarkTitle.value.trim(),
    description: elements.bookmarkDescription.value.trim(),
    categoryId: elements.bookmarkCategory.value,
    iconType: elements.bookmarkForm.elements.iconType.value,
    icon: elements.bookmarkIconValue.value.trim() || initials(elements.bookmarkTitle.value),
    color: elements.bookmarkColor.value,
    browser: elements.bookmarkBrowser.value,
    favorite: elements.bookmarkFavorite.checked,
    quick: elements.bookmarkQuick.checked,
    note: previous?.note || '',
    deletedAt: null,
  }

  if (previous) state.bookmarks[state.bookmarks.indexOf(previous)] = bookmark
  else if (insertAfterId) state.bookmarks.splice(state.bookmarks.findIndex(item => item.id === insertAfterId) + 1, 0, bookmark)
  else state.bookmarks.push(bookmark)

  syncQuickFeature(bookmark)
  saveState()
  elements.bookmarkDialog.close()
  showToast(previous ? '网址已更新' : '网址已添加')
  render()
}

function openNoteDialog(bookmark) {
  elements.noteBookmarkId.value = bookmark.id
  elements.noteTitle.textContent = `${bookmark.title} · 笔记`
  elements.noteContent.value = bookmark.note || ''
  showDialog(elements.noteDialog, elements.noteContent)
}

function saveNote(event) {
  event.preventDefault()
  const bookmark = state.bookmarks.find(item => item.id === elements.noteBookmarkId.value)
  if (!bookmark) return
  bookmark.note = elements.noteContent.value
  saveState()
  elements.noteDialog.close()
  showToast('笔记已保存')
  render()
}

function openLink(bookmark, query = '') {
  let url = bookmark.url
  if (url.includes('{q}')) {
    const keyword = query || elements.searchInput.value.trim() || window.prompt(`在 ${bookmark.title} 中搜索`) || ''
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
  render()
}

function toggleQuick(bookmark) {
  bookmark.quick = !bookmark.quick
  syncQuickFeature(bookmark)
  saveState()
  showToast(bookmark.quick ? '已开启网页快开' : '已关闭网页快开')
  render()
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

function moveToTrash(bookmark) {
  bookmark.previousCategoryId = bookmark.categoryId
  bookmark.deletedAt = Date.now()
  bookmark.quick = false
  syncQuickFeature(bookmark)
  saveState()
  showToast('已移到废纸篓')
  render()
}

function restoreBookmark(bookmark) {
  bookmark.categoryId = state.categories.some(category => category.id === bookmark.previousCategoryId) ? bookmark.previousCategoryId : ''
  bookmark.deletedAt = null
  delete bookmark.previousCategoryId
  saveState()
  showToast('网址已恢复')
  render()
}

function deleteBookmark(bookmark) {
  if (!window.confirm(`永久删除“${bookmark.title}”？此操作无法撤销。`)) return
  state.bookmarks = state.bookmarks.filter(item => item.id !== bookmark.id)
  window.utools?.removeFeature?.(`open-link@${bookmark.id}`)
  saveState()
  showToast('网址已永久删除')
  render()
}

function emptyTrash() {
  const deleted = state.bookmarks.filter(bookmark => bookmark.deletedAt)
  if (!deleted.length) return showToast('废纸篓已经是空的')
  if (!window.confirm(`永久删除废纸篓中的 ${deleted.length} 个网址？此操作无法撤销。`)) return
  state.bookmarks = state.bookmarks.filter(bookmark => !bookmark.deletedAt)
  saveState()
  showToast('废纸篓已清空')
  render()
}

function showContextMenu(bookmark, x, y) {
  contextBookmarkId = bookmark.id
  const items = bookmark.deletedAt
    ? [['restore', '恢复'], ['delete', '永久删除']]
    : [['append', '追加网址'], ['edit', '编辑'], ['note', bookmark.note ? '编辑笔记' : '记录笔记'], ['quick', bookmark.quick ? '关闭网页快开' : '网页快开'], ['favorite', bookmark.favorite ? '取消常用' : '加入常用'], ['trash', '移到废纸篓']]
  elements.contextMenu.innerHTML = items.map(([action, label], index) => `${index === items.length - 1 ? '<span class="menu-divider"></span>' : ''}<button type="button" role="menuitem" data-menu-action="${action}">${label}</button>`).join('')
  elements.contextMenu.hidden = false
  const menuRect = elements.contextMenu.getBoundingClientRect()
  elements.contextMenu.style.left = `${Math.min(x, window.innerWidth - menuRect.width - 8)}px`
  elements.contextMenu.style.top = `${Math.min(y, window.innerHeight - menuRect.height - 8)}px`
  elements.contextMenu.querySelector('button')?.focus()
}

function closeContextMenu() {
  elements.contextMenu.hidden = true
  contextBookmarkId = null
}

function handleContextAction(action) {
  const bookmark = state.bookmarks.find(item => item.id === contextBookmarkId)
  closeContextMenu()
  if (!bookmark) return
  if (action === 'append') openBookmarkDialog(null, bookmark.id)
  if (action === 'edit') openBookmarkDialog(bookmark)
  if (action === 'note') openNoteDialog(bookmark)
  if (action === 'quick') toggleQuick(bookmark)
  if (action === 'favorite') toggleFavorite(bookmark)
  if (action === 'trash') moveToTrash(bookmark)
  if (action === 'restore') restoreBookmark(bookmark)
  if (action === 'delete') deleteBookmark(bookmark)
}

function renderCategories() {
  elements.newCategoryParent.innerHTML = '<option value="">无，创建一级分类</option>' + roots().map(root => `<option value="${escapeHtml(root.id)}">${escapeHtml(root.name)}</option>`).join('')
  elements.categoryList.innerHTML = roots().map((root, rootIndex) => `
    <section class="category-group">
      ${categoryRow(root, rootIndex, roots().length)}
      <div class="category-children">${childrenOf(root.id).map((child, index, all) => categoryRow(child, index, all.length)).join('')}</div>
    </section>
  `).join('')
}

function categoryRow(category, index, total) {
  return `<div class="category-row" data-id="${escapeHtml(category.id)}"><span class="category-level" aria-hidden="true">${category.parentId ? '↳' : '•'}</span><strong>${escapeHtml(category.name)}</strong><span>${categoryCount(category.id)}</span><div class="category-actions"><button type="button" data-category-action="up" aria-label="上移" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-category-action="down" aria-label="下移" ${index === total - 1 ? 'disabled' : ''}>↓</button><button type="button" data-category-action="rename">重命名</button><button type="button" data-category-action="delete" class="danger-text">删除</button></div></div>`
}

function categoryCount(categoryId) {
  const ids = new Set([categoryId, ...childrenOf(categoryId).map(item => item.id)])
  return state.bookmarks.filter(bookmark => !bookmark.deletedAt && ids.has(bookmark.categoryId)).length
}

function addCategory(event) {
  event.preventDefault()
  const name = elements.newCategoryName.value.trim()
  if (!name) return
  state.categories.push({ id: `category-${Date.now()}`, name, parentId: elements.newCategoryParent.value })
  elements.newCategoryName.value = ''
  saveState()
  renderCategories()
  render()
}

function categoryAction(id, action) {
  const category = state.categories.find(item => item.id === id)
  if (!category) return
  if (action === 'rename') {
    const name = window.prompt('新的分类名称', category.name)?.trim()
    if (name) category.name = name
  }
  if (action === 'delete') {
    const descendants = new Set([id, ...childrenOf(id).map(item => item.id)])
    if (!window.confirm(`删除“${category.name}”？分类中的网址会移到收集箱。`)) return
    state.categories = state.categories.filter(item => !descendants.has(item.id))
    state.bookmarks.forEach(bookmark => { if (descendants.has(bookmark.categoryId)) bookmark.categoryId = '' })
    if (descendants.has(activeCategoryId())) state.currentView = 'inbox'
  }
  if (action === 'up' || action === 'down') {
    const siblings = state.categories.filter(item => item.parentId === category.parentId)
    const index = siblings.findIndex(item => item.id === id)
    const target = siblings[index + (action === 'up' ? -1 : 1)]
    if (target) {
      const categoryIndex = state.categories.indexOf(category)
      const targetIndex = state.categories.indexOf(target)
      state.categories[categoryIndex] = target
      state.categories[targetIndex] = category
    }
  }
  saveState()
  renderCategories()
  render()
}

function cycleTheme() {
  const order = ['system', 'light', 'dark']
  state.theme = order[(order.indexOf(state.theme) + 1) % order.length]
  saveState()
  applyTheme()
  showToast({ system: '跟随系统主题', light: '已切换浅色主题', dark: '已切换深色主题' }[state.theme])
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme
  elements.themeOptions?.querySelectorAll('input').forEach(option => { option.checked = option.value === state.theme })
}

function setTheme(theme) {
  state.theme = theme
  saveState()
  applyTheme()
}

function exportBackup() {
  const content = JSON.stringify(state, null, 2)
  if (window.funlink?.saveBackup?.(content)) {
    showToast('备份已导出')
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  link.download = `funlink-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  showToast('备份已导出')
}

async function chooseDataFile(type) {
  const extensions = type === 'restore' ? ['json'] : ['html', 'htm']
  const content = window.funlink?.chooseTextFile?.(extensions)
  if (content) return processDataFile(type, content)
  elements[type === 'restore' ? 'restoreInput' : 'importInput'].click()
}

function processDataFile(type, content) {
  try {
    if (type === 'restore') {
      state = validateState(JSON.parse(content))
      saveState()
      render()
      showToast('备份已恢复')
      elements.settingsDialog.close()
      return
    }
    const imported = parseBookmarkHtml(content)
    const categoryId = `category-import-${Date.now()}`
    state.categories.push({ id: categoryId, name: '导入书签', parentId: '' })
    const existing = new Set(state.bookmarks.map(bookmark => bookmark.url))
    const bookmarks = imported.filter(bookmark => !existing.has(bookmark.url)).map((bookmark, index) => ({
      ...bookmark,
      id: `bookmark-import-${Date.now()}-${index}`,
      description: displayHost(bookmark.url),
      categoryId,
      color: COLORS[index % COLORS.length],
      iconType: 'text',
      icon: initials(bookmark.title),
      browser: '', favorite: false, quick: false, note: '', deletedAt: null,
    }))
    state.bookmarks.push(...bookmarks)
    state.currentView = `category:${categoryId}`
    saveState()
    render()
    elements.settingsDialog.close()
    showToast(`已导入 ${bookmarks.length} 个网址`)
  } catch (error) {
    showToast(error.message, true)
  }
}

function showDialog(dialog, focusTarget) {
  closeContextMenu()
  if (!dialog.open) dialog.showModal()
  requestAnimationFrame(() => focusTarget?.focus())
}

function showToast(message, error = false) {
  clearTimeout(toastTimer)
  elements.toast.textContent = message
  elements.toast.classList.toggle('error', error)
  elements.toast.hidden = false
  toastTimer = setTimeout(() => { elements.toast.hidden = true }, 3200)
}

function displayHost(url) {
  try { return new URL(url).hostname || url } catch { return url }
}

function safeColor(value) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value : '#16b8c7'
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
}

function setupUtools() {
  window.utools?.setExpendHeight?.(558)
  window.utools?.setSubInput?.(({ text }) => {
    elements.searchInput.value = text || ''
    renderBookmarks()
  }, '搜索卡片', true)

  window.funlink?.onEnter(action => {
    if (action.code?.startsWith('open-link@')) {
      const bookmark = state.bookmarks.find(item => item.id === action.code.slice(10))
      if (bookmark) {
        openLink(bookmark, action.payload)
        window.utools?.outPlugin?.()
      }
      return
    }
    window.utools?.setExpendHeight?.(558)
    if (action.code === 'add-link') openBookmarkDialog({ url: String(action.payload || '').trim() })
    if (action.code === 'search-link') {
      elements.searchInput.value = String(action.payload || '')
      renderBookmarks()
    }
  })

  window.utools?.onMainPush?.(({ payload }) => state.bookmarks
    .filter(bookmark => !bookmark.deletedAt && !bookmark.url.includes('{q}') && bookmarkMatches(bookmark, payload))
    .slice(0, 6)
    .map(bookmark => ({ icon: 'logo.png', text: bookmark.title, title: bookmark.description || displayHost(bookmark.url), bookmarkId: bookmark.id })),
  ({ payload, option }) => {
    const bookmark = state.bookmarks.find(item => item.id === option.bookmarkId)
    if (bookmark) openLink(bookmark, payload)
  })
}

document.addEventListener('click', event => {
  const view = event.target.closest('[data-view]')?.dataset.view
  if (view) return setView(view)

  const card = event.target.closest('.bookmark-card')
  const action = event.target.closest('[data-action]')?.dataset.action
  if (card && action) {
    const bookmark = state.bookmarks.find(item => item.id === card.dataset.id)
    if (!bookmark) return
    if (action === 'open') openLink(bookmark)
    if (action === 'favorite') toggleFavorite(bookmark)
    if (action === 'note') openNoteDialog(bookmark)
    if (action === 'menu') {
      const button = event.target.closest('[data-action="menu"]')
      const rect = button.getBoundingClientRect()
      showContextMenu(bookmark, rect.right - 184, rect.bottom + 4)
    }
    return
  }

  const menuAction = event.target.closest('[data-menu-action]')?.dataset.menuAction
  if (menuAction) return handleContextAction(menuAction)
  if (!event.target.closest('#contextMenu')) closeContextMenu()
})

elements.bookmarkGrid.addEventListener('contextmenu', event => {
  const card = event.target.closest('.bookmark-card')
  if (!card) return
  event.preventDefault()
  const bookmark = state.bookmarks.find(item => item.id === card.dataset.id)
  if (bookmark) showContextMenu(bookmark, event.clientX, event.clientY)
})

elements.bookmarkGrid.addEventListener('dragstart', event => {
  draggedBookmarkId = event.target.closest('.bookmark-card')?.dataset.id || null
  if (draggedBookmarkId) event.dataTransfer.effectAllowed = 'move'
})
elements.bookmarkGrid.addEventListener('dragover', event => { if (event.target.closest('.bookmark-card')) event.preventDefault() })
elements.bookmarkGrid.addEventListener('drop', event => {
  const targetId = event.target.closest('.bookmark-card')?.dataset.id
  if (!draggedBookmarkId || !targetId) return
  event.preventDefault()
  state.bookmarks = moveItem(state.bookmarks, draggedBookmarkId, targetId)
  draggedBookmarkId = null
  saveState()
  renderBookmarks()
})

document.getElementById('homeButton').addEventListener('click', () => setView('all'))
document.getElementById('addButton').addEventListener('click', () => openBookmarkDialog())
document.getElementById('emptyAddButton').addEventListener('click', () => openBookmarkDialog())
document.getElementById('themeButton').addEventListener('click', cycleTheme)
document.getElementById('settingsButton').addEventListener('click', () => showDialog(elements.settingsDialog))
document.getElementById('manageCategoriesButton').addEventListener('click', () => {
  if (state.currentView === 'trash') return emptyTrash()
  renderCategories()
  showDialog(elements.categoryDialog, elements.newCategoryName)
})
elements.trashButton.addEventListener('click', () => setView('trash'))
elements.trashButton.addEventListener('contextmenu', event => { event.preventDefault(); emptyTrash() })
elements.searchInput.addEventListener('input', renderBookmarks)
elements.bookmarkForm.addEventListener('submit', saveBookmark)
elements.noteForm.addEventListener('submit', saveNote)
elements.categoryForm.addEventListener('submit', addCategory)

elements.bookmarkUrl.addEventListener('blur', () => {
  try {
    const url = normalizeUrl(elements.bookmarkUrl.value)
    elements.bookmarkUrl.value = url
    if (!elements.bookmarkTitle.value) elements.bookmarkTitle.value = displayHost(url).replace(/^www\./, '')
    if (!elements.bookmarkIconValue.value) elements.bookmarkIconValue.value = initials(elements.bookmarkTitle.value)
    elements.bookmarkError.textContent = ''
    updateBookmarkPreview()
  } catch (error) {
    if (elements.bookmarkUrl.value.trim()) elements.bookmarkError.textContent = error.message
  }
})
elements.bookmarkTitle.addEventListener('input', updateBookmarkPreview)
elements.bookmarkIconValue.addEventListener('input', updateBookmarkPreview)
elements.bookmarkColor.addEventListener('input', updateBookmarkPreview)
elements.bookmarkForm.addEventListener('change', event => {
  if (event.target.name === 'iconType') {
    updateIconField(event.target.value)
    updateBookmarkPreview()
  }
})

elements.categoryList.addEventListener('click', event => {
  const button = event.target.closest('[data-category-action]')
  if (button) categoryAction(button.closest('[data-id]').dataset.id, button.dataset.categoryAction)
})
elements.themeOptions.addEventListener('change', event => setTheme(event.target.value))
document.getElementById('exportButton').addEventListener('click', exportBackup)
document.getElementById('restoreButton').addEventListener('click', () => chooseDataFile('restore'))
document.getElementById('importButton').addEventListener('click', () => chooseDataFile('import'))
document.getElementById('resetButton').addEventListener('click', () => {
  if (!window.confirm('恢复示例数据？当前数据会被覆盖。')) return
  state.bookmarks.filter(bookmark => bookmark.quick).forEach(bookmark => window.utools?.removeFeature?.(`open-link@${bookmark.id}`))
  state = seedState()
  saveState()
  render()
  elements.settingsDialog.close()
  showToast('已恢复示例数据')
})

elements.restoreInput.addEventListener('change', async () => {
  const file = elements.restoreInput.files[0]
  if (file) processDataFile('restore', await file.text())
  elements.restoreInput.value = ''
})
elements.importInput.addEventListener('change', async () => {
  const file = elements.importInput.files[0]
  if (file) processDataFile('import', await file.text())
  elements.importInput.value = ''
})

document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()))
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
}))

document.addEventListener('keydown', event => {
  if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    event.preventDefault()
    elements.searchInput.focus()
  }
  if (event.key === 'Escape') closeContextMenu()
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && elements.noteDialog.open) {
    event.preventDefault()
    elements.noteForm.requestSubmit()
  }
})

render()
setupUtools()
