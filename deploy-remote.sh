#!/bin/bash

# CodeMemory 远程部署脚本
# 用法: ./deploy-remote.sh
# 从本地同步代码到服务器，执行迁移、构建、重启

set -e

REMOTE_HOST="wzd01"
REMOTE_APP_DIR="/home/ubuntu/apps/codememory"
REMOTE_DB_URL="postgresql://postgres@127.0.0.1:5432/claude_history"

echo "==> 同步代码到 ${REMOTE_HOST}:${REMOTE_APP_DIR}"
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.cache' \
  --exclude '.claude' \
  --exclude 'logs' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'tsconfig.tsbuildinfo' \
  ./ "${REMOTE_HOST}:${REMOTE_APP_DIR}/"

echo ""
echo "==> 更新数据库 Schema"
ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && DATABASE_URL='${REMOTE_DB_URL}' npx drizzle-kit push"

echo ""
echo "==> 安装依赖 & 构建"
ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && npm install && npm run build"

echo ""
echo "==> 重启服务"
ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && pm2 restart codememory && sleep 2 && pm2 status"

echo ""
echo "==> 部署完成"
