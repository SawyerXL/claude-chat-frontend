import { useState, useMemo } from 'react';
import { Modal, Input, message, Empty } from 'antd';
import { SearchOutlined, BookOutlined } from '@ant-design/icons';
import { SKILLS_REGISTRY, getSkillsByCategory, type Skill } from '../skills/registry';
import '../styles/skills.css';

interface SkillPanelProps {
  open: boolean;
  onClose: () => void;
  onUseSkill?: (skillKey: string, prompt?: string) => void;
}

const CATEGORY_INFO: Record<string, { name: string; icon: string; color: string }> = {
  document: { name: '办公文档', icon: '📂', color: '#4CAF50' },
  coding: { name: '编程开发', icon: '💻', color: '#2196F3' },
  design: { name: '创意设计', icon: '🎨', color: '#9C27B0' },
  analysis: { name: '数据分析', icon: '📊', color: '#FF9800' },
  tools: { name: '效率工具', icon: '⚙️', color: '#607D8B' },
};

export default function SkillPanel({ open, onClose, onUseSkill }: SkillPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillInput, setSkillInput] = useState('');

  const skillsByCategory = useMemo(() => getSkillsByCategory(), []);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return SKILLS_REGISTRY;
    const query = search.toLowerCase();
    return SKILLS_REGISTRY.filter(
      skill =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.activationKeywords.some(k => k.toLowerCase().includes(query))
    );
  }, [search]);

  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      if (!groups[skill.category]) {
        groups[skill.category] = [];
      }
      groups[skill.category].push(skill);
    }
    return groups;
  }, [filteredSkills]);

  const handleUseSkill = (skill: Skill) => {
    if (skill.systemPrompt) {
      // For skills with system prompts, trigger via callback
      onUseSkill?.(skill.id, skill.systemPrompt);
      onClose();
    } else {
      setSelectedSkill(skill);
    }
  };

  const handleSubmit = () => {
    if (!skillInput.trim() || !selectedSkill) return;
    onUseSkill?.(selectedSkill.id, skillInput);
    onClose();
    setSelectedSkill(null);
    setSkillInput('');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div className="skills-modal-title">
          <BookOutlined />
          <span>Claude Skills</span>
        </div>
      }
      width={700}
      centered
      className="skill-panel-modal skills-modal"
    >
      <div className="skill-panel">
        {/* Search */}
        <div className="skills-search">
          <SearchOutlined className="search-icon" />
          <input
            type="text"
            placeholder="搜索技能..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Skills list by category */}
        <div className="skills-categories">
          {Object.entries(groupedSkills).map(([category, skills]) => {
            const info = CATEGORY_INFO[category] || { name: category, icon: '📁', color: '#888' };
            return (
              <div key={category} className="skills-category">
                <div className="category-header" style={{ borderLeftColor: info.color }}>
                  <span className="category-icon">{info.icon}</span>
                  <span className="category-name">{info.name}</span>
                  <span className="category-count">{skills.length}</span>
                </div>
                <div className="category-skills">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className={`skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
                      onClick={() => handleUseSkill(skill)}
                    >
                      <div className="skill-icon">{skill.icon}</div>
                      <div className="skill-info">
                        <div className="skill-name">
                          {skill.isOfficial && <span className="official-badge">⭐</span>}
                          {skill.name}
                        </div>
                        <div className="skill-desc">{skill.description}</div>
                      </div>
                      {skill.requiresFileUpload && (
                        <div className="skill-badge">需要文件</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredSkills.length === 0 && (
            <Empty description="没有找到匹配的技能" />
          )}
        </div>

        {/* Selected skill detail & input */}
        {selectedSkill && (
          <div className="skill-input-section">
            <div className="skill-detail-header">
              <span className="skill-icon">{selectedSkill.icon}</span>
              <div>
                <div className="skill-name">{selectedSkill.name}</div>
                <div className="skill-capabilities">
                  {selectedSkill.capabilities.map((cap, i) => (
                    <span key={i} className="capability-tag">{cap}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="skill-prompt-label">
              输入你的需求（可选）：
            </div>
            <Input.TextArea
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder={`描述你的${selectedSkill.name}需求...`}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
            <div className="skill-actions">
              <button className="skill-cancel" onClick={() => setSelectedSkill(null)}>
                取消
              </button>
              <button className="skill-submit" onClick={handleSubmit}>
                激活 {selectedSkill.name}
              </button>
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="skill-tip">
          💡 <strong>智能激活：</strong>你也可以直接在对话中描述需求，AI 会自动检测并使用合适的技能。例如："帮我处理这个 Excel 文件" → 自动激活 Excel 技能
        </div>
      </div>
    </Modal>
  );
}
