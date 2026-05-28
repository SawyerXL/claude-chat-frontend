/**
 * Claude Skills Registry - With Official Skills
 * 
 * This file integrates official Claude.ai skills with our custom skills.
 * Official skills are loaded from the 'official' subdirectory.
 */

import type { Skill } from '../types';

// Import official skill prompts
import DOCX_SKILL from './official/docx/SKILL.md?raw';
import PDF_SKILL from './official/pdf/SKILL.md?raw';
import PDF_READING_SKILL from './official/pdf-reading/SKILL.md?raw';
import XLSX_SKILL from './official/xlsx/SKILL.md?raw';
import PPTX_SKILL from './official/pptx/SKILL.md?raw';
import FILE_READING_SKILL from './official/file-reading/SKILL.md?raw';
import FRONTEND_DESIGN_SKILL from './official/frontend-design/SKILL.md?raw';

// File generation skill - tell AI how to generate downloadable files
const FILE_GENERATION_SKILL = `
# 文件生成技能 (File Generation Skill)

## 技能描述
当用户请求生成可下载的文件（Excel、Word、PDF、PPT 等）时，使用此技能。

## 触发关键词
- "生成 Excel"、"生成 xlsx"、"生成表格"
- "生成 Word"、"生成 docx"、"生成文档"
- "生成 PDF"、"生成报告"
- "生成 PPT"、"生成演示文稿"
- "下载文件"、"导出为"
- "创建价格表"、"创建清单"、"创建报表"

## 输出格式要求
当用户请求生成文件时，**必须**按以下格式输出数据：

### 使用 Artifact 语法
使用特殊的 artifact 语法来创建可下载的数据表格：

\`\`\`artifact:table "产品报价单"
名称	价格	数量	备注
产品A	¥99	10	热销
产品B	¥199	5	新品
产品C	¥299	3	特价
\`\`\`

**重要：**
- 第一行必须是 \`\`\`artifact:table "标题"\`
- **标题必须是中文描述性名称**，如"产品报价单"、"库存清单"、"客户列表"等
- 表格内容使用 **Tab 键** 分隔列（不是空格）
- 表头必须在第一行
- 每行用换行符分隔

### 提示用户
生成 artifact 后，**必须明确告诉用户**：
"✅ 数据已生成！点击上方的 Artifact 查看器，可以使用「生成文件」按钮导出为 Excel/Word/PDF 等格式。"

## 支持的导出格式
1. **Excel (.xlsx)** - 适用于表格数据
2. **Word (.docx)** - 适用于文档报告
3. **PDF (.pdf)** - 适用于打印/分享
4. **PowerPoint (.pptx)** - 适用于演示展示

## 重要提示
- Tab 键分隔必须是键盘上的 **Tab 键**，不是空格
- 保持数据对齐，便于用户查看
- 不要在 artifact 前后添加多余的说明文字（除了提示用户导出的那句话）
- 完整数据可分多个 artifact 展示
`;

