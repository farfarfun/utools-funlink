const fs = require('fs')
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
}
