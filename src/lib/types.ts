// 公开数据结构的类型定义。这里只约束 lib/* 纯函数之间传递的形状，
// 字段故意保持宽松（可选 + 索引签名），因为状态要兼容「网址精灵」旧备份
// 和早于 1.0 的本地存档，严格到完全对齐当前结构反而会把合法的旧数据挡在外面。

export type BrowserMode =
  | 'default' | 'system' | 'inner'
  | 'chrome' | 'chrome-incognito'
  | 'edge' | 'edge-inprivate'
  | 'safari' | 'firefox' | ''

export interface Bookmark {
  id: string
  title: string
  url: string
  urls?: string[]
  description?: string
  categoryId?: string
  categoryIds?: string[]
  previousCategoryIds?: string[]
  iconType?: 'text' | 'image'
  icon?: string
  iconData?: string
  iconSize?: number
  color?: string
  browser?: BrowserMode
  favorite?: boolean
  quick?: boolean
  note?: string
  hasNote?: boolean
  deletedAt?: number | null
  [key: string]: unknown
}

export interface Category {
  id: string
  name: string
  parentId: string
  tabPosition?: 'top' | 'left' | 'right' | 'bottom'
}

export interface BrowserSettings {
  isOpenIn: boolean
  width: number
  height: number
}

export interface NavbarSettings {
  rounded: number
}

export interface Settings {
  browser: BrowserSettings
  search: string[]
  importSplit: string
  navbar: NavbarSettings
}

export interface AppState {
  version: 1
  theme: 'system' | 'light' | 'dark'
  currentView: string
  lastCategoryId: string
  settings: Settings
  categories: Category[]
  bookmarks: Bookmark[]
}

/** 尚未补齐 settings/默认值的中间态，迁移/校验链路内部使用。 */
export type RawState = Omit<Partial<AppState>, 'categories' | 'bookmarks'> & {
  categories: Record<string, unknown>[]
  bookmarks: Record<string, unknown>[]
}
