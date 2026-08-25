export const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'file:'])

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

export function bookmarkMatches(bookmark, keyword, fields = ['title', 'description', 'url']) {
  const query = String(keyword || '').trim().toLocaleLowerCase()
  if (!query) return true
  return fields.map(field => bookmark[field])
    .filter(Boolean)
    .some(value => String(value).toLocaleLowerCase().includes(query))
}

export function initials(title) {
  const words = String(title || 'FL').trim().split(/\s+/)
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0]).slice(0, 2).toUpperCase()
}

export function normalizeCategoryIds(categoryIds, fallback = 'cat@default') {
  const ids = Array.isArray(categoryIds) ? categoryIds.filter(id => typeof id === 'string' && id) : []
  return ids.length ? [...new Set(ids)] : [fallback]
}

export function moveItem(items, sourceId, targetId) {
  const from = items.findIndex(item => item.id === sourceId)
  const to = items.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0 || from === to) return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

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

export function validateState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.categories) || !Array.isArray(value.bookmarks)) {
    throw new Error('不是有效的 FunLink 备份')
  }
  value.bookmarks.forEach(bookmark => normalizeUrl(bookmark.url))
  return value
}

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
