import type { PromptTemplate } from '../types';

const TEMPLATES_KEY = 'claude_prompt_templates';

export function getTemplates(): PromptTemplate[] {
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    if (!data) return getDefaultTemplates();
    return JSON.parse(data) as PromptTemplate[];
  } catch {
    return getDefaultTemplates();
  }
}

export function saveTemplates(templates: PromptTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function createTemplate(name: string, content: string, icon: string = '📝', category: string = '通用'): PromptTemplate {
  const now = Date.now();
  return {
    id: `template-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    content,
    icon,
    category,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTemplate(template: PromptTemplate): void {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = { ...template, updatedAt: Date.now() };
    saveTemplates(templates);
  }
}

export function deleteTemplate(templateId: string): void {
  const templates = getTemplates().filter(t => t.id !== templateId);
  saveTemplates(templates);
}

export function getDefaultTemplates(): PromptTemplate[] {
  const now = Date.now();
  return [
    {
      id: 'default-meeting',
      name: '会议纪要',
      icon: '📋',
      category: '工作',
      content: '请帮我整理以下会议纪要：\n\n**会议主题：**\n**时间：**\n**参会人员：**\n**讨论要点：**\n1. \n2. \n3. \n\n**待办事项：**\n- [ ] \n\n**下一步计划：**',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-email',
      name: '邮件撰写',
      icon: '✉️',
      category: '工作',
      content: '请帮我撰写一封邮件：\n\n**收件人：**\n**主题：**\n**邮件目的：**\n\n**语气风格：**（正式/友好/简洁）\n**主要内容包括：**',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-resume',
      name: '简历优化',
      icon: '📄',
      category: '求职',
      content: '请帮我优化简历：\n\n**目标岗位：**\n**期望强调的优势：**\n\n**当前简历内容：**\n```\n```',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-code-review',
      name: '代码审查',
      icon: '🔍',
      category: '开发',
      content: '请帮我审查以下代码：\n\n```\n```\n\n**重点关注：**\n- 代码逻辑\n- 性能优化\n- 安全漏洞\n- 代码风格',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-summarize',
      name: '内容总结',
      icon: '📝',
      category: '通用',
      content: '请帮我总结以下内容的核心要点：\n\n```\n```\n\n**总结维度：**\n- 核心观点\n- 关键数据\n- 行动建议',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-translate',
      name: '翻译润色',
      icon: '🌐',
      category: '语言',
      content: '请帮我翻译并润色以下内容：\n\n**源语言：**\n**目标语言：**\n\n**待翻译内容：**',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getTemplatesByCategory(): Record<string, PromptTemplate[]> {
  const templates = getTemplates();
  const groups: Record<string, PromptTemplate[]> = {};
  for (const t of templates) {
    const cat = t.category || '通用';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }
  return groups;
}