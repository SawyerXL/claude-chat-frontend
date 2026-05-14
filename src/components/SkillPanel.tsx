import { useState } from 'react';
import { Modal, Input, message } from 'antd';
import '../styles/skills.css';

interface SkillPanelProps {
  open: boolean;
  onClose: () => void;
}

const SKILLS = [
  {
    key: 'review',
    name: 'Review',
    description: 'Review code changes for correctness, security, and performance',
    icon: '🔍',
  },
  {
    key: 'loop',
    name: 'Loop',
    description: 'Create a recurring loop that runs a prompt on a schedule',
    icon: '🔄',
  },
  {
    key: 'batch',
    name: 'Batch',
    description: 'Execute batch operations on multiple files in parallel',
    icon: '📦',
  },
];

export default function SkillPanel({ open, onClose }: SkillPanelProps) {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState('');

  const handleUseSkill = (key: string) => {
    setSelectedSkill(key);
  };

  const handleSubmit = () => {
    if (!skillInput.trim()) return;
    message.success(`${selectedSkill?.toUpperCase()} skill invoked!`);
    onClose();
    setSelectedSkill(null);
    setSkillInput('');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Skills"
      width={500}
      centered
    >
      <div className="skill-panel">
        {SKILLS.map((skill) => (
          <div
            key={skill.key}
            className={`skill-card ${selectedSkill === skill.key ? 'selected' : ''}`}
            onClick={() => handleUseSkill(skill.key)}
          >
            <div className="skill-icon">{skill.icon}</div>
            <div className="skill-info">
              <div className="skill-name">{skill.name}</div>
              <div className="skill-desc">{skill.description}</div>
            </div>
          </div>
        ))}

        {selectedSkill && (
          <div className="skill-input-section">
            <div className="skill-prompt-label">
              Enter your {selectedSkill} prompt:
            </div>
            <Input.TextArea
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder={`/${selectedSkill} your prompt here...`}
              autoSize={{ minRows: 3, maxRows: 8 }}
            />
            <div className="skill-actions">
              <button className="skill-cancel" onClick={() => setSelectedSkill(null)}>
                Cancel
              </button>
              <button className="skill-submit" onClick={handleSubmit}>
                Run {selectedSkill}
              </button>
            </div>
          </div>
        )}

        <div className="skill-tip">
          💡 Tip: You can also type /review, /loop, or /batch directly in the chat input
        </div>
      </div>
    </Modal>
  );
}