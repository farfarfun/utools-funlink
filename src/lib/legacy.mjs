import { initials, isSafeUrl } from './core.mjs'
import { DEFAULT_SETTINGS } from './state.mjs'

// 「网址精灵」导出的备份结构：
//   { db: [...], flyDb: [...] }        完整导出
//   [ ... ]                            裸文档数组（本项目的示例数据即此形状）
//
// db 里混放着几类文档，靠字段区分：
//   分类   { _id: 'cat_x', label, pid, tabPosition }
//   网址   { _id: 'web_x', title, url, desc, catIds, icon, isFly, isOften, urls, browser }
//   笔记   { _id: 'note_x', content }        —— 后缀与 web_x 对应
//   设置   { _id: 'setting', value: {...} }
//   排序   { _id: 'sort_cat@category' | 'sort_web@<catId>', value: [...] }
//   其它   cookie@... 等，直接忽略
const COLORS = ['#16b8c7', '#2563eb', '#7c3aed', '#db2777', '#e85d3f', '#0f9f6e', '#64748b']
// cat@dustbin / cat@fly / cat@often 是状态标记而非真实分类，只有 cat@default（收集箱）要保留。
const MARKER_CATEGORY_IDS = new Set(['cat@dustbin', 'cat@fly', 'cat@often'])
const SPECIAL_CATEGORY_IDS = new Set(['cat@default', ...MARKER_CATEGORY_IDS])
const KNOWN_BROWSERS = new Set([
  'default', 'system', 'inner', 'chrome', 'chrome-incognito',
  'edge', 'edge-inprivate', 'safari', 'firefox',
])

export function isLegacyExport(value) {
  if (Array.isArray(value)) return true
  return Boolean(value && typeof value === 'object' && Array.isArray(value.db))
}

function normalizeBrowser(value) {
  // 老数据里出现过数字（0 / 2）之类的历史值，一律回落到「跟随默认设置」。
  return typeof value === 'string' && KNOWN_BROWSERS.has(value) ? value : 'default'
}

function orderedCategories(categories, sortDoc) {
  const order = Array.isArray(sortDoc?.value) ? sortDoc.value : null
  if (!order) return categories
  const byId = new Map(categories.map(category => [category.id, category]))
  const result = []
  const take = id => {
    const category = byId.get(id)
    if (!category) return
    byId.delete(id)
    result.push(category)
  }
  order.forEach(root => {
    take(root?._id)
    ;(Array.isArray(root?.children) ? root.children : []).forEach(child => take(child?._id))
  })
  // 排序表里没提到的分类（可能是后来加的）按原顺序补在后面。
  categories.forEach(category => { if (byId.has(category.id)) take(category.id) })
  return result
}

function orderedBookmarks(bookmarks, categories, sortLists) {
  const byId = new Map(bookmarks.map(bookmark => [bookmark.id, bookmark]))
  const result = []
  const take = id => {
    const bookmark = byId.get(id)
    if (!bookmark) return
    byId.delete(id)
    result.push(bookmark)
  }
  // 按分类顺序铺开，让同一分类的卡片在数组里连续，拖拽排序才符合直觉。
  const categoryIds = [...categories.map(category => category.id), 'cat@default']
  categoryIds.forEach(categoryId => {
    const list = sortLists.get(categoryId)
    if (Array.isArray(list)) list.forEach(id => take(id))
  })
  bookmarks.forEach(bookmark => { if (byId.has(bookmark.id)) take(bookmark.id) })
  return result
}

