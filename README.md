# FunLink

一个无第三方运行依赖的 uTools 网址收藏插件，参考“网址精灵”的主要工作流重新实现。

## 功能

- 一级/二级分类与卡片拖拽排序
- 网址新增、编辑、搜索、常用、网页快开和指定浏览器打开
- 卡片笔记、收集箱、废纸篓恢复与永久删除
- uTools 搜索面板推送和粘贴网址快速添加
- JSON 数据备份/恢复、Chrome/Edge/Firefox HTML 书签导入
- 浅色、深色和跟随系统主题

## 使用

在 uTools 开发者工具中选择本目录的 `plugin.json` 运行即可。浏览器预览：

```bash
python3 -m http.server 9013 --bind 127.0.0.1
```

打开 <http://127.0.0.1:9013/>。浏览器预览使用 `localStorage`，uTools 中自动使用 `dbStorage`。

## 检查

```bash
npm test
```
