<script setup>
import { computed, reactive, ref } from 'vue'
import emptyImage from '../assets/empty.svg'
import emptyDarkImage from '../assets/empty-dark.svg'

const props = defineProps({
  settings: { type: Object, required: true },
  bookmarks: { type: Array, default: () => [] },
  backupData: { type: Object, default: null },
})
const emit = defineEmits(['save-settings', 'clear-cookies', 'export', 'data-file', 'reset', 'message'])
const dialog = ref(null)
const webdavDialog = ref(null)
const invalidDialog = ref(null)
const webdavListDialog = ref(null)
const restoreInput = ref(null)
const importInput = ref(null)
const activeTab = ref('basic')
const importMode = ref('append')
const tabPosition = ref('left')
const snapshot = ref('')
const webdav = reactive({ host: '', username: '', password: '' })
const webdavLoading = ref(false)
const webdavFiles = ref([])
const invalidTab = ref('results')
const scanning = ref(false)
const scanned = ref(0)
const invalidResults = ref([])
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback }
}
const ignoredLinks = ref(readJson('funlink-ignore-list', []))
const checkCandidates = computed(() => props.bookmarks.filter(bookmark => !bookmark.deletedAt && !bookmark.url.includes('{q}') && !ignoredLinks.value.some(item => item.url === bookmark.url)))

function open() {
  activeTab.value = 'basic'
  snapshot.value = JSON.stringify(props.settings)
  if (!dialog.value.open) dialog.value.showModal()
}

function close() {
  if (snapshot.value !== JSON.stringify(props.settings)) emit('save-settings')
  dialog.value?.close()
}

function closeOnBackdrop(event) {
  if (event.target === dialog.value) close()
}

function choose(type, mode = 'append') {
  importMode.value = mode
  const extensions = type === 'restore' ? ['json'] : ['html', 'htm']
  const content = window.funlink?.chooseTextFile?.(extensions)
  if (typeof content === 'string') emit('data-file', type, content, { mode, tabPosition: tabPosition.value })
  else (type === 'restore' ? restoreInput : importInput).value?.click()
}

async function readFile(type, event) {
  const file = event.target.files[0]
  if (file) emit('data-file', type, await file.text(), { mode: importMode.value, tabPosition: tabPosition.value })
  event.target.value = ''
}

function changeNumber(key, amount, minimum) {
  props.settings.browser[key] = Math.max(minimum, Number(props.settings.browser[key]) + amount)
}

function toggleSearch(field) {
  const search = props.settings.search
  const index = search.indexOf(field)
  if (index >= 0) search.splice(index, 1)
  else search.push(field)
}

function openWebdav() {
  Object.assign(webdav, readJson('funlink-webdav', { host: '', username: '', password: '' }))
  webdavDialog.value.showModal()
}

function saveWebdav() {
  localStorage.setItem('funlink-webdav', JSON.stringify(webdav))
  webdavDialog.value.close()
  emit('message', '设置已保存！')
}

async function webdavAction(action) {
  if (!webdav.host || !webdav.username || !webdav.password) return emit('message', '请先配置WebDav！', true)
  if (!window.funlink?.webdavBackup) return emit('message', '当前环境不支持 WebDav', true)
  webdavLoading.value = true
  try {
    if (action === 'backup') {
      await window.funlink.webdavBackup(JSON.parse(JSON.stringify(webdav)), JSON.stringify(props.backupData, null, 2))
      emit('message', '备份到WebDav成功！')
    } else {
      const xml = await window.funlink.webdavList(JSON.parse(JSON.stringify(webdav)))
      const document = new DOMParser().parseFromString(xml, 'application/xml')
      webdavFiles.value = [...document.getElementsByTagNameNS('*', 'response')].flatMap(response => {
        const value = name => response.getElementsByTagNameNS('*', name)[0]?.textContent || ''
        const href = value('href')
        if (!decodeURIComponent(href).endsWith('.json')) return []
        return [{ href, name: value('displayname') || decodeURIComponent(href.split('/').pop()), size: Number(value('getcontentlength') || 0), modified: value('getlastmodified') }]
      }).sort((a, b) => new Date(b.modified) - new Date(a.modified))
      webdavListDialog.value.showModal()
    }
  } catch (error) {
    emit('message', `WebDav操作失败：${error.message}`, true)
  } finally {
    webdavLoading.value = false
  }
}

