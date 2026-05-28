import { useState, useEffect } from 'react';
import { Input, Modal, Button, message as antMessage, Empty, Dropdown, type MenuProps } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { PromptTemplate } from '../types';
import {
  getTemplates,
  saveTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDefaultTemplates,
} from '../services/promptTemplate';
import './PromptTemplatesPanel.css';

const CATEGORIES = ['通用', '工作', '开发', '求职', '语言', '生活'];
const ICONS = ['📝', '📋', '✉️', '📄', '🔍', '📝', '🌐', '💼', '📚', '🎯', '🚀', '💡'];

interface PromptTemplatesPanelProps {
  onUseTemplate?: (content: string) => void;
}

export default function PromptTemplatesPanel({ onUseTemplate }: PromptTemplatesPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateIcon, setTemplateIcon] = useState('📝');
  const [templateCategory, setTemplateCategory] = useState('通用');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    let loaded = getTemplates();
    if (loaded.length === 0) {
      const defaults = getDefaultTemplates();
      setTemplates(defaults);
      saveTemplates(defaults);
    } else {
      setTemplates(loaded);
    }
  };

  const handleCreateTemplate = () => {
    if (!templateName.trim()) {
      antMessage.error('请输入模板名称');
      return;
    }
    if (!templateContent.trim()) {
      antMessage.error('请输入模板内容');
      return;
    }
    const newTemplate = createTemplate(templateName.trim(), templateContent.trim(), templateIcon, templateCategory);
    const updated = [...templates, newTemplate];
    saveTemplates(updated);
    setTemplates(updated);
    resetModal();
    antMessage.success('模板已创建');
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !templateName.trim() || !templateContent.trim()) {
      antMessage.error('请填写完整信息');
      return;
    }
    const updated = editingTemplate;
    updated.name = templateName.trim();
    updated.content = templateContent.trim();
    updated.icon = templateIcon;
    updated.category = templateCategory;
    updateTemplate(updated);
    setTemplates(getTemplates());
    resetModal();
    antMessage.success('模板已更新');
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteTemplate(templateId);
    setTemplates(getTemplates());
    antMessage.success('模板已删除');
  };

  const resetModal = () => {
    setCreateModalOpen(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateContent('');
    setTemplateIcon('📝');
    setTemplateCategory('通用');
  };

  const openEditModal = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setTemplateIcon(template.icon);
    setTemplateCategory(template.category);
    setCreateModalOpen(true);
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    t.content.toLowerCase().includes(searchValue.toLowerCase()) ||
    t.category.toLowerCase().includes(searchValue.toLowerCase())
  );

  const groupedTemplates: Record<string, PromptTemplate[]> = {};
  for (const t of filteredTemplates) {
    const cat = t.category || '通用';
    if (!groupedTemplates[cat]) groupedTemplates[cat] = [];
    groupedTemplates[cat].push(t);
  }

  const handleUse = (template: PromptTemplate) => {
    // Broadcast to ChatView/WelcomePage via localStorage
    localStorage.setItem('claude_template_insert', JSON.stringify({ content: template.content }));
    onUseTemplate?.(template.content);
  };

  const handleCopy = (template: PromptTemplate) => {
    navigator.clipboard.writeText(template.content);
    antMessage.success('内容已复制到剪贴板');
  };

  const getMenuItems = (template: PromptTemplate): MenuProps['items'] => [
    {
      key: 'use',
      icon: <FileTextOutlined />,
      label: '使用此模板',
      onClick: () => handleUse(template),
    },
    {
      key: 'copy',
      icon: <FileTextOutlined />,
      label: '复制内容',
      onClick: () => handleCopy(template),
    },
    { type: 'divider' },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑',
      onClick: () => openEditModal(template),
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => handleDeleteTemplate(template.id),
    },
  ];

  return (
    <div className="prompt-templates-panel">
      <div className="pt-header">
        <Input
          placeholder="搜索模板..."
          prefix={<FileTextOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            resetModal();
            setCreateModalOpen(true);
          }}
        >
          新建模板
        </Button>
      </div>

      <div className="pt-list">
        {filteredTemplates.length === 0 ? (
          <Empty description={searchValue ? '无匹配模板' : '暂无模板'} />
        ) : (
          Object.entries(groupedTemplates).map(([category, items]) => (
            <div key={category} className="pt-category">
              <div className="pt-category-title">{category}</div>
              <div className="pt-items">
                {items.map((template) => (
                  <Dropdown
                    key={template.id}
                    menu={{ items: getMenuItems(template) }}
                    trigger={['contextMenu']}
                    placement="bottomLeft"
                  >
                    <div className="pt-item" onClick={() => handleUse(template)}>
                      <div className="pt-item-icon">{template.icon}</div>
                      <div className="pt-item-body">
                        <div className="pt-item-name">{template.name}</div>
                        <div className="pt-item-preview">
                          {template.content.slice(0, 60)}{template.content.length > 60 ? '...' : ''}
                        </div>
                      </div>
                      <div className="pt-item-actions">
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); openEditModal(template); }}
                          title="编辑"
                        />
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                          title="删除"
                        />
                      </div>
                    </div>
                  </Dropdown>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={createModalOpen}
        onOk={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
        onCancel={resetModal}
        width={600}
        okText={editingTemplate ? '保存' : '创建'}
        cancelText="取消"
      >
        <div className="pt-modal-form">
          <div className="pt-form-row">
            <label>名称</label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="例如：会议纪要"
              maxLength={50}
            />
          </div>

          <div className="pt-form-row">
            <label>分类</label>
            <div className="pt-icon-selector">
              {CATEGORIES.map(cat => (
                <span
                  key={cat}
                  className={`pt-category-chip ${templateCategory === cat ? 'selected' : ''}`}
                  onClick={() => setTemplateCategory(cat)}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-form-row">
            <label>图标</label>
            <div className="pt-icon-selector">
              {ICONS.map(icon => (
                <span
                  key={icon}
                  className={`pt-icon-chip ${templateIcon === icon ? 'selected' : ''}`}
                  onClick={() => setTemplateIcon(icon)}
                >
                  {icon}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-form-row">
            <label>内容</label>
            <Input.TextArea
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              placeholder="输入提示词模板内容...&#10;&#10;可以使用 {{variable}} 作为变量占位符"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}