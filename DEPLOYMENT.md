# Claude History Viewer 部署指南

## 架构概述

本项目采用前后端分离架构：
- **前端**: Next.js 应用，运行在端口 3100
- **后端**: Node.js API 服务，运行在端口 8800
- **进程管理**: PM2
- **监控**: 自定义监控脚本 + PM2 内置监控

## 目录结构

```
claude-history-viewer/
├── app/                    # Next.js 应用代码
├── lib/                    # 工具函数和缓存管理
├── logs/                   # 日志目录（自动创建）
│   ├── frontend-out.log
│   ├── frontend-error.log
│   ├── backend-out.log
│   ├── backend-error.log
│   └── monitor.log
├── .cache/                 # 缓存目录
├── .env.production         # 生产环境配置
├── ecosystem.config.cjs    # PM2 配置文件
├── server.js               # 后端服务器
├── start.sh               # 启动脚本
├── monitor.sh             # 监控脚本
└── com.ethan.claude-history-viewer.plist  # macOS 启动项
```

## 快速开始

### 1. 安装依赖

```bash
# 安装全局依赖
npm install -g pm2

# 安装项目依赖
./start.sh install
```

### 2. 启动服务

```bash
# 完整安装并启动
./start.sh

# 或分步执行
./start.sh install
./start.sh start
```

### 3. 验证服务

```bash
# 检查服务状态
./start.sh status

# 应该看到：
# 前端 (端口 3100): ✓ 正在运行
# 后端 (端口 8800): ✓ 正在运行
```

### 4. 访问应用

- 前端界面: http://localhost:3100
- 后端API: http://localhost:8800/api
  - 统计接口: http://localhost:8800/api/stats
  - 会话接口: http://localhost:8800/api/sessions

## 管理命令

### 使用启动脚本

```bash
# 安装依赖并构建
./start.sh install

# 启动服务
./start.sh start

# 停止服务
./start.sh stop

# 重启服务
./start.sh restart

# 查看状态
./start.sh status

# 查看日志
./start.sh logs
```

### 使用PM2直接管理

```bash
# 查看所有进程
pm2 list

# 查看日志
pm2 logs

# 监控进程
pm2 monit

# 保存当前配置
pm2 save

# 生成开机启动脚本
pm2 startup
```

## 监控系统

### 单次检查

```bash
./monitor.sh
```

### 持续监控（5分钟间隔）

```bash
./monitor.sh continuous
```

### 自定义监控间隔（1分钟）

```bash
./monitor.sh continuous --interval 60
```

监控脚本会检查：
1. 端口监听状态（3100, 8800）
2. PM2进程状态
3. API端点响应
4. 磁盘空间使用率
5. 内存使用情况
6. 自动重启失败的服务

## 系统服务配置

### macOS (LaunchDaemon)

```bash
# 1. 复制plist文件到系统目录
sudo cp com.ethan.claude-history-viewer.plist /Library/LaunchDaemons/

# 2. 修改文件权限
sudo chown root:wheel /Library/LaunchDaemons/com.ethan.claude-history-viewer.plist

# 3. 加载服务
sudo launchctl load /Library/LaunchDaemons/com.ethan.claude-history-viewer.plist

# 4. 启动服务
sudo launchctl start com.ethan.claude-history-viewer

# 管理命令
sudo launchctl stop com.ethan.claude-history-viewer    # 停止
sudo launchctl unload /Library/LaunchDaemons/com.ethan.claude-history-viewer.plist  # 卸载
```

### Linux (Systemd)

创建 `/etc/systemd/system/claude-history-viewer.service`:

```ini
[Unit]
Description=Claude History Viewer
After=network.target

[Service]
Type=forking
User=ethan
WorkingDirectory=/Users/ethan/Documents/src/claude-history/claude-history-viewer
ExecStart=/bin/bash /Users/ethan/Documents/src/claude-history/claude-history-viewer/start.sh start
ExecStop=/bin/bash /Users/ethan/Documents/src/claude-history/claude-history-viewer/start.sh stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

然后启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable claude-history-viewer
sudo systemctl start claude-history-viewer
```

