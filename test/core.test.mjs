import test from 'node:test'
import assert from 'node:assert/strict'
import { bookmarkMatches, moveItem, normalizeUrl, validateState } from '../core.mjs'

test('core bookmark operations stay predictable', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/')
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /仅支持/)
  assert.equal(bookmarkMatches({ title: 'Vue 文档', url: 'https://vuejs.org' }, 'vue'), true)
  assert.deepEqual(moveItem([{ id: 'a' }, { id: 'b' }], 'a', 'b').map(item => item.id), ['b', 'a'])
  assert.throws(() => validateState({ version: 1, categories: [], bookmarks: [{ url: 'javascript:x' }] }), /仅支持/)
})
