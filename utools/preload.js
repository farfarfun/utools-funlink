const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { spawn } = require('child_process')

const enterQueue = []
let enterHandler = null

utools.onPluginEnter(action => {
  if (enterHandler) enterHandler(action)
  else enterQueue.push(action)
})

function openWithBrowser(url, browser) {
  if (!browser) return utools.shellOpenExternal(url)

  const platform = process.platform
  const commands = {
    darwin: {
      chrome: ['open', ['-a', 'Google Chrome']],
      'chrome-incognito': ['open', ['-a', 'Google Chrome', '--args', '--incognito']],
      edge: ['open', ['-a', 'Microsoft Edge']],
      'edge-inprivate': ['open', ['-a', 'Microsoft Edge', '--args', '--inprivate']],
      firefox: ['open', ['-a', 'Firefox']],
      safari: ['open', ['-a', 'Safari']],
    },
    linux: {
      chrome: ['google-chrome', []],
      'chrome-incognito': ['google-chrome', ['--incognito']],
      edge: ['microsoft-edge', []],
      'edge-inprivate': ['microsoft-edge', ['--inprivate']],
      firefox: ['firefox', []],
    },
    win32: {
      chrome: ['chrome', []],
      'chrome-incognito': ['chrome', ['--incognito']],
      edge: ['msedge', []],
      'edge-inprivate': ['msedge', ['--inprivate']],
      firefox: ['firefox', []],
    },
  }
  const command = commands[platform]?.[browser]
  if (!command) return utools.shellOpenExternal(url)

  try {
    const child = spawn(command[0], [...command[1], url], { detached: true, stdio: 'ignore' })
    child.once('error', () => utools.shellOpenExternal(url))
    child.unref()
  } catch {
    utools.shellOpenExternal(url)
  }
}

function requestContext(method, target) {
  const safeTarget = new URL(target)
  safeTarget.username = ''
  safeTarget.password = ''
  safeTarget.search = ''
  safeTarget.hash = ''
  return `${method} ${safeTarget.href}`
}

function requestError(context, error) {
  return new Error(`${context}: ${error.message}`, { cause: error })
}

function request(url, { method = 'GET', headers = {}, body = '', timeout = 10000, redirects = 3, allowedOrigin } = {}) {
  return new Promise((resolve, reject) => {
    let target
    try {
      target = new URL(url)
    } catch (error) {
      return reject(requestError(`${method} 无效地址`, error))
    }
    if (allowedOrigin && target.origin !== allowedOrigin) return reject(new Error(`${method} WebDAV 地址必须与配置服务器同源`))
    const context = requestContext(method, target)
    const client = target.protocol === 'https:' ? https : http
    const req = client.request(target, { method, headers }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects) {
        response.resume()
        try {
          return resolve(request(new URL(response.headers.location, target).href, { method, headers, body, timeout, redirects: redirects - 1, allowedOrigin }))
        } catch (error) {
          return reject(requestError(context, error))
        }
      }
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8')
        if (response.statusCode >= 200 && response.statusCode < 300 || method === 'MKCOL' && response.statusCode === 405) {
          resolve({ status: response.statusCode, body: content })
        } else reject(new Error(`${context}: ${response.statusCode} ${response.statusMessage || '请求失败'}`))
      })
    })
    req.setTimeout(timeout, () => req.destroy(new Error(`${timeout / 1000}秒超时`)))
    req.on('error', error => reject(requestError(context, error)))
    if (body) req.write(body)
    req.end()
  })
}

// 备份目录。历史版本沿用了原插件的中文目录名，现改为 FunLink；
// 旧备份仍留在服务器上原目录，需要时手动搬运。
const WEBDAV_DIRECTORY = 'FunLink'

function webdavTarget(config, file = '') {
  const base = new URL(config.host.endsWith('/') ? config.host : `${config.host}/`)
  return new URL(`${WEBDAV_DIRECTORY}/${file}`, base).href
}

function webdavUrl(config, target) {
  const base = new URL(config.host)
  const url = new URL(target, base)
  if (!['http:', 'https:'].includes(base.protocol) || url.origin !== base.origin) throw new Error('WebDAV 地址必须与配置服务器同源')
  return url.href
}

function webdavRequest(config, target, options = {}) {
  const base = new URL(config.host)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('WebDAV 仅支持 HTTP 和 HTTPS 服务器')
  return request(webdavUrl(config, target), { ...options, allowedOrigin: base.origin })
}

function webdavHeaders(config, extra = {}) {
  return { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`, ...extra }
}

window.funlink = {
  onEnter(callback) {
    enterHandler = callback
    while (enterQueue.length) callback(enterQueue.shift())
  },
  openExternal: openWithBrowser,
  saveBackup(content) {
    const destination = utools.showSaveDialog({
      title: '导出 FunLink 备份',
      defaultPath: `funlink-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!destination) return false
    fs.writeFileSync(destination, content, 'utf8')
    return true
  },
  chooseTextFile(extensions) {
    const result = utools.showOpenDialog({ properties: ['openFile'], filters: [{ name: '数据文件', extensions }] })
    if (!result?.[0]) return null
    return fs.readFileSync(path.resolve(result[0]), 'utf8')
  },
  async webdavBackup(config, content) {
    await webdavRequest(config, webdavTarget(config), { method: 'MKCOL', headers: webdavHeaders(config) })
    const now = new Date()
    const stamp = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()].join('-')
    await webdavRequest(config, webdavTarget(config, `${stamp}.json`), {
      method: 'PUT',
      headers: webdavHeaders(config, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(content) }),
      body: content,
    })
  },
  async webdavList(config) {
    const xml = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>'
    return (await webdavRequest(config, webdavTarget(config), {
      method: 'PROPFIND',
      headers: webdavHeaders(config, { Depth: '1', 'Content-Type': 'application/xml', 'Content-Length': Buffer.byteLength(xml) }),
      body: xml,
    })).body
  },
  async webdavRestore(config, href) {
    return (await webdavRequest(config, href, { headers: webdavHeaders(config) })).body
  },
  async webdavDelete(config, href) {
    await webdavRequest(config, href, { method: 'DELETE', headers: webdavHeaders(config) })
  },
  async checkUrl(url) {
    const result = await request(url, { method: 'HEAD' })
    return result.status
  },
}