## 环境配置

### 生产环境变量 (.env.production)

```bash
# 前端配置
PORT=3100
NEXT_PUBLIC_API_URL=http://localhost:8800

# 后端配置
BACKEND_PORT=8800
CORS_ORIGIN=http://localhost:3100

# 缓存配置
CACHE_DIR=.cache
MAX_CACHE_SIZE=100MB
CACHE_TTL=3600

# 文件监控
WATCH_DIR=/Users/ethan/.claude/projects
WATCH_INTERVAL=5000

# 日志配置
LOG_LEVEL=info
LOG_DIR=logs
LOG_RETENTION_DAYS=7
```

### 自定义配置

1. 修改端口：
   ```bash
   # 编辑 .env.production
   PORT=3200
   BACKEND_PORT=8900
   ```

2. 允许跨域多个域名：
   ```bash
   CORS_ORIGIN=http://localhost:3100,http://example.com
   ```

3. 调整缓存设置：
   ```bash
   MAX_CACHE_SIZE=500MB
   CACHE_TTL=7200  # 2小时
   ```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看占用端口的进程
   lsof -i :3100
   lsof -i :8800

   # 杀死占用进程
   kill -9 <PID>
   ```

2. **PM2进程异常**
   ```bash
   # 删除所有PM2进程
   pm2 delete all

   # 重新启动
   ./start.sh start
   ```

3. **内存泄漏**
   ```bash
   # 查看内存使用
   pm2 monit

   # 重启服务释放内存
   pm2 restart all
   ```

4. **日志文件过大**
   ```bash
   # 清理旧日志
   find logs -name "*.log.*" -mtime +7 -delete

   # 清空当前日志
   > logs/frontend-out.log
   > logs/frontend-error.log
   ```

### 调试模式

```bash
# 临时修改环境变量
export NODE_ENV=development

# 手动启动后端调试
node --inspect server.js

# 手动启动前端调试
npm run dev
```

## 备份与恢复

### 备份配置

```bash
# 备份重要文件
tar -czf backup-$(date +%Y%m%d).tar.gz \
  .env.production \
  ecosystem.config.cjs \
  server.js \
  start.sh \
  monitor.sh
```

### 恢复部署

```bash
# 1. 解压备份
tar -xzf backup-20240327.tar.gz

# 2. 安装依赖
npm install

# 3. 重建项目
npm run build

# 4. 启动服务
./start.sh start
```

## 性能优化

### 内存限制

PM2配置中已设置内存限制：
```javascript
max_memory_restart: '1G'  // 超过1GB自动重启
```

### 进程管理

- 前端: 1个实例（fork模式）
- 后端: 1个实例（fork模式）
- 自动重启: 启用
- 监控: 启用

### 日志轮转

监控脚本自动轮转日志（超过10MB）：
```bash
# 手动清理旧日志
find logs -name "*.log.*" -mtime +30 -delete
```

## 安全建议

1. **防火墙配置**
   ```bash
   # 只允许本地访问
   sudo ufw allow from 127.0.0.1 to any port 3100
   sudo ufw allow from 127.0.0.1 to any port 8800
   ```

2. **定期更新**
   ```bash
   # 更新依赖
   npm update

   # 重建项目
   npm run build

   # 重启服务
   ./start.sh restart
   ```

3. **监控告警**
   - 设置磁盘空间告警（>90%）
   - 设置内存使用告警（>80%）
   - 设置服务宕机告警

## 支持与维护

### 日常维护任务

1. **每日检查**
   ```bash
   ./start.sh status
   ./monitor.sh
   ```

2. **每周维护**
   ```bash
   # 清理旧日志
   find logs -name "*.log.*" -mtime +7 -delete

   # 更新依赖
   npm update
   ```

3. **每月维护**
   ```bash
   # 重启所有服务
   ./start.sh restart

   # 检查磁盘空间
   df -h .
   ```

### 联系支持

如有问题，请检查：
1. 查看相关日志文件
2. 运行监控脚本检查
3. 参考本部署指南

---

**最后更新**: 2026-03-27
**版本**: 1.0.0
**作者**: Claude Code