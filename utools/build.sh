#!/usr/bin/env bash
set -euo pipefail

# 本脚本位于插件根目录 utools/，源码与 npm 工程在上一级。
plugin_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(dirname "$plugin_dir")"

cd "$project_dir"
npm ci
npm run build

echo
echo "构建完成。"
echo "在 uTools「开发者工具」中导入：${plugin_dir}/plugin.json"
echo "打包时选择目录：${plugin_dir}（不含 .git，可直接打包）"
