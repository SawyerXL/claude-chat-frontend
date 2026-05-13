import { useState } from 'react';
import { Input, message as antMessage } from 'antd';
import {
  AudioOutlined,
  ArrowUpOutlined,
  BulbOutlined,
  CodeOutlined,
  EditOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  FileOutlined,
} from '@ant-design/icons';
import ModelSelector from './ModelSelector';
import PlusMenu from './PlusMenu';
import type { User } from '../services/auth';
import '../styles/welcome.css';

const { TextArea } = Input;

const QUICK_ACTIONS = [
  { key: 'create', icon: <ThunderboltOutlined />, label: 'Create' },
  { key: 'code', icon: <CodeOutlined />, label: 'Code' },
  { key: 'write', icon: <EditOutlined />, label: 'Write' },
  { key: 'learn', icon: <BulbOutlined />, label: 'Learn' },
  { key: 'life', icon: <HeartOutlined />, label: 'Life stuff' },
];

interface WelcomePageProps {
  onSend: (text: string, images?: string[]) => void;
  model: string;
  onModelChange: (id: string) => void;
  user?: User | null;
}

interface Attachment {
  name: string;
  type: string;
  content: string;
}

export default function WelcomePage({ onSend, model, onModelChange, user }: WelcomePageProps) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const displayName = user?.username || user?.email?.split('@')[0] || 'User';

  const handleSend = () => {
    const text = value.trim();
    if (!text && images.length === 0 && attachments.length === 0) return;
    onSend(text, images);
    setValue('');
    setImages([]);
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (newImages: string[]) => {
    setImages((prev) => [...prev, ...newImages]);
  };

  const handleFileUpload = async (files: File[]) => {
    const newAttachments: Attachment[] = [];
    
    for (const file of files) {
      try {
        const content = await file.text();
        newAttachments.push({
          name: file.name,
          type: file.type,
          content: content,
        });
      } catch (err) {
        console.error('Failed to read file:', err);
        antMessage.error(`Failed to read ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
      antMessage.success(`Added ${newAttachments.length} file(s)`);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="welcome-container">
      <div className="welcome-inner">
        <div className="welcome-greeting">
          <div className="greeting-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.09 8.26L20 9L15 13.74L16.18 19.76L12 16.77L7.82 19.76L9 13.74L4 9L9.91 8.26L12 2Z" fill="#fff" opacity="0.9" />
            </svg>
          </div>
          <span>{getGreeting()}, {displayName}</span>
        </div>

        <div className="welcome-input-area">
          {images.length > 0 && (
            <div className="image-preview-container">
              {images.map((img, idx) => (
                <div key={idx} className="image-preview">
                  <img src={img} alt={`Upload ${idx + 1}`} />
                  <button
                    className="image-remove-btn"
                    onClick={() => handleRemoveImage(idx)}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="attachment-preview-container">
              {attachments.map((att, idx) => (
                <div key={idx} className="attachment-preview">
                  <FileOutlined />
                  <span className="attachment-name">{att.name}</span>
                  <button
                    className="attachment-remove-btn"
                    onClick={() => handleRemoveAttachment(idx)}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}

          <TextArea
            className="welcome-input"
            placeholder="How can I help you today?"
            autoSize={{ minRows: 1, maxRows: 8 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="borderless"
          />

          <div className="welcome-toolbar">
            <div className="toolbar-left">
              <PlusMenu onImageUpload={handleImageUpload} onFileUpload={handleFileUpload} />
              <ModelSelector value={model} onChange={onModelChange} />
            </div>
            <div className="toolbar-right">
              <button className="tool-btn" title="Voice mode">
                <AudioOutlined />
              </button>
              <button
                className="tool-btn send"
                title="Send"
                onClick={handleSend}
                disabled={!value.trim() && images.length === 0 && attachments.length === 0}
              >
                <ArrowUpOutlined />
              </button>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.key}
              className="quick-action"
              onClick={() => setValue(`Help me ${a.label.toLowerCase()}...`)}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className="welcome-tip">
          Claude can make mistakes. Please double-check responses.
        </div>
      </div>
    </div>
  );
}