export const SKILLS_REGISTRY: Skill[] = [
  // ==================== 文件生成器 ====================
  {
    id: 'file-generator',
    name: '📥 文件生成器',
    description: '生成可下载的 Excel、Word、PDF、PPT 文件',
    icon: '📥',
    category: 'document',
    activationKeywords: [
      '生成', '下载', '导出', '创建表格', '创建文档', '生成excel', '生成表格',
      '生成文档', '生成pdf', '生成ppt', '价格表', '清单', '报表', '报告',
      '生成文件', '创建文件'
    ],
    systemPrompt: FILE_GENERATION_SKILL,
    capabilities: [
      '生成 .xlsx Excel 表格',
      '生成 .docx Word 文档',
      '生成 .pdf PDF 报告',
      '生成 .pptx PPT 演示文稿',
      '数据格式转换'
    ],
    isOfficial: false,
  },

  // ==================== Official Document Processing ====================
  {
    id: 'docx',
    name: 'Word Document (DOCX)',
    description: '创建、编辑、读取 Word 文档 - 支持目录、页眉页脚、表格、格式化',
    icon: '📝',
    category: 'document',
    activationKeywords: [
      'word', 'docx', '文档', '报告', '合同', 'word文档', 'Word',
      '.docx', 'letterhead', 'memo', '模板', '页眉页脚', '目录'
    ],
    systemPrompt: DOCX_SKILL,
    capabilities: [
      '创建 .docx 文件',
      '添加目录和索引',
      '编辑页眉页脚',
      '插入表格和图片',
      '处理批注和修订',
      '格式排版'
    ],
    requiresFileUpload: true,
    isOfficial: true,
  },

  {
    id: 'pdf',
    name: 'PDF Processing',
    description: 'PDF 文件处理 - 创建、编辑、合并、拆分、表单填写',
    icon: '📄',
    category: 'document',
    activationKeywords: [
      'pdf', 'PDF', '提取pdf', '合并pdf', '拆分pdf', 'pdf水印', 'pdf表单'
    ],
    systemPrompt: PDF_SKILL,
    capabilities: [
      '创建 PDF 文件',
      '提取 PDF 内容',
      '合并/拆分 PDF',
      '填写表单',
      '添加水印'
    ],
    requiresFileUpload: true,
    isOfficial: true,
  },

  {
    id: 'pdf-reading',
    name: 'PDF Reading',
    description: 'PDF 内容提取和理解 - 文字、表格、扫描件 OCR',
    icon: '📖',
    category: 'document',
    activationKeywords: [
      '阅读pdf', '读取pdf', 'pdf内容', 'pdf文字', 'pdf表格', '扫描件', 'ocr'
    ],
    systemPrompt: PDF_READING_SKILL,
    capabilities: [
      '提取 PDF 文字',
      '解析表格数据',
      'OCR 识别',
      '内容摘要'
    ],
    requiresFileUpload: true,
    isOfficial: true,
  },

  {
    id: 'xlsx',
    name: 'Excel Spreadsheet (XLSX)',
    description: '创建和编辑 Excel 表格 - 公式、图表、数据处理',
    icon: '📊',
    category: 'document',
    activationKeywords: [
      'excel', 'xlsx', '表格', '工作表', '公式', '图表', 'spreadsheet',
      '数据清洗', '数据分析', '单元格'
    ],
    systemPrompt: XLSX_SKILL,
    capabilities: [
      '创建 .xlsx 文件',
      '写入公式和函数',
      '生成图表',
      '数据清洗转换',
      '格式设置'
    ],
    requiresFileUpload: true,
    isOfficial: true,
  },

  {
    id: 'pptx',
    name: 'PowerPoint (PPTX)',
    description: '创建和编辑演示文稿 - 幻灯片、模板、动画',
    icon: '📽️',
    category: 'document',
    activationKeywords: [
      'ppt', 'pptx', '演示', '幻灯片', 'presentation', '演讲', '幻灯'
    ],
    systemPrompt: PPTX_SKILL,
    capabilities: [
      '创建演示文稿',
      '套用模板',
      '生成幻灯片',
      '插入图表多媒体',
      '设置动画'
    ],
    requiresFileUpload: true,
    isOfficial: true,
  },

  {
    id: 'file-reading',
    name: 'File Reading',
    description: '智能文件读取 - 代码、配置、数据文件的理解和分析',
    icon: '📁',
    category: 'coding',
    activationKeywords: [
      '读取文件', '分析代码', '解释代码', '代码文件', '配置文件',
      'read file', 'analyze', '代码解释'
    ],
    systemPrompt: FILE_READING_SKILL,
    capabilities: [
      '读取代码文件',
      '理解项目结构',
      '分析配置文件',
      '代码解释和文档'
    ],
    isOfficial: true,
  },

  // ==================== Design Skills ====================
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    description: '生成高质量前端界面 - React/Vue/HTML/CSS 设计原型',
    icon: '🎨',
    category: 'design',
    activationKeywords: [
      '界面', '前端', '网页', 'ui', 'dashboard', '控制台', '登录页面',
      '表单', '卡片', '按钮', '原型', '设计', 'frontend', 'website'
    ],
    systemPrompt: FRONTEND_DESIGN_SKILL,
    capabilities: [
      '生成 HTML/CSS 原型',
      'React/Vue 组件',
      '响应式布局',
      '暗色/亮色主题',
      '交互效果'
    ],
    isOfficial: true,
  },

  // ==================== Custom Skills ====================
  {
    id: 'superpowers',
    name: 'Superpowers',
    description: '完整开发流程套件 - 需求分析、代码实现、测试、调试',
    icon: '⚡',
    category: 'coding',
    activationKeywords: [
      '开发', '写代码', '编程', 'debug', '调试', '测试', '代码审查',
      'implement', '开发计划', 'tdd'
    ],
    systemPrompt: `你激活了 Superpowers Skill - 全栈开发超级助手。

**开发流程覆盖：**

1. **需求阶段** - 理解业务需求，澄清模糊点
2. **设计阶段** - 技术方案选型，架构设计
3. **编码阶段** - 遵循最佳实践，代码规范
4. **测试阶段** - 编写测试用例，执行测试
5. **审查阶段** - 代码质量检查，性能优化

**使用方式：**
描述需求 → 分析 → 提供完整解决方案 → 实施`,
    capabilities: [
      '需求分析和澄清',
      '技术方案设计',
      '代码实现',
      '单元测试',
      '调试修复',
      '代码审查'
    ],
  },

  {
    id: 'code-review',
    name: 'Code Review',
    description: '深度代码审查 - 正确性、安全性、性能、可维护性',
    icon: '🔍',
    category: 'coding',
    activationKeywords: [
      'review', '审查', '检查代码', '代码审计', '安全检查', '性能分析'
    ],
    systemPrompt: `你激活了 Code Review Skill。

**审查维度：**
1. **正确性** - 逻辑错误、边界条件、异常处理
2. **安全性** - SQL/XSS/CSRF 注入、敏感信息
3. **性能** - 复杂度、数据库优化、缓存
4. **可维护性** - 复杂度、命名、注释、模块化`,
    capabilities: [
      '代码正确性检查',
      '安全漏洞识别',
      '性能问题发现',
      '最佳实践建议'
    ],
  },

  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: '全链路数据分析 - 清洗、可视化、统计洞察',
    icon: '📈',
    category: 'analysis',
    activationKeywords: [
      '数据分析', '数据清洗', '可视化', '图表', '统计', '洞察', 'data analysis'
    ],
    systemPrompt: `你激活了 Data Analysis Skill。

**分析流程：**
1. 数据理解 - 来源、结构、质量评估
2. 数据清洗 - 缺失值、异常值、标准化
3. 探索分析 - 描述统计、分布、相关性
4. 可视化 - 生成图表、交互式图表
5. 洞察提炼 - 关键发现、趋势、建议`,
    capabilities: [
      '数据清洗预处理',
      '统计分析',
      '可视化生成',
      '趋势分析'
    ],
    requiresFileUpload: true,
  },

  {
    id: 'mcp',
    name: 'MCP Connectors',
    description: '连接外部应用 - Slack、GitHub、Notion 等服务的自动化集成',
    icon: '🔗',
    category: 'tools',
    activationKeywords: [
      '连接', '集成', '自动化', 'slack', 'github', 'notion', 'webhook'
    ],
    systemPrompt: `你激活了 MCP Connectors Skill。

**支持的集成：**
- Slack: 发送消息、创建频道
- GitHub: Issue/PR、提交代码
- Notion: 页面、数据库同步
- 自定义: REST API、Webhook

**使用方式：**
描述要连接的服务 → 提供配置指导 → 生成集成代码`,
    capabilities: [
      '连接 Slack',
      'GitHub 集成',
      'Notion 同步',
      '自定义 API'
    ],
  },

  {
    id: 'skill-creator',
    name: 'Skill Creator',
    description: '创建自定义技能包 - 用自然语言描述需求，生成专属 Skill',
    icon: '🛠️',
    category: 'tools',
    activationKeywords: [
      '创建skill', '自定义技能', '新建技能', 'create skill'
    ],
    systemPrompt: `你激活了 Skill Creator Skill。

**创建流程：**
1. 需求收集 - 描述技能功能、使用场景
2. 技能定义 - 名称、描述、关键词
3. 生成技能包 - 系统提示词、功能列表
4. 测试验证`,
    capabilities: [
      '定义技能功能',
      '编写技能描述',
      '生成激活关键词',
      '创建系统提示词'
    ],
  },
];

