# FunLink

FunLink 是一个面向 uTools 的网址收藏与快速访问插件。它把零散书签整理成清晰的网址导航，并将收藏、搜索和打开网页串联到 uTools 主搜索框中，适合管理工作入口、开发文档、设计素材和常用在线工具。

插件无需账号或独立服务端，数据保存在 uTools `dbStorage` 中。项目使用 Vue 3、Composition API 和 Vite 构建，并通过独立组件与 composable 组织界面和业务状态。

## 主要功能

### 网址管理

- 新增、编辑和删除网址卡片
- 一级分类、二级分类及卡片拖拽排序
- 常用网址、收集箱和废纸篓
- 删除后可恢复，清空废纸篓时才会永久删除
- 为网址记录独立笔记
- 为卡片设置文字图标、图片图标和指定浏览器

### uTools 联动

- 输入 `FunLink`、`网址收藏`、`网址导航` 或 `web` 打开插件
- 在 uTools 主搜索框粘贴网址，直接进入添加流程
- 从 uTools 搜索面板检索收藏的网址，无需先进入插件
- 将卡片设为“网页快开”后，可通过网址名称直接打开
- 网址中使用 `{q}` 作为占位符，可创建站内搜索入口

例如：

```text
https://www.bing.com/search?q={q}
```

### 数据与外观

- 导出和恢复 FunLink JSON 备份
- 导入 Chrome、Edge、Firefox 导出的 HTML 书签
- 支持浅色、深色和跟随系统主题
- 适配 uTools 常用窗口尺寸及窄窗口布局

## 使用方式

1. 运行 `npm install && npm run build`。
2. 打开 uTools 的“开发者工具”插件。
3. 选择“新建项目”，载入本目录的 `plugin.json`。
4. 运行项目后，通过 uTools 搜索 `FunLink` 进入插件。

插件内可直接点击卡片打开网址，右键卡片可编辑、记录笔记、设置网页快开、加入常用或移到废纸篓。按 `/` 可快速聚焦搜索框。

## 开发

```bash
npm install
npm run dev
```

访问终端输出的本地地址。浏览器预览使用 `localStorage`，在 uTools 中运行时自动切换为 `dbStorage`。

主要目录：

- `src/components/`：导航、网址卡片和各类对话框
- `src/composables/useFunLink.js`：收藏状态、数据操作和 uTools 生命周期
- `src/lib/core.mjs`：可独立测试的 URL、搜索、排序和备份校验逻辑
- `preload.js`：文件读写及指定浏览器打开能力

生产构建输出到 `dist/`：

```bash
npm run build
```

## 测试

```bash
npm test
npm run build
```

## 致谢

FunLink 的产品思路和主要交互参考了 uTools 插件 [网址精灵](https://www.u-tools.cn/plugins/detail/%E7%BD%91%E5%9D%80%E7%B2%BE%E7%81%B5/)（作者：呀唔咪）。感谢原作者对网址收藏、分类导航和网页快开工作流的探索与分享。

本项目为独立复刻实现，不隶属于原插件或原作者。
