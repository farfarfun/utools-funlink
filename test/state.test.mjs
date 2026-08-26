import test from 'node:test'
import assert from 'node:assert/strict'
import { STORAGE_KEY, loadState, prepareState } from '../src/lib/state.mjs'

// 重构前（commit 6b8331a）真实的存档形状：同样的 key、同样的 version 1，
// 但卡片只有 categoryId，废纸篓项只有 previousCategoryId。
const LEGACY_STATE = {
  version: 1,
  theme: 'dark',
  currentView: 'category:cat_demo',
  categories: [{ id: 'cat_demo', name: '演示', parentId: '' }],
  bookmarks: [
    { id: 'w1', title: '我的书签', url: 'https://example.com/', categoryId: 'cat_demo', deletedAt: null },
    { id: 'w2', title: '已删除', url: 'https://deleted.example/', categoryId: '', previousCategoryId: 'cat_demo', deletedAt: 1 },
  ],
}

const seed = () => ({ version: 1, categories: [], bookmarks: [], seeded: true })

test('legacy save files load instead of being replaced by demo data', () => {
  const result = loadState({ read: () => structuredClone(LEGACY_STATE), seed })

  assert.equal(result.blocked, '', '旧存档必须能正常读取，不能进入只读模式')
  assert.equal(result.state.seeded, undefined, '绝不能回退到示例数据')
  assert.deepEqual(result.state.bookmarks.map(bookmark => bookmark.title), ['我的书签', '已删除'])
  assert.deepEqual(result.state.bookmarks[0].categoryIds, ['cat_demo'])
  assert.deepEqual(result.state.bookmarks[1].previousCategoryIds, ['cat_demo'])
  assert.equal(result.state.theme, 'dark', '用户的主题选择要保留')
  // 旧版没有 settings，需要补上默认值。
  assert.equal(result.state.settings.browser.width, 1000)
  assert.deepEqual(result.state.settings.search, ['title', 'description', 'url'])
})

test('first run with empty storage seeds the demo data', () => {
  const result = loadState({ read: () => null, seed })
  assert.equal(result.state.seeded, true)
  assert.equal(result.blocked, '')
})

test('unreadable data blocks writes rather than overwriting', () => {
  const broken = loadState({ read: () => ({ version: 99, categories: [], bookmarks: [] }), seed })
  assert.match(broken.blocked, /无法解析/)
  assert.equal(broken.state.seeded, undefined, '损坏时也不能拿示例数据顶替')
  assert.deepEqual(broken.state.bookmarks, [])

  const throwing = loadState({ read: () => { throw new Error('dbStorage 挂了') }, seed })
  assert.match(throwing.blocked, /读取失败/)
  assert.equal(throwing.state.seeded, undefined)
})

test('storage key stays the one earlier versions wrote to', () => {
  assert.equal(STORAGE_KEY, 'funlink-state-v1')
})

test('prepareState reports skipped unsafe cards', () => {
  const { state, dropped } = prepareState({
    version: 1,
    categories: [],
    bookmarks: [
      { id: 'w1', title: '好的', url: 'https://example.com/' },
      { id: 'w2', title: '危险', url: 'javascript:alert(1)' },
    ],
  })
  assert.equal(dropped, 1)
  assert.deepEqual(state.bookmarks.map(bookmark => bookmark.id), ['w1'])
  assert.deepEqual(state.bookmarks[0].categoryIds, ['cat@default'])
})
