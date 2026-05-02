# Claude History Viewer 部署指南（简化版）

## 架构
- **前端**: Next.js 应用，端口 3100
- **后端**: API 服务，端口 8800
- **进程管理**: PM2

## 快速部署

### 1. 一键部署
```bash
chmod +x deploy.sh
./deploy.sh
```

### 2. 手动部署
```bash
# 1. 安装PM2（如果未安装）
npm install -g pm2

# 2. 安装项目依赖
npm install

# 3. 构建项目
npm run build

# 4. 创建日志目录
mkdir -p logs

# 5. 启动服务
pm2 start ecosystem.config.cjs

# 6. 保存配置
pm2 save
```

## 服务管理

### 查看状态
```bash
pm2 list
```

### 查看日志
```bash
# 查看所有日志
pm2 logs

# 查看特定服务日志
pm2 logs claude-history-viewer-frontend
pm2 logs claude-history-viewer-backend
```

### 重启服务
```bash
pm2 restart all
```

### 停止服务
```bash
pm2 stop all
```

### 删除服务
```bash
pm2 delete all
```

## 设置开机自启

### macOS/Linux
```bash
pm2 startup
# 运行生成的命令
```

### 手动设置（macOS）
```bash
# 复制plist文件到系统目录
sudo cp com.ethan.claude-history-viewer.plist /Library/LaunchDaemons/

# 修改权限
sudo chown root:wheel /Library/LaunchDaemons/com.ethan.claude-history-viewer.plist

# 加载服务
sudo launchctl load /Library/LaunchDaemons/com.ethan.claude-history-viewer.plist

# 启动服务
sudo launchctl start com.ethan.claude-history-viewer
```

## 访问地址
- **前端界面**: http://localhost:3100
- **后端API**: http://localhost:8800/api
  - 统计接口: http://localhost:8800/api/stats
  - 会话接口: http://localhost:8800/api/sessions
  - 项目接口: http://localhost:8800/api/projects

## 端口配置

如果需要修改端口，编辑 `ecosystem.config.cjs`：

```javascript
// 前端端口
env: {
  NODE_ENV: 'production',
  PORT: 3100,  // 修改这里
}

// 后端端口
env: {
  NODE_ENV: 'production',
  PORT: 8800,  // 修改这里
}
```

然后重启服务：
```bash
pm2 restart all
```

## 故障排除

### 端口被占用
```bash
# 查看占用端口的进程
lsof -i :3100
lsof -i :8800

# 杀死进程
kill -9 <PID>
```

### 服务无法启动
```bash
# 查看详细日志
pm2 logs --lines 100

# 检查端口是否监听
netstat -an | grep 3100
netstat -an | grep 8800
```

### 内存问题
```bash
# 查看内存使用
pm2 monit

# 重启释放内存
pm2 restart all
```

## 更新部署

### 更新代码后
```bash
# 1. 拉取最新代码
git pull

# 2. 重新安装依赖（如果需要）
npm install

# 3. 重新构建
npm run build

# 4. 重启服务
pm2 restart all
```

### 更新PM2配置后
```bash
# 1. 停止服务
pm2 delete ecosystem.config.cjs

# 2. 重新启动
pm2 start ecosystem.config.cjs

# 3. 保存配置
pm2 save
```

## 备份与恢复

### 备份配置
```bash
# 备份重要文件
tar -czf backup-$(date +%Y%m%d).tar.gz \
  ecosystem.config.cjs \
  server.js \
  deploy.sh \
  .env.production
```

### 恢复部署
```bash
# 1. 解压备份
tar -xzf backup-20240327.tar.gz

# 2. 重新部署
./deploy.sh
```

---

**最后更新**: 2026-03-27
**版本**: 1.0.0