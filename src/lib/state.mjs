import { migrateState, normalizeCategoryIds, validateState } from './core.mjs'

// 纯状态逻辑：不依赖 vue / uTools / 示例数据，方便直接跑单测。
export const STORAGE_KEY = 'funlink-state-v1'

export const DEFAULT_SETTINGS = {
  browser: { isOpenIn: false, width: 1000, height: 680 },
  search: ['title', 'description', 'url'],
  importSplit: '-,_,|,:,/,||',
  navbar: { rounded: 36 },
}

/** 读取书签的兼容分类 ID 列表。 @param {object} bookmark @returns {string[]} */
export function categoryIdsOf(bookmark) {
  return bookmark.categoryIds || (bookmark.categoryId ? [bookmark.categoryId] : [])
}

/** 创建空白应用状态。 @returns {object} */
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

/** 补齐状态中的默认配置和兼容字段。 @param {object} state @returns {object} */
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

/** 校验、迁移并补齐已保存状态。 @param {unknown} saved @returns {{state: object, dropped: number}} */
export function prepareState(saved) {
  const { state, dropped } = migrateState(validateState(saved))
  return { state: hydrateState(state), dropped }
}

// 读不出来时绝不能拿演示数据顶上——那会在下一次写入时覆盖掉用户的真实数据。
// 返回 blocked 时由界面提示用户，并暂停一切写入。
/** 从存储读取状态，失败时返回只读提示而不覆盖数据。 @param {{read: Function, seed: Function}} deps @returns {{state: object, blocked: string, dropped: number}} */
export function loadState({ read, seed }) {
  let saved
  try {
    saved = read(STORAGE_KEY)
  } catch (error) {
    return { state: emptyState(), blocked: `本地数据读取失败：${error.message}。`, dropped: 0 }
  }
  if (!saved) return { state: seed(), blocked: '', dropped: 0 }
  try {
    const { state, dropped } = prepareState(saved)
    return { state, blocked: '', dropped }
  } catch (error) {
    return { state: emptyState(), blocked: `本地数据无法解析：${error.message}。`, dropped: 0 }
  }
}
