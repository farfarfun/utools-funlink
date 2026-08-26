import { migrateState, normalizeCategoryIds, validateState } from './core.mjs'

// 纯状态逻辑：不依赖 vue / uTools / 示例数据，方便直接跑单测。
export const STORAGE_KEY = 'funlink-state-v1'

export const DEFAULT_SETTINGS = {
  browser: { isOpenIn: false, width: 1000, height: 680 },
  search: ['title', 'description', 'url'],
  importSplit: '-,_,|,:,/,||',
  navbar: { rounded: 36 },
}

export function categoryIdsOf(bookmark) {
  return bookmark.categoryIds || (bookmark.categoryId ? [bookmark.categoryId] : [])
}

export function emptyState() {
  return {
    version: 1,
    theme: 'system',
    currentView: 'inbox',
    lastCategoryId: '',
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    categories: [],
    bookmarks: [],
  }
}

export function hydrateState(state) {
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...state.settings,
    browser: { ...DEFAULT_SETTINGS.browser, ...state.settings?.browser },
    navbar: { ...DEFAULT_SETTINGS.navbar, ...state.settings?.navbar },
    search: state.settings?.search?.length ? state.settings.search : DEFAULT_SETTINGS.search.slice(),
  }
  state.theme ||= 'system'
  state.currentView ||= 'inbox'
  // migrateState 已保证 categoryIds 非空，这里再兜一次，避免手工编辑过的备份。
  state.bookmarks.forEach(bookmark => {
    bookmark.categoryIds = normalizeCategoryIds(categoryIdsOf(bookmark))
    bookmark.categoryId = bookmark.categoryIds[0]
  })
  state.lastCategoryId ||= state.currentView.startsWith('category:') ? state.currentView.slice(9) : state.categories[0]?.id || ''
  return state
}

export function prepareState(saved) {
  const { state, dropped } = migrateState(validateState(saved))
  return { state: hydrateState(state), dropped }
}

// 读不出来时绝不能拿演示数据顶上——那会在下一次写入时覆盖掉用户的真实数据。
// 返回 blocked 时由界面提示用户，并暂停一切写入。
export function loadState({ read, seed }) {
  let saved
  try {
    saved = read(STORAGE_KEY)
  } catch (error) {
    console.error(error)
    return { state: emptyState(), blocked: `本地数据读取失败：${error.message}。`, dropped: 0 }
  }
  if (!saved) return { state: seed(), blocked: '', dropped: 0 }
  try {
    const { state, dropped } = prepareState(saved)
    return { state, blocked: '', dropped }
  } catch (error) {
    console.error(error)
    return { state: emptyState(), blocked: `本地数据无法解析：${error.message}。`, dropped: 0 }
  }
}
