import test from 'node:test'
import assert from 'node:assert/strict'
import { bookmarkMatches, moveCategory, moveItem, normalizeUrl, validateState } from '../src/lib/core.mjs'

test('core bookmark operations stay predictable', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/')
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /仅支持/)
  assert.equal(bookmarkMatches({ title: 'Vue 文档', url: 'https://vuejs.org' }, 'vue'), true)
  assert.equal(bookmarkMatches({ title: 'Vue 文档', description: '渐进式框架' }, '渐进', ['title']), false)
  assert.equal(bookmarkMatches({ title: 'Vue 文档', description: '渐进式框架' }, '渐进', ['description']), true)
  assert.deepEqual(moveItem([{ id: 'a' }, { id: 'b' }], 'a', 'b').map(item => item.id), ['b', 'a'])
  assert.deepEqual(moveCategory([{ id: 'a', parentId: '' }, { id: 'b', parentId: '' }], 'b', 'a').map(item => [item.id, item.parentId]), [['b', 'a'], ['a', '']])
  assert.throws(() => validateState({ version: 1, categories: [], bookmarks: [{ url: 'javascript:x' }] }), /仅支持/)
})