async function restoreWebdav(file) {
  try {
    emit('data-file', 'restore', await window.funlink.webdavRestore(JSON.parse(JSON.stringify(webdav)), file.href))
    webdavListDialog.value.close()
  } catch (error) {
    emit('message', `还原失败：${error.message}`, true)
  }
}

async function deleteWebdav(file) {
  try {
    await window.funlink.webdavDelete(JSON.parse(JSON.stringify(webdav)), file.href)
    webdavFiles.value = webdavFiles.value.filter(item => item.href !== file.href)
    emit('message', '删除成功！')
  } catch (error) {
    emit('message', `删除失败：${error.message}`, true)
  }
}

async function scanInvalidLinks() {
  if (scanning.value) return
  scanning.value = true
  scanned.value = 0
  invalidResults.value = []
  const queue = checkCandidates.value.slice()
  const worker = async () => {
    while (queue.length) {
      const bookmark = queue.shift()
      try {
        const status = await window.funlink.checkUrl(bookmark.url)
        if (status >= 400) invalidResults.value.push({ ...bookmark, message: `${status}错误` })
      } catch (error) {
        invalidResults.value.push({ ...bookmark, message: error.message })
      } finally {
        scanned.value++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker))
  scanning.value = false
}

function ignoreLink(bookmark) {
  invalidResults.value = invalidResults.value.filter(item => item.id !== bookmark.id)
  ignoredLinks.value.unshift({ title: bookmark.title, url: bookmark.url })
  localStorage.setItem('funlink-ignore-list', JSON.stringify(ignoredLinks.value))
}

function unignoreLink(index) {
  ignoredLinks.value.splice(index, 1)
  localStorage.setItem('funlink-ignore-list', JSON.stringify(ignoredLinks.value))
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="settings-drawer" aria-labelledby="settings-title" @click="closeOnBackdrop" @cancel.prevent="close">
    <header class="settings-header">
      <h2 id="settings-title">设置</h2>
      <button type="button" class="settings-close" aria-label="关闭" @click="close">×</button>
    </header>
    <div class="settings-body">
      <div class="settings-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="activeTab === 'basic'" :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'">基础设置</button>
        <button type="button" role="tab" :aria-selected="activeTab === 'data'" :class="{ active: activeTab === 'data' }" @click="activeTab = 'data'">数据管理</button>
      </div>

      <div v-if="activeTab === 'basic'" class="settings-pane basic-settings" role="tabpanel">
        <section class="setting-field">
          <h3>默认打开方式</h3>
          <label class="switch-line">
            <input v-model="settings.browser.isOpenIn" type="checkbox" />
            <span class="switch-control" aria-hidden="true" />
            <span>{{ settings.browser.isOpenIn ? '内置浏览器' : '系统浏览器' }}</span>
          </label>
        </section>

        <section class="setting-field browser-setting">
          <h3>浏览器设置 <small>(仅内置浏览器有效)</small></h3>
          <div class="browser-size-row">
            <span>宽</span>
            <div class="number-stepper">
              <button type="button" aria-label="减小浏览器宽度" @click="changeNumber('width', -10, 300)">−</button>
              <input v-model.number="settings.browser.width" type="number" min="300" step="10" aria-label="浏览器宽度" />
              <button type="button" aria-label="增大浏览器宽度" @click="changeNumber('width', 10, 300)">＋</button>
            </div>
            <span>高</span>
            <div class="number-stepper">
              <button type="button" aria-label="减小浏览器高度" @click="changeNumber('height', -10, 200)">−</button>
              <input v-model.number="settings.browser.height" type="number" min="200" step="10" aria-label="浏览器高度" />
              <button type="button" aria-label="增大浏览器高度" @click="changeNumber('height', 10, 200)">＋</button>
            </div>
          </div>
          <button type="button" class="outline-pill" @click="emit('clear-cookies')">清空内置浏览器 Cookies</button>
        </section>

        <div class="settings-divider" />
        <section class="setting-field search-setting">
          <h3>卡片搜索</h3>
          <div class="checkbox-row">
            <label class="check disabled"><input type="checkbox" checked disabled /><span />匹配名称</label>
            <label class="check"><input type="checkbox" :checked="settings.search.includes('description')" @change="toggleSearch('description')" /><span />匹配简介</label>
            <label class="check"><input type="checkbox" :checked="settings.search.includes('url')" @change="toggleSearch('url')" /><span />匹配域名</label>
          </div>
        </section>
        <div class="settings-divider" />
        <section class="setting-field rounded-setting">
          <h3>导航圆角 <small>(深色模式有效)</small></h3>
          <input v-model.number="settings.navbar.rounded" class="range" type="range" min="0" max="50" aria-label="导航圆角" :style="{ '--range': settings.navbar.rounded }" />
        </section>
      </div>

      <div v-else class="settings-pane data-settings" role="tabpanel">
        <section class="data-field">
          <div class="data-label"><span>WebDav备份还原</span><button type="button" class="text-button" @click="openWebdav">配置WebDav</button></div>
          <div class="button-pair"><button type="button" class="data-button warning" :disabled="webdavLoading" @click="webdavAction('backup')">{{ webdavLoading ? '正在处理...' : '备份到WebDav' }}</button><button type="button" class="data-button success" :disabled="webdavLoading" @click="webdavAction('restore')">从WebDav还原</button></div>
        </section>
        <section class="data-field">
          <h3>本地备份还原</h3>
          <div class="button-pair"><button type="button" class="data-button warning" @click="emit('export')">备份到电脑</button><button type="button" class="data-button success" @click="choose('restore')">从电脑还原</button></div>
        </section>
        <section class="data-field bookmark-import">
          <h3>书签导入</h3>
          <div class="bookmark-import-select">
            <select v-model="tabPosition" aria-label="分类Tabs位置">
              <option value="left">分类Tabs位置：左</option><option value="top">分类Tabs位置：上</option>
              <option value="right">分类Tabs位置：右</option><option value="bottom">分类Tabs位置：下</option>
            </select>
            <span aria-hidden="true">⌄</span>
          </div>
          <label class="input-group"><span>名称简介分割符</span><input v-model="settings.importSplit" placeholder="按此符号进行分割" /></label>
          <p class="import-help">将按这些符号自动分割名称与简介。多个请用英文逗号分隔</p>
          <div class="button-pair"><button type="button" class="data-button primary" @click="choose('import', 'append')">追加导入</button><button type="button" class="data-button primary" @click="choose('import', 'replace')">替换导入</button></div>
          <div class="import-notes">
            1、支持chrome、edge浏览器导出的html格式数据 2、导入之前请先<span>备份</span>数据，以防数据丢失！！！ 3、导入成功后需<span>“完全退出插件”</span>再打开才能生效
          </div>
        </section>
        <section class="data-field">
          <h3>链接检查</h3>
          <button type="button" class="data-button danger" @click="invalidDialog.showModal()">检查无效链接</button>
        </section>
      </div>
    </div>
    <input ref="restoreInput" type="file" accept="application/json,.json" hidden @change="readFile('restore', $event)" />
    <input ref="importInput" type="file" accept="text/html,.html,.htm" hidden @change="readFile('import', $event)" />
  </dialog>

  <dialog ref="webdavDialog" class="sub-modal webdav-modal">
    <form method="dialog" @submit.prevent="saveWebdav">
      <header><h2>WebDav配置</h2><button type="button" aria-label="关闭" @click="webdavDialog.close()">×</button></header>
      <label><span>服务器</span><input v-model="webdav.host" placeholder="请输入webdav服务器地址" required /></label>
      <label><span>用户名</span><input v-model="webdav.username" placeholder="请输入webdav用户名" required /></label>
      <label><span>密 码</span><input v-model="webdav.password" type="password" placeholder="请输入webdav访问密码" required /></label>
      <footer><button type="button" class="button" @click="webdavDialog.close()">取消</button><button type="submit" class="button primary">保存</button></footer>
    </form>
  </dialog>

  <dialog ref="webdavListDialog" class="sub-modal webdav-list-modal">
    <header><h2>已备份文件</h2><button type="button" aria-label="关闭" @click="webdavListDialog.close()">×</button></header>
    <div v-if="webdavFiles.length" class="webdav-file-list">
      <div v-for="file in webdavFiles" :key="file.href"><span>{{ file.name }}</span><small>{{ (file.size / 1024).toFixed(2) }}kb</small><button type="button" @click="restoreWebdav(file)">还原</button><button type="button" class="danger-text" @click="deleteWebdav(file)">删除</button></div>
    </div>
    <div v-else class="webdav-empty">暂无数据</div>
  </dialog>

  <dialog ref="invalidDialog" class="invalid-links-modal">
    <header><button type="button" class="data-button primary" :disabled="scanning" @click="scanInvalidLinks"><i v-if="!scanning" class="iconfont icon-search" aria-hidden="true" /> {{ scanning ? '正在扫描...' : scanned ? '重新检查' : '开始检查' }}</button><button type="button" aria-label="关闭" @click="invalidDialog.close()">×</button></header>
    <div class="invalid-tabs"><button :class="{ active: invalidTab === 'results' }" type="button" @click="invalidTab = 'results'">扫描结果</button><button :class="{ active: invalidTab === 'ignored' }" type="button" @click="invalidTab = 'ignored'">忽略名单</button></div>
    <template v-if="invalidTab === 'results'">
      <div class="invalid-summary">共需检查 <b>{{ checkCandidates.length }}</b> 条链接，<template v-if="scanning">正在检查第 <b>{{ scanned }}</b> 个，已查到 <b>{{ invalidResults.length }}</b> 条无效链接，请稍后...</template><template v-else>点击按钮后开始检查无效链接。</template></div>
      <div v-if="invalidResults.length" class="invalid-result-list"><div v-for="item in invalidResults" :key="item.id"><span>{{ item.title }}</span><a :href="item.url">{{ item.url }}</a><em>{{ item.message }}</em><button type="button" @click="ignoreLink(item)">忽略</button></div></div>
      <div v-else class="invalid-empty"><img class="empty-image-light" :src="emptyImage" alt="" /><img class="empty-image-dark" :src="emptyDarkImage" alt="" /><span>提示：由于个别站点原因，扫描结果可能有小误差！</span></div>
    </template>
    <template v-else>
      <div class="invalid-summary">已忽略 <b>{{ ignoredLinks.length }}</b> 条链接 <span>如果个别网址检查不准确，请加入忽略检查白名单</span></div>
      <div v-if="ignoredLinks.length" class="invalid-result-list"><div v-for="(item, index) in ignoredLinks" :key="item.url"><span>{{ item.title }}</span><a :href="item.url">{{ item.url }}</a><button type="button" @click="unignoreLink(index)">取消</button></div></div>
      <div v-else class="invalid-empty"><img class="empty-image-light" :src="emptyImage" alt="" /><img class="empty-image-dark" :src="emptyDarkImage" alt="" /><span>暂无数据</span></div>
    </template>
  </dialog>
</template>
