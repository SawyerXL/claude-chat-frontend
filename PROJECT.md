# Claude Chat Frontend 项目文档

## 项目概述

**项目名称**: Claude Chat Frontend
**版本**: 0.0.0
**描述**: 克隆 Claude.com 界面的 React 前端应用
**域名**: chat.claudexia.com (HTTPS)
**Git 仓库**: https://github.com/SawyerXL/claude-chat-frontend

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.6 | UI 框架 |
| TypeScript | 6.0.2 | 类型安全 |
| Vite | 8.0.12 | 构建工具 |
| Ant Design | 6.3.7 | UI 组件库 |
| react-markdown | 10.1.0 | Markdown 渲染 |
| react-syntax-highlighter | 16.1.1 | 代码高亮 |
| remark-gfm | 4.0.1 | GitHub 风格 Markdown |

---

## 目录结构

```
src/
├── App.tsx                    # 主应用组件，状态管理
├── main.tsx                   # 入口文件
├── index.css                  # 全局样式
├── App.css                    # App 样式
│
├── components/                # UI 组件
│   ├── ChatView.tsx          # 聊天主视图（消息列表、输入框、重试逻辑）
│   ├── Sidebar.tsx           # 侧边栏（会话列表、用户菜单）
│   ├── WelcomePage.tsx       # 欢迎页面（模型选择、快捷操作）
│   ├── LoginDialog.tsx        # 登录对话框（sub2api 后端认证）
│   ├── LoginModal.tsx         # 登录弹窗（备用）
│   ├── LoginPage.tsx          # 登录页面（备用）
│   ├── ModelSelector.tsx     # 模型选择器
│   ├── ProjectsPanel.tsx     # 项目面板
│   ├── SearchPanel.tsx        # 搜索会话面板
│   ├── Settings.tsx           # 设置面板
│   ├── ArtifactViewer.tsx     # 代码预览窗口
│   ├── ArtifactsPanel.tsx    # Artifacts 面板
│   ├── CodePanel.tsx          # 代码面板
│   ├── CodeBlock.tsx          # 代码块组件（语法高亮、复制）
│   ├── ConnectorsPanel.tsx    # 连接器面板
│   ├── SkillPanel.tsx         # 技能面板
│   ├── StylePanel.tsx         # 样式面板
│   ├── ShareDialog.tsx        # 分享对话框
│   └── PlusMenu.tsx           # 加号菜单
│
├── services/                  # 业务逻辑服务
│   ├── api.ts                 # Chat API 调用（支持 thinking 扩展思考）
│   ├── login.ts               # 登录服务（sub2api /api/v1/auth/login）
│   ├── auth.ts                # 认证服务（localStorage token）
│   ├── session.ts             # 会话管理（localStorage + 服务器同步）
│   ├── config.ts              # 配置服务
│   ├── theme.ts               # 主题管理
│   ├── memory.ts              # 记忆服务
│   └── project.ts             # 项目服务
│
├── hooks/                     # React Hooks
│   ├── useKeyboardShortcuts.ts  # 键盘快捷键
│   └── useVoiceMode.ts          # 语音模式
│
├── styles/                    # CSS 样式文件
│   ├── chat.css               # 聊天样式
│   ├── sidebar.css            # 侧边栏样式
│   ├── settings.css           # 设置样式
│   ├── skills.css             # 技能样式
│   └── welcome.css            # 欢迎页样式
│
├── constants.ts               # 常量定义
├── types/                     # TypeScript 类型定义
│   └── index.ts               # 核心类型（ChatMessage, ChatSession, ModelOption 等）
│
└── utils/                     # 工具函数
    └── artifactParser.ts      # Artifact 解析器
```

---

## 核心类型定义

```typescript
// 消息类型
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;        // 扩展思考内容
  timestamp: number;
  attachments?: Attachment[];
}

// 会话类型
interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

// 模型设置
interface ModelSettings {
  temperature: number;  // 0.0 - 1.0
  topP: number;        // 0.0 - 1.0
  topK: number;        // 1 - 100
  maxTokens: number;   // 默认 16000（必须 > thinking.budget_tokens）
}
```

---

## API 配置

### 后端 API 代理（nginx）

| 路径 | 目标 | 用途 |
|------|------|------|
| `/api/` | sub2api (8080) | 登录、认证 |
| `/api/chat` | sub2api /v1/messages | 聊天请求（内置 API Key） |
| `/v1/` | sub2api (8080) | Claude API 代理 |
| `/session-api/` | 本地 3102 | 会话存储服务 |

### 登录接口

```typescript
POST /api/v1/auth/login
Body: { email: string, password: string }
Response: { code: 0, data: { access_token, user } }
```

### 会话存储接口

```typescript
GET  /session-api/api/sessions?user_id={id}
POST /session-api/api/sessions
DELETE /session-api/api/sessions/:id
```

---

## 主要功能

### ✅ 已实现

1. **用户认证**
   - 登录对话框（sub2api 后端）
   - JWT token 存储到 localStorage
   - 用户菜单（显示用户名、退出登录）

2. **聊天功能**
   - 流式 SSE 响应
   - Markdown 渲染（remark-gfm）
   - 扩展思考显示（thinking block）
   - 图片上传（base64）
   - 消息操作（复制、引用、导出、重试）

3. **会话管理**
   - 按用户隔离存储（localStorage + 服务器同步）
   - 会话列表（按时间分组）
   - 新建/删除/重命名会话
   - 切换会话保留上下文

4. **模型支持**
   - claude-sonnet-4-6（默认）
   - claude-opus-4-7
   - claude-haiku-4-5-20251001
   - 支持扩展思考（thinking enabled）

5. **导出功能**
   - 支持格式：DOCX, PDF, XLSX, PPTX, MD, JSON, CSV
   - 文件名使用内容标题
   - DOCX 支持表格格式

6. **代码高亮**
   - react-syntax-highlighter
   - 暗色/亮色主题切换
   - 一键复制

7. **Artifact 功能**
   - 解析代码块 artifact
   - 实时预览（React/HTML）
   - Artifacts 面板

### ⚠️ 注意事项

1. **扩展思考参数**
   - `max_tokens` 必须 > `thinking.budget_tokens`
   - 当前设置：max_tokens=16000, thinking.budget_tokens=8000

2. **模型温度**
   - opus-4-6/4-7, sonnet-4-6 不支持 temperature 参数
   - 其他模型使用 temperature/topP/topK

3. **会话存储**
   - 每个用户有独立的存储 key：`claude_sessions_user_{id}`
   - 服务器同步到 session-server (port 3102)

---

## 配置文件

### nginx 配置
- 路径: `/etc/nginx/conf.d/chat.conf`
- HTTPS: Let's Encrypt
- 反向代理到 sub2api

### 环境变量
- API 认证通过 sub2api 后端
- API Key 内置于 nginx 配置

---

## 构建和部署

```bash
# 开发
npm run dev

# 构建
npm run build

# 输出目录
dist/
```

**当前构建文件**: `index-BmEN__jv.js`

---

## 已知问题

1. ~~toLowerCase on undefined content~~ - 已修复
2. 重试按钮逻辑 - 已优化
3. 扩展思考启用 - 已启用

---

## 更新日志

### 2026-05-18
- 启用 Claude 扩展思考（thinking enabled）
- 修复 content 为 undefined 的崩溃
- 优化重试按钮逻辑
- 会话按用户隔离存储
- 登录服务接入 sub2api 后端