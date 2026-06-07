# CodeMemory v0.5 — Collaboration & Sharing

## Context

v0.4 完成搜索增强后，CodeMemory 已具备完整的数据采集、分析、搜索能力。v0.5 聚焦协作与分享，让用户能够安全地分享 AI 编码会话，并支持团队协作场景。

## 目标

- 生成可过期、可加密的公开分享链接
- 增强导出功能（Markdown/PDF/HTML）
- 支持团队工作区（远期目标）

## 分阶段交付

- **Phase 5A: 分享链接** — 公开访问 + 过期 + 密码保护
- **Phase 5B: 增强导出** — 格式化 Markdown/HTML/PDF 导出
- **Phase 5C: 团队工作区** — 团队管理 + 权限 + 会话共享（可推迟）

---

## Phase 5A: 分享链接

### Schema 变更

**Migration 0006: shared_links 表**

```sql
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slug VARCHAR(32) NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shared_links_slug ON shared_links(slug);
CREATE INDEX idx_shared_links_owner ON shared_links(owner_id);
CREATE INDEX idx_shared_links_session ON shared_links(session_id);
```

**`lib/db/schema.ts` 新增**：

```typescript
export const sharedLinks = pgTable('shared_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  viewCount: integer('view_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

### API 端点

**新建 `app/api/share/route.ts`**：

```typescript
POST /api/share
Body: {
  sessionId: string,
  expiresIn?: number,    // 小时（可选：1/24/168/不填=永不过期）
  password?: string      // 可选密码
}
Response: { slug: string, url: string }
```

- 使用 `crypto.randomBytes(16).toString('base64url')` 生成 slug
- 密码使用 `bcryptjs` 哈希存储

**新建 `app/api/share/[slug]/route.ts`**：

```typescript
GET /api/share/[slug]?password=xxx
Response: {
  session: SessionDetail,
  sharedAt: string,
  ownerName: string
}
```

- 验证链接是否活跃且未过期
- 如有密码则验证密码
- 递增 viewCount
- 返回的 session 数据脱敏（去除 machineId、文件路径等）

**新建 `app/api/share/manage/route.ts`**：

```typescript
GET    /api/share/manage     -- 列出用户的所有分享链接
DELETE /api/share/manage     -- 撤销分享链接 { slug: string }
```

### 前端

**新建 `app/share/[slug]/page.tsx`**

公开页面（无需认证），展示分享的会话：
- 哦 branded 头部（CodeMemory logo）
- "Shared by [owner name]" + 分享时间
- 查看次数
- 会话内容（与 `sessions/[id]` 类似的渲染）
- 如需密码，先显示密码输入表单
- 不显示敏感元数据（machineId、文件路径、环境变量）

**修改 `middleware.ts`**

将 `/share/*` 加入公开路由白名单。

**新建 `components/share-dialog.tsx`**

分享对话框组件：
- 过期选项：1 小时 / 1 天 / 1 周 / 永不过期
- 可选密码输入
- 生成按钮
- 显示分享 URL + 复制按钮
- 管理已有分享链接（列表 + 撤销）

**修改 `app/sessions/[id]/page.tsx`**

在现有 Export 按钮旁添加 Share 按钮，点击打开 ShareDialog。

---

## Phase 5B: 增强导出

### Markdown 导出

**新建 `lib/export/markdown-exporter.ts`**：

增强现有 Markdown 导出：
- 元数据头部（项目、日期、时长、工具统计）
- 长会话添加目录
- 工具调用格式化为可折叠区块
- 代码块语法高亮标记

### HTML 导出

**新建 `lib/export/html-exporter.ts`**：

独立 HTML 文件导出：
- 内联 CSS 样式（深色主题）
- 代码语法高亮（使用 highlight.js 内联）
- 打印友好布局
- 可在浏览器直接打开

### PDF 导出

**新建 `lib/export/pdf-exporter.ts`**（可选）：

两种方案：
1. **浏览器打印**：HTML 导出 + `@media print` CSS — 推荐首选
2. **服务端生成**：使用 `puppeteer` 或 `pdfkit` — 仅在需要自动化时

### 修改导出 API

**修改 `app/api/sessions/[id]/export/route.ts`**：

增加 `format` 参数支持：`markdown` | `html` | `pdf` | `json`。

---

## Phase 5C: 团队工作区（可推迟）

### Schema 变更

**Migration 0007: 团队相关表**

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  -- 'owner' | 'admin' | 'member' | 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, session_id)
);
```

### API 端点

- `GET/POST /api/teams` — 团队列表 / 创建团队
- `GET/PUT/DELETE /api/teams/[id]` — 团队详情 / 更新 / 删除
- `GET/POST/DELETE /api/teams/[id]/members` — 成员管理
- `GET/POST /api/teams/[id]/sessions` — 团队会话共享
- `GET /api/teams/[id]/search` — 团队内搜索

### 前端

- `app/teams/page.tsx` — 团队列表
- `app/teams/[id]/page.tsx` — 团队详情（成员 + 共享会话）
- `components/team-member-list.tsx` — 成员管理
- `components/team-session-list.tsx` — 共享会话列表
- 修改 `components/sidebar.tsx` — 添加 Teams 导航项（仅对团队成员可见）

### 权限模型

| 操作 | owner | admin | member | viewer |
|------|-------|-------|--------|--------|
| 管理团队设置 | ✅ | ✅ | ❌ | ❌ |
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 分享会话 | ✅ | ✅ | ✅ | ❌ |
| 查看共享会话 | ✅ | ✅ | ✅ | ✅ |
| 搜索团队会话 | ✅ | ✅ | ✅ | ✅ |

---

## 文件清单

### Phase 5A — 新建文件
- `app/api/share/route.ts`
- `app/api/share/[slug]/route.ts`
- `app/api/share/manage/route.ts`
- `app/share/[slug]/page.tsx`
- `components/share-dialog.tsx`

### Phase 5A — 修改文件
- `lib/db/schema.ts` — sharedLinks 表
- `app/sessions/[id]/page.tsx` — 添加 Share 按钮
- `middleware.ts` — 公开路由白名单

### Phase 5B — 新建文件
- `lib/export/markdown-exporter.ts`
- `lib/export/html-exporter.ts`
- `lib/export/pdf-exporter.ts`（可选）

### Phase 5B — 修改文件
- `app/api/sessions/[id]/export/route.ts` — 多格式支持

### Phase 5C — 新建文件
- `app/api/teams/route.ts`
- `app/api/teams/[id]/route.ts`
- `app/api/teams/[id]/members/route.ts`
- `app/api/teams/[id]/sessions/route.ts`
- `app/teams/page.tsx`
- `app/teams/[id]/page.tsx`
- `components/team-member-list.tsx`
- `components/team-session-list.tsx`

### Phase 5C — 修改文件
- `lib/db/schema.ts` — teams, team_members, team_sessions
- `lib/data-source.ts` — 团队相关方法
- `lib/db-data-source.ts` — 团队查询实现
- `components/sidebar.tsx` — Teams 导航

---

## 依赖

- v0.2 的多源支持（可分享任意来源的会话）
- v0.3 的分析功能（可选：分享时附带统计）
- v0.4 的搜索增强（团队内搜索）

---

## 风险与开放问题

1. **分享链接安全**：slug 必须 16+ 字符随机生成。密码保护链接需要限流防暴力破解。
2. **数据隐私**：AI 编码会话可能包含敏感代码、API 密钥、环境变量。考虑：
   - 分享前自动检测并警告敏感内容
   - 提供"脱敏分享"选项（去除文件路径、环境变量）
3. **PDF 导出依赖**：服务端 PDF 生成需要 Puppeteer（重量级）或 pdfkit（功能有限）。推荐浏览器打印为首选方案。
4. **Phase 5C 范围**：团队功能涉及权限管理、数据隔离、邀请流程，复杂度高。建议推迟到独立迭代。
5. **GDPR / 数据留存**：分享链接可能包含个人数据。需要自动清理过期链接 + 用户可请求删除。
6. **公开页面性能**：分享页面无需认证但需查数据库。考虑对热门分享链接做 CDN 缓存。

---

## 验证方式

### Phase 5A
1. `npm run build` — 确认无编译错误
2. `drizzle-kit push` — 验证 shared_links 表创建
3. `npm run dev` — 手动测试：
   - 创建分享链接（有/无密码、有/无过期）
   - 公开页面正确渲染（无需登录）
   - 密码保护链接验证
   - 过期链接拒绝访问
   - 撤销分享链接
   - viewCount 递增
   - 中间件放行 `/share/*` 路径

### Phase 5B
1. Markdown 导出格式正确（元数据、目录、代码高亮）
2. HTML 导出自包含且可在浏览器打开
3. 打印布局友好

### Phase 5C（如果实施）
1. 团队 CRUD 正常
2. 成员邀请和角色管理
3. 会话共享和权限控制
4. 团队内搜索

**不直接部署服务器**
