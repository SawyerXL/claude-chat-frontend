import { useState, useEffect, useRef } from 'react';
import { Input, message as antMessage } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AudioOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  ReloadOutlined,
  LikeOutlined,
  DislikeOutlined,
  StopOutlined,
  CloseOutlined,
  EditOutlined,
  FileOutlined,
} from '@ant-design/icons';
import ModelSelector from './ModelSelector';
import PlusMenu from './PlusMenu';
import CodeBlock from './CodeBlock';
import ArtifactViewer from './ArtifactViewer';
import type { ChatMessage } from '../types';
import type { Artifact } from '../types';
import { hasArtifacts, parseArtifacts } from '../utils/artifactParser';
import '../styles/chat.css';

const { TextArea } = Input;

interface ChatViewProps {
  messages: ChatMessage[];
  onSend: (text: string, images?: string[]) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  loading: boolean;
  model: string;
  onModelChange: (id: string) => void;
  onStop?: () => void;
}

interface Attachment {
  name: string;
  type: string;
  content: string;
}

export default function ChatView({
  messages,
  onSend,
  onEditMessage,
  loading,
  model,
  onModelChange,
  onStop,
}: ChatViewProps) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
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

  const startEditMessage = (msgId: string, content: string) => {
    setEditingMessageId(msgId);
    setEditValue(content);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditValue('');
  };

  const saveEditMessage = () => {
    if (editingMessageId && editValue.trim()) {
      onEditMessage(editingMessageId, editValue.trim());
      setEditingMessageId(null);
      setEditValue('');
    }
  };

  const lastUserMessage = messages.filter(m => m.role === 'user').pop();

  const renderers = {
    code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const code = String(children).replace(/\n$/, '');

      if (language) {
        return (
          <CodeBlock language={language} code={code} />
        );
      }
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    },
  };

  const renderMessageContent = (content: string) => {
    if (!content) {
      return (
        <div className="typing-indicator">
          <span />
          <span />
          <span />
        </div>
      );
    }

    if (hasArtifacts(content)) {
      const parsed = parseArtifacts(content);

      return (
        <div className="message-with-artifacts">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={renderers}
          >
            {content}
          </ReactMarkdown>

          {parsed.map((item) => (
            <button
              key={item.artifact.id}
              className="artifact-trigger"
              onClick={() => setActiveArtifact(item.artifact)}
            >
              <span className="artifact-icon">✨</span>
              <span className="artifact-label">{item.artifact.title}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={renderers}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        <div className="chat-messages-inner">
          {messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="message-avatar assistant">C</div>
              )}
              <div className="message-body">
                {m.role === 'user' && (
                  <div className="message-header">
                    <span className="message-sender">You</span>
                  </div>
                )}
                <div className="message-content markdown-body">
                  {editingMessageId === m.id ? (
                    <div className="message-edit-container">
                      <TextArea
                        className="message-edit-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoSize={{ minRows: 1, maxRows: 10 }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEditMessage();
                          }
                          if (e.key === 'Escape') {
                            cancelEditMessage();
                          }
                        }}
                      />
                      <div className="message-edit-actions">
                        <button className="message-edit-cancel" onClick={cancelEditMessage}>
                          Cancel
                        </button>
                        <button className="message-edit-save" onClick={saveEditMessage}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : m.role === 'assistant' ? (
                    <>
                      {m.thinking && (
                        <div className="thinking-block">
                          <div className="thinking-header">
                            <span className="thinking-icon">🤔</span>
                            <span>Thinking</span>
                          </div>
                          <div className="thinking-content">{m.thinking}</div>
                        </div>
                      )}
                      {renderMessageContent(m.content)}
                    </>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  )}
                </div>
                {m.role === 'user' && !editingMessageId && (
                  <div className="message-actions">
                    <button
                      className="message-action-btn"
                      title="Edit"
                      onClick={() => startEditMessage(m.id, m.content)}
                    >
                      <EditOutlined />
                    </button>
                  </div>
                )}
                {m.role === 'assistant' && m.content && (
                  <div className="message-actions">
                    <button
                      className="message-action-btn"
                      title="Copy"
                      onClick={() => handleCopy(m.content)}
                    >
                      <CopyOutlined />
                    </button>
                    <button className="message-action-btn" title="Retry">
                      <ReloadOutlined />
                    </button>
                    <button className="message-action-btn" title="Good">
                      <LikeOutlined />
                    </button>
                    <button className="message-action-btn" title="Bad">
                      <DislikeOutlined />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {!loading && lastUserMessage && (
        <div className="regenerate-bar">
          <button className="regenerate-btn" onClick={() => onSend(lastUserMessage.content)}>
            <ReloadOutlined /> Regenerate
          </button>
        </div>
      )}

      <div className="chat-input-container">
        <div className="chat-input-inner">
          <div className="welcome-input-area">
            {/* Image preview */}
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

            {/* Attachment preview */}
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
              placeholder="Reply to Claude..."
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
                {loading && onStop ? (
                  <button className="tool-btn stop" title="Stop" onClick={onStop}>
                    <StopOutlined />
                  </button>
                ) : (
                  <button
                    className="tool-btn send"
                    title="Send"
                    onClick={handleSend}
                    disabled={!value.trim() && images.length === 0 && attachments.length === 0}
                  >
                    <ArrowUpOutlined />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeArtifact && (
        <ArtifactViewer
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}
    </div>
  );
}