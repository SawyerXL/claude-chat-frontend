# Claude Chat Clone

基于 React + TypeScript + Vite + Ant Design 构建的 Claude 官网聊天界面克隆项目，支持真实 API 调用与日志记录。

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **UI 组件**: Ant Design 5 (深色主题)
- **Markdown 渲染**: react-markdown + remark-gfm
- **API**: Claude API (Anthropic)

## 项目结构

```
claude-clone/
├── config.json              # API 配置文件
├── logs/                    # API 请求/响应日志 (自动生成)
├── src/
│   ├── components/          # React 组件
│   │   ├── Sidebar.tsx      # 左侧导航栏
│   │   ├── WelcomePage.tsx  # 欢迎页
│   │   ├── ChatView.tsx     # 对话视图
│   │   ├── ModelSelector.tsx # 模型选择器
│   │   ├── PlusMenu.tsx     # 附加功能菜单
│   │   └── ShareDialog.tsx  # 分享对话框
│   ├── services/
│   │   └── api.ts           # API 调用封装
│   ├── styles/              # 样式文件
│   ├── types/               # TypeScript 类型定义
│   └── constants.ts         # 常量配置
├── vite-chat-plugin.ts      # Vite 中间件插件
└── vite.config.ts           # Vite 配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API

编辑 `config.json` 文件，配置你的 API 端点和密钥：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-api-endpoint.com",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key-here",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:5173/ 启动。

### 4. 停止开发服务器

在终端按 `Ctrl + C` 停止服务器。

## 常用命令

### 开发

```bash
# 启动开发服务器 (支持热更新)
npm run dev

# 启动开发服务器并暴露到网络
npm run dev -- --host
```

### 构建

```bash
# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 代码检查

```bash
# 运行 ESLint
npm run lint
```

### 清理

```bash
# 清理构建产物
rm -rf dist

# 清理依赖并重新安装
rm -rf node_modules package-lock.json
npm install

# 清理日志文件
rm -rf logs
```

## 功能特性

### 界面功能

- ✅ 左侧边栏导航 (New chat、Search、Chats、Projects、Artifacts、Code、Customize)
- ✅ 最近对话列表 (Recents)
- ✅ 用户信息展示 (头像、用户名、订阅计划)
- ✅ 侧边栏折叠/展开
- ✅ 欢迎页问候语 (根据时段自动切换)
- ✅ 自适应多行输入框
- ✅ 快捷操作按钮 (Create、Code、Write、Learn、Life stuff)
- ✅ 模型选择器 (Opus 4.7、Sonnet 4.6、Haiku 4.5)
- ✅ Adaptive thinking 开关
- ✅ Plus 菜单 (Add files、Screenshot、Skills、Connectors、Web search、Use style)
- ✅ 对话视图 (用户消息 + 助手回复)
- ✅ Markdown 渲染 (标题、列表、粗体、斜体、代码块、分隔线、引用、表格、链接)
- ✅ 打字动画效果
- ✅ 消息操作 (复制、重试、点赞、点踩)
- ✅ 分享对话框 (Keep private、Share with team、Create public link)

### API 功能

- ✅ 真实 Claude API 调用
- ✅ 模型切换 (Opus / Sonnet / Haiku)
- ✅ 请求/响应日志记录 (JSON Lines 格式)
- ✅ 错误处理与提示
- ✅ 敏感信息脱敏 (Authorization、x-api-key)

## 日志说明

### 日志位置

日志文件自动保存在 `logs/` 目录，按日期命名：

```
logs/
└── chat-2026-05-12.log
```

### 日志格式

每行一条 JSON 记录 (JSON Lines)：

```json
{"timestamp":"2026-05-12T03:38:26.153Z","requestId":"req-xxx","type":"request","url":"...","headers":{...},"body":{...}}
{"timestamp":"2026-05-12T03:38:26.153Z","requestId":"req-xxx","type":"response","status":200,"ok":true,"body":{...}}
{"timestamp":"2026-05-12T03:38:26.153Z","requestId":"req-xxx","type":"error","message":"..."}
```

### 查看日志

```bash
# 查看今天的日志
cat logs/chat-$(date +%Y-%m-%d).log

# 实时监控日志
tail -f logs/chat-$(date +%Y-%m-%d).log

# 格式化查看 JSON
cat logs/chat-$(date +%Y-%m-%d).log | jq .

# 只看请求
cat logs/chat-$(date +%Y-%m-%d).log | jq 'select(.type=="request")'

# 只看响应
cat logs/chat-$(date +%Y-%m-%d).log | jq 'select(.type=="response")'

# 只看错误
cat logs/chat-$(date +%Y-%m-%d).log | jq 'select(.type=="error")'
```

## API 端点

项目通过 Vite 中间件提供 `/api/chat` 端点，自动转发到配置的 Claude API：

```
POST /api/chat

Request Body:
{
  "model": "claude-sonnet-4-6",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "max_tokens": 4096
}

Response:
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "你好！有什么我可以帮助你的吗？" }
  ],
  "model": "claude-sonnet-4-6",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

## 模型映射

前端模型 ID 会自动映射为 API 模型名称：

| 前端 ID      | API 模型名称                  |
|-------------|----------------------------|
| opus-4-7    | claude-opus-4-7            |
| sonnet-4-6  | claude-sonnet-4-6          |
| haiku-4-5   | claude-haiku-4-5-20251001  |

## 故障排查

### 端口被占用

```bash
# 查看占用 5173 端口的进程
lsof -i :5173

# 杀死进程
kill -9 <PID>

# 或使用其他端口启动
npm run dev -- --port 3000
```

### API 调用失败

1. 检查 `config.json` 配置是否正确
2. 检查 API 密钥是否有效
3. 查看 `logs/` 目录下的错误日志
4. 检查网络连接

### 构建失败

```bash
# 清理缓存并重新构建
rm -rf node_modules/.vite dist
npm run build
```

## 开发说明

### 添加新组件

1. 在 `src/components/` 创建组件文件
2. 在 `src/styles/` 创建对应样式文件
3. 在父组件中引入使用

### 修改主题

编辑 `src/main.tsx` 中的 `ConfigProvider` theme 配置：

```tsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#d97757',  // 主色调
      colorBgBase: '#262624',   // 背景色
      // ... 其他配置
    },
  }}
>
```

### 修改 API 配置

编辑 `config.json` 或在 `vite-chat-plugin.ts` 中调整中间件逻辑。

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