// Detect skills based on user input
export function detectSkills(userInput: string): Skill[] {
  const input = userInput.toLowerCase();
  const matchedSkills: Array<{ skill: Skill; matchCount: number; priority: number }> = [];

  for (const skill of SKILLS_REGISTRY) {
    let matchCount = 0;
    
    // Check keywords
    for (const keyword of skill.activationKeywords) {
      if (input.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    
    // Official skills get priority boost
    const priority = skill.isOfficial ? 10 : 1;
    
    if (matchCount > 0) {
      matchedSkills.push({ skill, matchCount, priority });
    }
  }

  // Sort by priority (official first) then by match count
  matchedSkills.sort((a, b) => {
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.matchCount - a.matchCount;
  });

  return matchedSkills.map(m => m.skill);
}

// Get skills by category
export function getSkillsByCategory(): Record<string, Skill[]> {
  const categories: Record<string, Skill[]> = {};
  for (const skill of SKILLS_REGISTRY) {
    if (!categories[skill.category]) {
      categories[skill.category] = [];
    }
    categories[skill.category].push(skill);
  }
  return categories;
}

// Generate system prompt for skills
export function generateSkillsSystemPrompt(): string {
  const officialSkills = SKILLS_REGISTRY.filter(s => s.isOfficial);
  const customSkills = SKILLS_REGISTRY.filter(s => !s.isOfficial);
  const fileGeneratorSkill = customSkills.find(s => s.id === 'file-generator');
  const otherCustomSkills = customSkills.filter(s => s.id !== 'file-generator');

  let prompt = `\n\n## 🤖 可用技能 (Skills)\n\n`;

  // File Generator - highest priority for file generation
  if (fileGeneratorSkill) {
    prompt += `### 📥 文件生成技能 (最重要！)\n`;
    prompt += `**${fileGeneratorSkill.name}**: ${fileGeneratorSkill.description}\n\n`;
    prompt += fileGeneratorSkill.systemPrompt;
  }

  prompt += `\n---\n\n`;

  prompt += `### ⭐ 官方 Skills\n`;
  for (const skill of officialSkills) {
    prompt += `- ${skill.icon} **${skill.name}**: ${skill.description}\n`;
  }

  prompt += `\n### 其他自定义 Skills\n`;
  for (const skill of otherCustomSkills) {
    prompt += `- ${skill.icon} **${skill.name}**: ${skill.description}\n`;
  }

  prompt += `\n**使用规则：**
1. 当用户请求生成 Excel/Word/PDF/PPT 文件时，**必须使用「文件生成技能」**，输出 artifact:table 格式
2. 官方 Skills 用于文件读取和处理任务
3. 当检测到相关关键词时，自动激活对应技能
4. 一个请求可以同时使用多个技能

`;
  return prompt;
}

// Get skill by ID
export function getSkillById(id: string): Skill | undefined {
  return SKILLS_REGISTRY.find(s => s.id === id);
}

export default SKILLS_REGISTRY;
