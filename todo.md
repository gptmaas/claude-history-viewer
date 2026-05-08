# Claude History Viewer 部署任务状态

## 当前状态
已完成基础部署文件，等待用户确认方案

## 已创建的文件
1. `ecosystem.config.cjs` - PM2配置（前端3100 + 后端8800）
2. `server.js` - 后端API服务（目前依赖Next runtime，不算真正独立）
3. `deploy.sh` - 简化部署脚本
4. `README-DEPLOY.md` - 部署说明
5. `monitor.sh` - 监控脚本
6. `DEPLOYMENT.md` - 详细部署文档
7. `.env.production` - 环境配置
8. `com.ethan.claude-history-viewer.plist` - macOS LaunchDaemon配置

## 关键问题
当前前端所有页面都直接 `fetch('/api/xxx')` 同源调用，不会去8800端口
如果要真正前后端分离，需要修改前端API调用地址

## 待确认
用户要求：
1. 保持现状（前后端分离但前端仍请求同源/api/*）
2. 真正前后端分离（前端请求8800，后端完全独立）

## 实施步骤（如果选择真正分离）
1. 确认API契约（6个接口）
2. 抽离共享服务层（lib/）
3. 改造server.js为独立API服务（去掉next runtime）
4. 修改前端4个页面调用地址
5. 验证部署
6. 设置开机自启

## 验证方式
```bash
./deploy.sh
pm2 list
# 浏览器访问 http://localhost:3100
# 浏览器Network面板确认请求是否到8800
```
