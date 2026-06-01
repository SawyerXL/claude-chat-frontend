import type { ModelOption } from './types';

// Updated Claude models (2026-05)
export const MODELS: ModelOption[] = [
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    description: 'Most intelligent model for complex tasks',
    badge: 'Max',
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: 'Highly capable model for complex tasks',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Smart, efficient model for everyday use',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Excellent for complex reasoning',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest model for simple tasks',
  },
];

export const QUICK_ACTIONS = [
  { key: 'create', icon: 'sparkles', label: 'Create' },
  { key: 'code', icon: 'code', label: 'Code' },
  { key: 'write', icon: 'edit', label: 'Write' },
  { key: 'learn', icon: 'bulb', label: 'Learn' },
  { key: 'life', icon: 'heart', label: 'Life stuff' },
];

export const RECENT_CHATS = [
  { id: '1', title: '仿照claude官网实现项目' },
  { id: '2', title: 'Claude Code 使用指南' },
  { id: '3', title: 'React 组件设计模式' },
  { id: '4', title: 'TypeScript 类型体操' },
  { id: '5', title: 'Ant Design 主题定制' },
  { id: '6', title: '前端性能优化方案' },
  { id: '7', title: 'Vite 构建配置' },
];