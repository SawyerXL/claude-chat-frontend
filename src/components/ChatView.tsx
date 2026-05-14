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
  ExportOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FilePptOutlined,
} from '@ant-design/icons';
import PptxGenJS from 'pptxgenjs';
import mammoth from 'mammoth';
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
  onSend: (text: string, images?: string[], attachments?: Attachment[]) => void;
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingContent, setExportingContent] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
        let content: string;

        if (file.name.endsWith('.docx')) {
          // Parse .docx files with mammoth
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
          if (result.messages.length > 0) {
            console.log(`Mammoth warnings for ${file.name}:`, result.messages);
          }
        } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.xml')) {
          // Text files
          content = await file.text();
        } else if (file.name.endsWith('.pdf')) {
          // PDF - just pass as-is for now (could add pdf.js later)
          content = `[PDF file: ${file.name}]\n(This PDF content cannot be extracted directly)`;
        } else {
          // Try as text
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

  const handleExportMessage = (content: string) => {
    setExportingContent(content);
    setExportMenuOpen(true);
  };

  const doExport = async (format: 'docx' | 'pdf' | 'xlsx' | 'pptx') => {
    setExportMenuOpen(false);

    // Clean markdown content
    let cleanContent = exportingContent.replace(/```[\s\S]*?```/g, '\n[代码]\n');
    cleanContent = cleanContent.replace(/\*\*/g, '').replace(/\*/g, '');
    cleanContent = cleanContent.replace(/#+\s*/g, '').replace(/`/g, '');
    cleanContent = cleanContent.trim();

    const filename = `export_${Date.now()}`;

    if (format === 'docx') {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'SimSun', serif; font-size: 12pt; line-height: 1.6;">
          ${cleanContent.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
        </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      antMessage.success('DOC 导出成功!');
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head><title>Export</title>
          <style>body { font-family: 'SimSun', serif; padding: 40px; font-size: 12pt; line-height: 1.8; } p { margin: 8px 0; }</style>
          </head>
          <body>${cleanContent.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
          <script>window.print(); window.close();</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      antMessage.success('PDF 打印窗口已打开');
    } else if (format === 'xlsx') {
      try {
        const pptx = new PptxGenJS();
        const slide = pptx.addSlide();
        slide.addText(cleanContent, { x: 0.5, y: 0.5, w: 9, h: 6, fontSize: 11, fontFace: 'SimSun', valign: 'top' });
        await pptx.writeFile({ fileName: `${filename}.xlsx` });
        antMessage.success('XLSX 导出成功!');
      } catch { antMessage.error('导出失败'); }
    } else if (format === 'pptx') {
      try {
        const pptx = new PptxGenJS();
        const lines = cleanContent.split('\n');
        for (let i = 0; i < Math.min(lines.length, 20); i += 15) {
          const slide = pptx.addSlide();
          slide.addText(lines.slice(i, i + 15).join('\n'), {
            x: 0.5, y: 0.5, w: 9, h: 5.5, fontSize: 12, fontFace: 'SimSun', valign: 'top'
          });
        }
        await pptx.writeFile({ fileName: `${filename}.pptx` });
        antMessage.success('PPTX 导出成功!');
      } catch { antMessage.error('导出失败'); }
    }
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
                  {/* Display attachments for user messages */}
                  {m.role === 'user' && m.attachments && m.attachments.length > 0 && (
                    <div className="message-attachments">
                      {m.attachments.map((att, idx) => (
                        <div key={idx} className="attachment-badge">
                          <FileOutlined />
                          <span>{att.name}</span>
                        </div>
                      ))}
                    </div>
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
                    <button
                      className="message-action-btn"
                      title="Export"
                      onClick={() => handleExportMessage(m.content)}
                    >
                      <ExportOutlined />
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

      {/* Export menu dropdown */}
      {exportMenuOpen && (
        <div className="export-menu-overlay" onClick={() => setExportMenuOpen(false)}>
          <div className="export-menu" onClick={e => e.stopPropagation()}>
            <div className="export-menu-title">选择导出格式</div>
            <div className="export-menu-item" onClick={() => doExport('docx')}>
              <FileWordOutlined /> 导出为 DOC
            </div>
            <div className="export-menu-item" onClick={() => doExport('pdf')}>
              <FilePdfOutlined /> 导出为 PDF
            </div>
            <div className="export-menu-item" onClick={() => doExport('xlsx')}>
              <FileExcelOutlined /> 导出为 XLSX
            </div>
            <div className="export-menu-item" onClick={() => doExport('pptx')}>
              <FilePptOutlined /> 导出为 PPTX
            </div>
          </div>
        </div>
      )}
    </div>
  );
}