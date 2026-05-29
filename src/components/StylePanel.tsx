import { useState } from 'react';
import { Modal, Select, Slider, message } from 'antd';
import { PaletteIcon } from './icons/ClaudeIcons';
import '../styles/settings.css';

interface StylePanelProps {
  open: boolean;
  onClose: () => void;
}

const RESPONSE_STYLES = [
  { key: 'concise', label: 'Concise', desc: 'Brief, to-the-point answers' },
  { key: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations' },
  { key: 'creative', label: 'Creative', desc: 'Creative and engaging responses' },
  { key: 'technical', label: 'Technical', desc: 'Precise, technical language' },
  { key: 'casual', label: 'Casual', desc: 'Friendly, conversational tone' },
];

const CREATIVITY_LEVELS = [
  { value: 0.3, label: 'Precise' },
  { value: 0.5, label: 'Balanced' },
  { value: 0.7, label: 'Creative' },
  { value: 0.9, label: 'Very Creative' },
];

export default function StylePanel({ open, onClose }: StylePanelProps) {
  const [style, setStyle] = useState<string>('detailed');
  const [creativity, setCreativity] = useState<number>(0.5);
  const [responseLength, setResponseLength] = useState<number>(50);

  const handleSave = () => {
    const styleConfig = { style, creativity, responseLength };
    localStorage.setItem('claude_style_preferences', JSON.stringify(styleConfig));
    message.success('Style preferences saved!');
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PaletteIcon />
          <span>Response Style</span>
        </div>
      }
      onOk={handleSave}
      okText="Save"
      width={450}
      centered
    >
      <div style={{ padding: '16px 0' }}>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Response Style</label>
          <Select
            value={style}
            onChange={setStyle}
            style={{ width: '100%' }}
            options={RESPONSE_STYLES.map(s => ({ value: s.key, label: s.label }))}
          />
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {RESPONSE_STYLES.find(s => s.key === style)?.desc}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Creativity Level: {CREATIVITY_LEVELS.find(c => c.value === creativity)?.label}
          </label>
          <Slider
            min={0.3}
            max={0.9}
            step={0.1}
            value={creativity}
            onChange={setCreativity}
            marks={{ 0.3: 'Precise', 0.5: 'Balanced', 0.7: 'Creative', 0.9: 'Very' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Response Length: {responseLength}%
          </label>
          <Slider
            min={20}
            max={100}
            value={responseLength}
            onChange={setResponseLength}
            marks={{ 20: 'Short', 50: 'Medium', 80: 'Long', 100: 'Max' }}
          />
        </div>
      </div>
    </Modal>
  );
}