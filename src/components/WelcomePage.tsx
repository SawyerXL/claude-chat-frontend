import { useState, useEffect, useRef } from 'react';
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
  LoadingOutlined,
} from '@ant-design/icons';
import mammoth from 'mammoth';
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
  onSend: (text: string, images?: string[], attachments?: Attachment[]) => void;
  model: string;
  onModelChange: (id: string) => void;
  user?: User | null;
  onOpenSkills?: () => void;
  onOpenProjects?: () => void;
  onOpenStyle?: () => void;
  onOpenConnectors?: () => void;
}

interface Attachment {
  name: string;
  type: string;
  content: string;
}

export default function WelcomePage({ onSend, model, onModelChange, user, onOpenSkills, onOpenProjects, onOpenStyle, onOpenConnectors }: WelcomePageProps) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        interim += event.results[i][0].transcript;
      }
      setValue(prev => {
        const parts = prev.split(/\[.*?\] /);
        return parts[0] ? `${parts[0].trim()} ${interim}` : interim;
      });
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => console.error('Speech error:', e.error);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {}
    }
  };

  const displayName = user?.username || user?.email?.split('@')[0] || 'User';

  const handleSend = () => {
    const text = value.trim();
    if (!text && images.length === 0 && attachments.length === 0) return;
    onSend(text, images, attachments);
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
        let content: string;

        if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.xml')) {
          content = await file.text();
        } else if (file.name.endsWith('.pdf')) {
          content = `[PDF file: ${file.name}]\n(This PDF content cannot be extracted directly)`;
        } else {
          content = await file.text();
        }

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
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="#1a1a1a"/>
              <circle cx="12" cy="12" r="3" fill="#d4a574"/>
              <path d="M12 8v1M12 15v1M8 12h1M15 12h1" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round"/>
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
              <PlusMenu onImageUpload={handleImageUpload} onFileUpload={handleFileUpload} onOpenSkills={onOpenSkills} onOpenProjects={onOpenProjects} onOpenStyle={onOpenStyle} onOpenConnectors={onOpenConnectors} />
              <ModelSelector value={model} onChange={onModelChange} />
            </div>
            <div className="toolbar-right">
              <button
                className={`tool-btn voice-btn ${isListening ? 'listening' : ''}`}
                title={isListening ? '点击停止语音' : '点击开始语音输入'}
                onClick={toggleVoice}
              >
                {isListening ? <LoadingOutlined /> : <AudioOutlined />}
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