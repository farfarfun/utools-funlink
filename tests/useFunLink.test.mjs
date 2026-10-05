import { test } from 'vitest'
import assert from 'node:assert/strict'
import { useFunLink } from '../src/composables/useFunLink.ts'
import { STORAGE_KEY } from '../src/lib/state.ts'

// 每次都给一份干净的空白备份当「已保存数据」，避免 useFunLink() 在没有存档时
// 回退去种示例数据（firstData.json），那样各用例之间的书签数量会互相干扰。
function emptyBackup() {
  return {
    version: 1,
    theme: 'system',
    currentView: 'inbox',
    lastCategoryId: '',
    settings: { browser: { isOpenIn: false, width: 1000, height: 680 }, search: ['title', 'description', 'url'], importSplit: '-,_,|,:,/,||', navbar: { rounded: 36 } },
    categories: [],
    bookmarks: [],
  }
}

// vitest 默认 node 环境没有 DOMParser（那是浏览器 API），parseBookmarkHtml 依赖它解析
// 浏览器书签 HTML。这里用一个只认识 <a href="...">text</a> 的最小实现代替，
// 够用来测试 processDataFile 的导入编排逻辑（去重、分类、标题拆分），
// 不重复验证真实 DOM 解析本身——那部分由运行时的浏览器/uTools 环境提供。
class FakeDomParser {
  parseFromString(html) {
    const anchors = [...html.matchAll(/<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(match => ({
      getAttribute: name => (name === 'href' ? match[1] : null),
      textContent: match[2],
    }))
    return { querySelectorAll: selector => (selector === 'a[href]' ? anchors : []) }
  }
}

function withEnv({ confirm = () => true, utools = {}, funlink, seeded = emptyBackup() } = {}, run) {
  const store = new Map(seeded ? [[STORAGE_KEY, seeded]] : [])
  globalThis.DOMParser = FakeDomParser
  globalThis.window = {
    confirm,
    open: () => {},
    utools: {
      dbStorage: {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, value),
      },
      ...utools,
    },
    funlink,
  }
  globalThis.document = { documentElement: { dataset: {} }, createElement: () => ({ click() {} }) }
  try {
    return run()
  } finally {
    delete globalThis.window
    delete globalThis.document
    delete globalThis.DOMParser
  }
}

test('processDataFile(restore) 恢复合法备份，并丢弃协议不安全的网址', () => {
  withEnv({}, () => {
    const api = useFunLink()
    const backup = {
      ...emptyBackup(),
      categories: [{ id: 'cat1', name: '工作', parentId: '' }],
      bookmarks: [
        { id: 'w1', title: '安全', url: 'https://example.com/', categoryId: 'cat1' },
        { id: 'w2', title: '危险', url: 'javascript:alert(1)', categoryId: 'cat1' },
      ],
    }
    const ok = api.processDataFile('restore', JSON.stringify(backup))
    assert.equal(ok, true)
    assert.deepEqual(api.state.value.bookmarks.map(bookmark => bookmark.id), ['w1'])
    assert.ok(api.toast.message.includes('跳过'), '应该提示用户有网址因为不安全被跳过')
  })
})

test('processDataFile(restore) 自动识别并转换「网址精灵」旧格式', () => {
  withEnv({}, () => {
    const api = useFunLink()
    const legacyDocs = [
      { _id: 'web_1', title: '旧书签', url: 'https://old.example.com', catIds: [] },
    ]
    const ok = api.processDataFile('restore', JSON.stringify(legacyDocs))
    assert.equal(ok, true)
    assert.equal(api.state.value.bookmarks.length, 1)
    assert.equal(api.state.value.bookmarks[0].title, '旧书签')
  })
})

test('processDataFile(restore) 遇到非法 JSON 时返回 false 并提示错误，不抛异常', () => {
  withEnv({}, () => {
    const api = useFunLink()
    const ok = api.processDataFile('restore', '{not json')
    assert.equal(ok, false)
    assert.equal(api.toast.error, true)
  })
})

test('processDataFile(import) 合并模式按网址去重，替换模式清空原有数据', () => {
  withEnv({}, () => {
    const api = useFunLink()
    api.saveBookmark({ title: '已存在', url: 'https://dup.example.com/' })
    const html = '<a href="https://dup.example.com">重复</a><a href="https://new.example.com">新增</a>'

    const merged = api.processDataFile('import', html, { mode: 'merge' })
    assert.equal(merged, true)
    const urls = api.state.value.bookmarks.map(bookmark => bookmark.url)
    assert.equal(urls.filter(url => url === 'https://dup.example.com/').length, 1, '已存在的网址不应该重复导入')
    assert.ok(urls.includes('https://new.example.com/'))

    const replaced = api.processDataFile('import', '<a href="https://only.example.com">唯一</a>', { mode: 'replace' })
    assert.equal(replaced, true)
    assert.deepEqual(api.state.value.bookmarks.map(bookmark => bookmark.url), ['https://only.example.com/'])
  })
})

test('exportBackup 用户取消确认框时不会真正导出', () => {
  let saved = false
  withEnv({ confirm: () => false, funlink: { saveBackup: () => { saved = true; return true } } }, () => {
    const api = useFunLink()
    api.exportBackup()
    assert.equal(saved, false)
  })
})

test('exportBackup 导出的内容是未加密的明文 JSON', () => {
  let savedContent = null
  withEnv({ confirm: () => true, funlink: { saveBackup: content => { savedContent = content; return true } } }, () => {
    const api = useFunLink()
    api.saveBookmark({ title: '测试', url: 'https://example.com/' })
    api.exportBackup()
    assert.ok(savedContent, 'saveBackup 应该被调用')
    const parsed = JSON.parse(savedContent)
    assert.equal(parsed.bookmarks[0].title, '测试')
    assert.equal(api.toast.message, '备份已导出')
  })
})

test('toggleQuick 会向 uTools 注册/移除快开入口', () => {
  const setCalls = []
  const removeCalls = []
  withEnv({ utools: { setFeature: feature => setCalls.push(feature), removeFeature: code => removeCalls.push(code) } }, () => {
    const api = useFunLink()
    api.saveBookmark({ id: 'w1', title: '快开', url: 'https://example.com/' })
    const bookmark = api.state.value.bookmarks[0]

    api.toggleQuick(bookmark)
    assert.equal(setCalls.length, 1)
    assert.equal(setCalls[0].code, 'open-link@w1')

    api.toggleQuick(bookmark)
    assert.ok(removeCalls.includes('open-link@w1'))
  })
})

test('openLink 对 {q} 占位符做 encodeURIComponent，正确处理中文和 & 符号', async () => {
  const opened = []
  await withEnv({ funlink: { openExternal: url => { opened.push(url); return true } } }, async () => {
    const api = useFunLink()
    api.saveBookmark({ id: 'w1', title: '搜索', url: 'https://example.com/search?q={q}' })
    const bookmark = api.state.value.bookmarks[0]
    await api.openLink(bookmark, '中文 & 符号')
    assert.equal(opened.length, 1)
    assert.ok(opened[0].includes(encodeURIComponent('中文 & 符号')), '关键词必须被正确编码')
    assert.ok(!opened[0].includes('{q}'), '占位符必须被替换掉')
  })
})

test('openLink 不会打开 javascript: 协议的网址（纵深防御）', async () => {
  const opened = []
  await withEnv({ funlink: { openExternal: url => opened.push(url) } }, async () => {
    const api = useFunLink()
    // 直接往 state 里塞一条协议不安全的脏数据，模拟绕过了 UI 层 normalizeUrl 校验的情况。
    api.state.value.bookmarks.push({
      id: 'w2', title: '恶意', url: 'javascript:alert(1)',
      categoryId: 'cat@default', categoryIds: ['cat@default'], deletedAt: null,
    })
    await api.openLink(api.state.value.bookmarks[0])
    assert.deepEqual(opened, [], 'javascript: 协议必须被拦截，不能触发打开')
  })
})

test('setupUtools 注册的主搜索结果会排除 {q} 模板书签并限制在 6 条以内', () => {
  let searchHandler = null
  withEnv({ utools: {
    setExpendHeight: () => {},
    onMainPush: (search) => { searchHandler = search },
  } }, () => {
    const api = useFunLink()
    for (let i = 0; i < 8; i += 1) {
      api.saveBookmark({ id: `w${i}`, title: `书签${i}`, url: `https://example.com/${i}` })
    }
    api.saveBookmark({ id: 'tpl', title: '搜索模板', url: 'https://example.com/search?q={q}' })
    api.setupUtools({ addBookmark: () => {} })

    assert.equal(typeof searchHandler, 'function', 'onMainPush 应该被注册')
    const results = searchHandler({ payload: '书签' })
    assert.ok(results.length <= 6, '主搜索结果必须限制在 6 条以内')
    assert.ok(!results.some(result => result.text === '搜索模板'), '带 {q} 占位符的书签不应该出现在主搜索结果里')
  })
})