export function convertLegacyExport(raw) {
  const docs = (Array.isArray(raw) ? raw : raw?.db) || []
  if (!Array.isArray(docs)) throw new Error('不是有效的网址精灵备份')

  const notes = new Map()
  const sortLists = new Map()
  let sortCategoryDoc = null
  let settingDoc = null
  const categoryDocs = []
  const bookmarkDocs = []

  docs.forEach(doc => {
    if (!doc || typeof doc !== 'object') return
    const id = typeof doc._id === 'string' ? doc._id : ''
    if (id === 'setting') settingDoc = doc
    else if (id === 'sort_cat@category') sortCategoryDoc = doc
    else if (id.startsWith('sort_web@')) sortLists.set(id.slice(9), doc.value)
    else if (doc.content != null && id.startsWith('note_')) notes.set(id.replace(/^note_/, 'web_'), doc.content)
    else if (doc.label != null && !SPECIAL_CATEGORY_IDS.has(id)) categoryDocs.push(doc)
    else if (doc.title && doc.url) bookmarkDocs.push(doc)
  })

  const categories = orderedCategories(
    categoryDocs.map(doc => ({
      id: doc._id,
      name: String(doc.label || '').trim() || '未命名分类',
      parentId: SPECIAL_CATEGORY_IDS.has(doc.pid) ? '' : doc.pid || '',
      tabPosition: doc.tabPosition || 'top',
    })),
    sortCategoryDoc,
  )

  const categoryIds = new Set(categories.map(category => category.id))
  const usable = bookmarkDocs.filter(doc => isSafeUrl(doc.url))
  const bookmarks = usable.map((doc, index) => {
    const rawCatIds = Array.isArray(doc.catIds) ? doc.catIds : []
    const own = rawCatIds.filter(id => categoryIds.has(id) || id === 'cat@default')
    const icon = doc.icon || {}
    // 原插件的 image 图标多数没有随附数据（图是去第三方 favicon 现取的），
    // 这类一律转成文字图标，否则导入后满屏空白圆圈。
    const hasImage = icon.type === 'image' && Boolean(icon.data)
    const title = String(doc.title).trim()
    return {
      id: doc._id || `web_${index}`,
      title,
      url: doc.url,
      urls: (Array.isArray(doc.urls) ? doc.urls : [])
        .map(item => (typeof item === 'string' ? item : item?.value))
        .filter(url => url && isSafeUrl(url)),
      description: doc.desc || '',
      categoryId: own[0] || 'cat@default',
      categoryIds: own.length ? own : ['cat@default'],
      color: icon.textColor || COLORS[index % COLORS.length],
      iconType: hasImage ? 'image' : 'text',
      icon: icon.text || initials(title),
      iconSize: icon.fontSize || 16,
      iconData: hasImage ? icon.data : '',
      browser: normalizeBrowser(doc.browser),
      favorite: Boolean(doc.isOften),
      quick: Boolean(doc.isFly),
      note: notes.get(doc._id) || '',
      hasNote: Boolean(doc.hasNote) || notes.has(doc._id),
      // 原插件用 cat@dustbin 标记废纸篓，这里转成 deletedAt 时间戳。
      deletedAt: rawCatIds.includes('cat@dustbin') ? 1 : null,
    }
  })

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(settingDoc?.value || {}),
    browser: { ...DEFAULT_SETTINGS.browser, ...(settingDoc?.value?.browser || {}) },
    navbar: { ...DEFAULT_SETTINGS.navbar, ...(settingDoc?.value?.navbar || {}) },
    search: settingDoc?.value?.search?.length ? settingDoc.value.search : DEFAULT_SETTINGS.search.slice(),
  }
  // 原插件用 desc 作为简介字段名，搜索配置里的 desc 要换成本项目的 description。
  settings.search = [...new Set(settings.search.map(field => (field === 'desc' ? 'description' : field)))]

  const firstRoot = categories.find(category => !category.parentId)
  return {
    state: {
      version: 1,
      theme: 'system',
      currentView: firstRoot ? `category:${firstRoot.id}` : 'inbox',
      lastCategoryId: firstRoot?.id || '',
      settings,
      categories,
      bookmarks: orderedBookmarks(bookmarks, categories, sortLists),
    },
    dropped: bookmarkDocs.length - usable.length,
  }
}
