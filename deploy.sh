#!/bin/bash

# Claude History Viewer 简化部署脚本

set -e

echo "🚀 开始部署 Claude History Viewer..."

# 检查依赖
echo "📦 检查依赖..."
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
fi

# 安装项目依赖
echo "📦 安装项目依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 创建日志目录
echo "📝 创建日志目录..."
mkdir -p logs

# 停止现有服务
echo "🛑 停止现有服务..."
pm2 delete ecosystem.config.cjs 2>/dev/null || true

# 启动服务
echo "🚀 启动服务..."
pm2 start ecosystem.config.cjs

# 保存配置
echo "💾 保存PM2配置..."
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态:"
pm2 list
echo ""
echo "🌐 访问地址:"
echo "前端: http://localhost:3100"
echo "后端API: http://localhost:8800/api"
echo ""
echo "📋 管理命令:"
echo "pm2 list              # 查看服务状态"
echo "pm2 logs              # 查看日志"
echo "pm2 stop all          # 停止所有服务"
echo "pm2 restart all       # 重启所有服务"
echo ""
echo "🔧 设置开机自启:"
echo "pm2 startup"
echo "# 然后运行生成的命令"
