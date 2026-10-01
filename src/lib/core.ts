export const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'file:'])

/** 将输入规范化为允许协议的绝对 URL。 @param {unknown} value @returns {string} */
export function normalizeUrl(value) {
  const input = String(value || '').trim()
  if (!input) throw new Error('请输入网址')
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`
  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('网址格式不正确')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error('仅支持 http、https、ftp 和 file 网址')
  return url.href
}

/** 判断书签是否匹配搜索词。 @param {object} bookmark @param {unknown} keyword @param {string[]} fields @returns {boolean} */
export function bookmarkMatches(bookmark, keyword, fields = ['title', 'description', 'url']) {
  const query = String(keyword || '').trim().toLocaleLowerCase()
  if (!query) return true
  return fields.map(field => bookmark[field])
    .filter(Boolean)
    .some(value => String(value).toLocaleLowerCase().includes(query))
}

/** 从标题生成最多两个字符的图标缩写。 @param {unknown} title @returns {string} */
export function initials(title) {
  const words = String(title || 'FL').trim().split(/\s+/)
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0]).slice(0, 2).toUpperCase()
}

/** 清理分类 ID 并保证至少保留一个默认分类。 @param {unknown} categoryIds @param {string} fallback @returns {string[]} */
export function normalizeCategoryIds(categoryIds, fallback = 'cat@default') {
  const ids = Array.isArray(categoryIds) ? categoryIds.filter(id => typeof id === 'string' && id) : []
  return ids.length ? [...new Set(ids)] : [fallback]
}

let idCounter = 0

/** 生成不会在同一进程内重复的实体 ID。 @param {string} prefix @returns {string} */
export function createId(prefix = 'id') {
  idCounter += 1
  const unique = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${unique}`
}

// 1.0 之前的卡片只有 categoryId / previousCategoryId，这里补齐为数组形式。
/** 将旧版书签迁移为当前结构。 @param {object} bookmark @returns {object} */
export function migrateBookmark(bookmark) {
  const next = { ...bookmark }
  const categoryIds = Array.isArray(bookmark.categoryIds) && bookmark.categoryIds.length
    ? bookmark.categoryIds
    : [bookmark.categoryId].filter(Boolean)
  next.categoryIds = normalizeCategoryIds(categoryIds)
  next.categoryId = next.categoryIds[0]

  const previous = Array.isArray(bookmark.previousCategoryIds)
    ? bookmark.previousCategoryIds
    : [bookmark.previousCategoryId].filter(Boolean)
  if (previous.length) next.previousCategoryIds = previous.filter(id => typeof id === 'string' && id)
  delete next.previousCategoryId

  // 旧版把 iconType 默认设成 image 却从不写 iconData——图标是去第三方 favicon 服务现取的。
  // 现在不再外部取图，这类卡片回落成文字图标，否则会显示成空白圆圈。
  if (next.iconType === 'image' && !next.iconData) next.iconType = 'text'
  return next
}

// 丢弃协议不安全的卡片（例如 javascript:），但不因为单条脏数据让整次恢复失败。
/** 迁移并过滤备份状态中的不安全网址。 @param {object} value @returns {{state: object, dropped: number}} */
export function migrateState(value) {
  const bookmarks = value.bookmarks.filter(bookmark => isSafeUrl(bookmark?.url)).map(migrateBookmark)
  return {
    state: {
      ...value,
      categories: value.categories.map(category => ({
        id: category.id,
        name: category.name || '',
        parentId: category.parentId || '',
        tabPosition: category.tabPosition || 'top',
      })),
      bookmarks,
    },
    dropped: value.bookmarks.length - bookmarks.length,
  }
}

// 导入书签时按用户配置的分隔符把「名称 - 简介」拆开，长分隔符优先。
/** 按配置分隔符拆分导入书签标题。 @param {unknown} rawTitle @param {string} separators @returns {{title: string, description: string}} */
export function splitTitle(rawTitle, separators = '') {
  const title = String(rawTitle || '').trim()
  const marks = String(separators || '')
    .split(',')
    .map(mark => mark.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const mark of marks) {
    const index = title.indexOf(mark)
    if (index > 0 && index < title.length - mark.length) {
      return { title: title.slice(0, index).trim(), description: title.slice(index + mark.length).trim() }
    }
  }
  return { title, description: '' }
}

/** 将列表项移动到目标项位置。 @param {object[]} items @param {string} sourceId @param {string} targetId @returns {object[]} */
export function moveItem(items, sourceId, targetId) {
  const from = items.findIndex(item => item.id === sourceId)
  const to = items.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0 || from === to) return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** 移动分类并更新父分类。 @param {object[]} items @param {string} sourceId @param {string} parentId @param {string} targetId @returns {object[]} */
export function moveCategory(items, sourceId, parentId, targetId = '') {
  const from = items.findIndex(item => item.id === sourceId)
  if (from < 0 || sourceId === targetId) return items
  const next = items.slice()
  const category = { ...next.splice(from, 1)[0] }
  category.parentId = parentId
  const target = targetId ? next.findIndex(item => item.id === targetId) : -1
  if (target >= 0) next.splice(target, 0, category)
  else {
    const sibling = next.reduce((last, item, index) => item.parentId === parentId ? index : last, -1)
    next.splice(sibling + 1, 0, category)
  }
  return next
}

/** 验证 FunLink 备份的基本结构。 @param {unknown} value @returns {object} */
export function validateState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.categories) || !Array.isArray(value.bookmarks)) {
    throw new Error('不是有效的 FunLink 备份')
  }
  return value
}

/** 判断网址是否使用允许的协议。 @param {unknown} value @returns {boolean} */
export function isSafeUrl(value) {
  try {
    normalizeUrl(value)
    return true
  } catch {
    return false
  }
}

/** 从浏览器书签 HTML 中提取去重后的网址。 @param {string} html @returns {{title: string, url: string}[]} */
export function parseBookmarkHtml(html) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return [...document.querySelectorAll('a[href]')].flatMap(anchor => {
    try {
      const url = normalizeUrl(anchor.getAttribute('href'))
      return [{ title: anchor.textContent.trim() || new URL(url).hostname, url }]
    } catch {
      return []
    }
  }).filter((bookmark, index, all) => all.findIndex(item => item.url === bookmark.url) === index)
}
