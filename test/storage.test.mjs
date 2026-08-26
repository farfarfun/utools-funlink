import test from 'node:test'
import assert from 'node:assert/strict'
import { readStorage, writeStorage } from '../src/lib/storage.js'

function fakeLocalStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    has: key => map.has(key),
  }
}

function fakeDb(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    has: key => map.has(key),
    get: key => map.get(key),
  }
}

function withEnv({ db = null, local = fakeLocalStorage() }, run) {
  globalThis.window = db ? { utools: { dbStorage: db } } : {}
  globalThis.localStorage = local
  try {
    return run()
  } finally {
    delete globalThis.window
    delete globalThis.localStorage
  }
}

test('browser preview falls back to localStorage', () => {
  const local = fakeLocalStorage()
  withEnv({ local }, () => {
    writeStorage('funlink-demo', { a: 1 })
    assert.deepEqual(readStorage('funlink-demo'), { a: 1 })
    assert.equal(readStorage('missing', 'fallback'), 'fallback')
  })
})

test('uTools reads and writes dbStorage', () => {
  const db = fakeDb()
  withEnv({ db }, () => {
    writeStorage('funlink-demo', { a: 1 })
    assert.deepEqual(db.get('funlink-demo'), { a: 1 })
    assert.deepEqual(readStorage('funlink-demo'), { a: 1 })
  })
})

test('legacy localStorage values move into dbStorage once', () => {
  const db = fakeDb()
  const local = fakeLocalStorage({ 'funlink-webdav': JSON.stringify({ host: 'https://dav.example' }) })
  withEnv({ db, local }, () => {
    assert.deepEqual(readStorage('funlink-webdav', {}), { host: 'https://dav.example' })
    // 搬完之后 dbStorage 里有了，localStorage 里清掉，避免两处数据不一致。
    assert.deepEqual(db.get('funlink-webdav'), { host: 'https://dav.example' })
    assert.equal(local.has('funlink-webdav'), false)
    assert.deepEqual(readStorage('funlink-webdav', {}), { host: 'https://dav.example' })
  })
})

test('corrupt localStorage json returns the fallback instead of throwing', () => {
  withEnv({ local: fakeLocalStorage({ broken: '{not json' }) }, () => {
    assert.deepEqual(readStorage('broken', { safe: true }), { safe: true })
  })
})

test('writeStorage strips reactive proxies before persisting', () => {
  const db = fakeDb()
  withEnv({ db }, () => {
    const source = { nested: { list: [1, 2] } }
    const proxy = new Proxy(source, {})
    writeStorage('funlink-demo', proxy)
    const stored = db.get('funlink-demo')
    stored.nested.list.push(3)
    assert.deepEqual(source.nested.list, [1, 2], '写入的必须是快照，不能和原对象共享引用')
  })
})
