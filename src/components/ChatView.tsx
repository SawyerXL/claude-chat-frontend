import { useState, useEffect, useRef } from 'react';
import { Input, Button, message } from 'antd';
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
  FileMarkdownOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  LoadingOutlined,
  LinkOutlined,
  SearchOutlined,
  UpOutlined,
  DownOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import PptxGenJS from 'pptxgenjs';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import ModelSelector from './ModelSelector';
import PlusMenu from './PlusMenu';
import CodeBlock from './CodeBlock';
import ArtifactViewer from './ArtifactViewer';
import type { ChatMessage } from '../types';
import type { Artifact } from '../types';
import { hasArtifacts, parseArtifacts } from '../utils/artifactParser';
import '../styles/chat.css';
import { searchWeb } from '../services/session';

const { TextArea } = Input;

interface ChatViewProps {
  messages: ChatMessage[];
  onSend: (text: string, images?: string[], attachments?: Attachment[]) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  loading: boolean;
  model: string;
  onModelChange: (id: string) => void;
  onStop?: () => void;
  onRetry?: (messageId: string) => void; // kept for reference but using onSend directly
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

export default function ChatView({
  messages,
  onSend,
  onEditMessage,
  loading,
  model,
  onModelChange,
  onStop,
  onRetry: _onRetry,
  onOpenSkills,
  onOpenProjects,
  onOpenStyle,
  onOpenConnectors,
}: ChatViewProps) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingContent, setExportingContent] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIdx, setCurrentSearchIdx] = useState(0);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleRetry = () => {
    // Simply trigger regeneration by finding last user message and calling onSend
    if (!onSend) {
      console.log('[Retry] onSend is not defined');
      return;
    }
    
    // Find the last user message that preceded an assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') {
        console.log('[Retry] Found user message to retry:', m.content.substring(0, 30));
        onSend(m.content);
        return;
      }
    }
    console.log('[Retry] No user message found');
  };

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

    recognition.onend = () => {
      if (voiceMode) recognition.start();
      setIsListening(false);
    };

    recognition.onerror = (e: any) => console.error('Speech error:', e.error);
    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [voiceMode]);

  const toggleVoiceMode = () => {
    if (!recognitionRef.current) {
      message.warning('语音识别不可用');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setVoiceMode(true);
      } catch (e) {
        message.error('启动语音识别失败');
      }
    }
  };

  // Inline search functions
  const openInlineSearch = () => setInlineSearchOpen(true);
  const closeInlineSearch = () => {
    setInlineSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentSearchIdx(0);
    highlightSearchResults(value);
  };

  const highlightSearchResults = (query: string) => {
    messageRefs.current.forEach((el, id) => {
      if (!el) return;
      const msg = messages.find(m => m.id === id);
      if (!msg) return;

      if (query) {
        const regex = new RegExp(`(${query})`, 'gi');
        const matches = msg.content.match(regex);
        if (matches) {
          el.style.backgroundColor = 'var(--accent-dim, rgba(212, 165, 116, 0.3))';
        } else {
          el.style.backgroundColor = '';
        }
      } else {
        el.style.backgroundColor = '';
      }
    });
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    const matches = messages.filter(m =>
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matches.length === 0) return;

    const newIdx = direction === 'next'
      ? (currentSearchIdx + 1) % matches.length
      : (currentSearchIdx - 1 + matches.length) % matches.length;

    setCurrentSearchIdx(newIdx);
    const targetMsg = matches[newIdx];
    const targetEl = messageRefs.current.get(targetMsg.id);
    targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleWebSearch = async (query: string) => {
    try {
      const data = await searchWeb(query);
      if (data && data.results.length > 0) {
        // Insert search context as a user message with citations
        const citationText = data.results.map((r, i) =>
          `[${i + 1}] ${r.title}: ${r.url}\n${r.snippet || ''}`
        ).join('\n\n');

        onSend(`请根据以下搜索结果回答问题：\n\n搜索词：${query}\n\n搜索结果：\n${citationText}\n\n请提供总结和引用来源。`);
      } else {
        message.warning('No search results found');
      }
    } catch (err) {
      message.error('Search failed');
    }
  };

  const handleTemplateSelect = (template: string) => {
    setValue((prev) => prev ? prev + '\n' + template : template);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleQuoteMessage = (message: ChatMessage) => {
    setQuotedMessage(message);
    setValue(prev => prev + `\n[引用: ${message.content.slice(0, 50)}...]\n`);
  };

  const handleSend = () => {
    const text = value.trim();
    if (!text && images.length === 0 && attachments.length === 0) return;

    let finalText = text;
    if (quotedMessage) {
      finalText = `在之前的对话中提到：\n\n"${quotedMessage.content.slice(0, 500)}"\n\n---\n\n${text}`;
      setQuotedMessage(null);
    }

    onSend(finalText, images, attachments);
    if (text) {
      setInputHistory(prev => [text, ...prev.slice(0, 49)]);
      setHistoryIndex(-1);
    }
    setValue('');
    setImages([]);
    setAttachments([]);
    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      openInlineSearch();
    } else if (e.key === 'Escape' && inlineSearchOpen) {
      closeInlineSearch();
    } else if (inlineSearchOpen) {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateSearch('next');
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && !e.shiftKey) {
      // Navigate to previous input in history
      if (inputHistory.length > 0) {
        const newIndex = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, inputHistory.length - 1);
        setHistoryIndex(newIndex);
        setValue(inputHistory[newIndex]);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && !e.shiftKey) {
      // Navigate to next input in history
      if (historyIndex !== -1) {
        const newIndex = historyIndex - 1;
        if (newIndex < 0) {
          setHistoryIndex(-1);
          setValue('');
        } else {
          setHistoryIndex(newIndex);
          setValue(inputHistory[newIndex]);
        }
      }
      e.preventDefault();
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
        message.error(`Failed to read ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
      message.success(`Added ${newAttachments.length} file(s)`);
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

  // --- Helper functions for export ---

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  interface ExtractedTable { rows: string[][]; header?: string[]; }
  const extractTables = (content: string): ExtractedTable[] => {
    const tables: ExtractedTable[] = [];
    const mdTableRegex = /\|[\s\S]*?\|[\r\n]+(\|[-:\s|]+\|[\r\n]+)?([\s\S]*?)(?=\n\n|\n[^|]|$)/g;
    let match;
    while ((match = mdTableRegex.exec(content)) !== null) {
      const block = match[0];
      const rows: string[][] = [];
      const lines = block.split('\n').filter(l => l.trim() && l.trim().startsWith('|'));
      if (lines.length === 0) continue;
      for (const line of lines) {
        const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        rows.push(cells);
      }
      if (rows.length > 0) tables.push({ rows });
    }
    return tables;
  };

  const extractStructuredData = (content: string): any => {
    const tables = extractTables(content);
    const headings: { level: number; text: string }[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let hm;
    while ((hm = headingRegex.exec(content)) !== null) {
      headings.push({ level: hm[1].length, text: hm[2].trim() });
    }
    const bullets: string[] = [];
    const bulletRegex = /^[-*+]\s+(.+)$/gm;
    let bm;
    while ((bm = bulletRegex.exec(content)) !== null) {
      bullets.push(bm[1].trim());
    }
    return { title: headings[0]?.text || 'Exported Content', headings, tables: tables.map(t => t.rows), bullets, raw: content };
  };

  const parseMarkdownToDocx = (content: string) => {
    const children: (Paragraph | Table | TableRow)[] = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeLines: string[] = [];

    // Helper to parse a markdown table line into cells
    const parseTableRow = (line: string): string[] => {
      return line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    };

    // Helper to check if a line is a table separator
    const isTableSeparator = (line: string): boolean => {
      return /^\|[\s-|:]+\|$/.test(line);
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Handle table start
      if (line.trim().startsWith('|') && !isTableSeparator(line)) {
        const tableRows: TableRow[] = [];
        let rowIdx = 0;
        let headerRow: TableRow | null = null;

        // Collect all table rows
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          if (isTableSeparator(lines[i])) {
            i++;
            continue;
          }
          const cells = parseTableRow(lines[i]);
          const isHeader = rowIdx === 0;

          const tableCells = cells.map((cellText) => {
            // Handle inline formatting in cells
            const paragraphs: Paragraph[] = [];
            const parts = cellText.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
            const textRuns = parts.map(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return new TextRun({ text: part.slice(2, -2), bold: true });
              } else if (part.startsWith('*') && part.endsWith('*')) {
                return new TextRun({ text: part.slice(1, -1), italics: true });
              }
              return new TextRun({ text: part });
            });
            paragraphs.push(new Paragraph({ children: textRuns }));

            return new TableCell({
              children: paragraphs,
              shading: isHeader ? { fill: 'E8E8E8' } : { fill: 'FFFFFF' },
            });
          });

          const tr = new TableRow({ children: tableCells });
          if (rowIdx === 0) {
            headerRow = tr;
          } else {
            tableRows.push(tr);
          }
          rowIdx++;
          i++;
        }

        // Build table with header
        if (headerRow) {
          const allRows = [headerRow, ...tableRows];
          children.push(new Table({
            rows: allRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
        }
        continue;
      }

      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLines = [];
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: codeLines.join('\n'), font: 'Courier New', size: 20 })], shading: { fill: 'F5F5F5' } }));
          inCodeBlock = false;
        }
      } else if (inCodeBlock) {
        codeLines.push(line);
      } else if (line.match(/^#{1,6}\s/)) {
        const m = line.match(/^(#{1,6})\s(.+)$/);
        if (m) {
          children.push(new Paragraph({
            children: [new TextRun({ text: m[2], bold: true, size: 28 - m[1].length * 2 })],
            heading: HeadingLevel.HEADING_1
          }));
        }
      } else if (line.trim() === '') {
        children.push(new Paragraph({ children: [new TextRun('')] }));
      } else {
        const boldLine = line.replace(/\*\*(.+?)\*\*/g, '$1');
        const parts = boldLine.split(/(\*[^*]+\*)/g);
        const textRuns = parts.map(part => {
          if (part.startsWith('*') && part.endsWith('*')) {
            return new TextRun({ text: part.slice(1, -1), italics: true });
          }
          return new TextRun({ text: part });
        });
        children.push(new Paragraph({ children: textRuns }));
      }
      i++;
    }
    return new Document({ sections: [{ children: children as any }] });
  };

  const doExport = async (format: 'docx' | 'pdf' | 'xlsx' | 'pptx' | 'md' | 'json' | 'csv' | 'docx-real') => {
    setExportMenuOpen(false);

    const content = exportingContent;
    const tables = extractTables(content);
    // Extract title from content (first heading or first line)
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const title = headingMatch ? headingMatch[1].replace(/[<>:"/\\|?*]/g, '_').trim() : `export_${Date.now()}`;
    const filename = title;

    if (format === 'md') {
      let md = content;
      md = md.replace(/```[\s\S]*?```/g, (match) => `\n<details><summary>代码块</summary>\n\n${match}\n</details>\n`);
      downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
      message.success('Markdown 导出成功!');
    } else if (format === 'json') {
      const structured = extractStructuredData(content);
      const json = JSON.stringify(structured, null, 2);
      downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), `${filename}.json`);
      message.success('JSON 导出成功!');
    } else if (format === 'csv') {
      if (tables.length > 0) {
        const wb = XLSX.utils.book_new();
        tables.forEach((table, idx) => {
          const ws = XLSX.utils.aoa_to_sheet(table.rows);
          XLSX.utils.book_append_sheet(wb, ws, `Table${idx + 1}`);
        });
        const wbout = XLSX.write(wb, { bookType: 'csv', type: 'array' });
        downloadBlob(new Blob([wbout], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
        message.success('CSV 导出成功!');
      } else {
        let text = content.replace(/```[\s\S]*?```/g, '');
        text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s*/g, '').replace(/`/g, '');
        downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
        message.success('CSV 导出成功!');
      }
    } else if (format === 'docx-real') {
      try {
        const doc = parseMarkdownToDocx(content);
        const buffer = await Packer.toBlob(doc);
        downloadBlob(buffer, `${filename}.docx`);
        message.success('DOCX 导出成功!');
      } catch (e) { message.error('导出失败: ' + (e as Error).message); }
    } else if (format === 'xlsx') {
      try {
        if (tables.length > 0) {
          const wb = XLSX.utils.book_new();
          tables.forEach((table, idx) => {
            const ws = XLSX.utils.aoa_to_sheet(table.rows);
            XLSX.utils.book_append_sheet(wb, ws, `Table${idx + 1}`);
          });
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          downloadBlob(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
        } else {
          const cleanContent = content.replace(/```[\s\S]*?```/g, '');
          const lines = cleanContent.split('\n').filter(l => l.trim());
          const ws = XLSX.utils.aoa_to_sheet(lines.map(l => [l]));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Content');
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          downloadBlob(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
        }
        message.success('XLSX 导出成功!');
      } catch (e) { message.error('导出失败: ' + (e as Error).message); }
    } else if (format === 'pptx') {
      try {
        const pptx = new PptxGenJS();
        pptx.title = filename;
        const lines = content.split('\n');
        for (let i = 0; i < Math.min(lines.length, 200); i += 20) {
          const slide = pptx.addSlide();
          const chunk = lines.slice(i, i + 20).join('\n');
          slide.addText(chunk, {
            x: 0.5, y: 0.5, w: 9, h: 5.5, fontSize: 12, fontFace: 'SimSun', valign: 'top'
          });
        }
        // Use type assertion to handle the return type difference between browser and Node.js
        const response = await (pptx as any).write('array');
        const buffer = response instanceof ArrayBuffer ? response : new ArrayBuffer(0);
        const uint8 = new Uint8Array(buffer);
        downloadBlob(new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), `${filename}.pptx`);
        message.success('PPTX 导出成功!');
      } catch (e) { message.error('导出失败: ' + (e as Error).message); }
    } else if (format === 'docx') {
      let cleanContent = content.replace(/```[\s\S]*?```/g, '\n[代码]\n');
      cleanContent = cleanContent.replace(/\*\*/g, '').replace(/\*/g, '');
      cleanContent = cleanContent.replace(/#+\s*/g, '').replace(/`/g, '').trim();
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'SimSun', serif; font-size: 12pt; line-height: 1.6;">
          ${cleanContent.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
        </body>
        </html>
      `;
      downloadBlob(new Blob([htmlContent], { type: 'application/msword' }), `${filename}.doc`);
      message.success('DOC 导出成功!');
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head><title>Export</title>
          <style>body { font-family: 'SimSun', serif; padding: 40px; font-size: 12pt; line-height: 1.8; } p { margin: 8px 0; }</style>
          </head>
          <body>${content.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
          <script>window.print(); window.close();</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      message.success('PDF 打印窗口已打开');
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
      {/* Inline search bar */}
      {inlineSearchOpen && (
        <div className="inline-search-bar">
          <Input
            prefix={<SearchOutlined />}
            placeholder="在对话中搜索..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
            style={{ flex: 1 }}
          />
          <span className="search-count">
            {searchQuery ? `${currentSearchIdx + 1}/${messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length}` : ''}
          </span>
          <Button icon={<UpOutlined />} onClick={() => navigateSearch('prev')} size="small" />
          <Button icon={<DownOutlined />} onClick={() => navigateSearch('next')} size="small" />
          <Button icon={<CloseOutlined />} onClick={closeInlineSearch} size="small" />
        </div>
      )}

      <div className="chat-messages">
        <div className="chat-messages-inner">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-message ${m.role}`}
              ref={(el) => {
                if (el) messageRefs.current.set(m.id, el);
                else messageRefs.current.delete(m.id);
              }}
            >
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
                      title="Quote"
                      onClick={() => handleQuoteMessage(m)}
                    >
                      <LinkOutlined /> 引用
                    </button>
                    <button
                      className="message-action-btn"
                      title="Copy"
                      onClick={() => handleCopy(m.content)}
                    >
                      <CopyOutlined /> 复制
                    </button>
                    <button
                      className="message-action-btn export-btn"
                      title="Export"
                      onClick={() => handleExportMessage(m.content)}
                    >
                      <ExportOutlined /> 导出
                    </button>
                    <button
                      className="message-action-btn"
                      title="Retry"
                      onClick={handleRetry}
                    >
                      <RedoOutlined /> 重试
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

            {/* Quoted message display */}
            {quotedMessage && (
              <div className="quoted-message">
                <div className="quoted-header">
                  <LinkOutlined /> 引用消息
                  <button className="quoted-close" onClick={() => setQuotedMessage(null)}>
                    <CloseOutlined />
                  </button>
                </div>
                <div className="quoted-content">
                  {quotedMessage.content.slice(0, 150)}...
                </div>
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
                <PlusMenu onImageUpload={handleImageUpload} onFileUpload={handleFileUpload} onTemplateSelect={handleTemplateSelect} onWebSearch={handleWebSearch} onOpenSkills={onOpenSkills} onOpenProjects={onOpenProjects} onOpenStyle={onOpenStyle} onOpenConnectors={onOpenConnectors} />
                <ModelSelector value={model} onChange={onModelChange} />
              </div>
              <div className="toolbar-right">
                <button
                  className={`tool-btn voice-btn ${isListening ? 'listening' : ''}`}
                  title={isListening ? '点击停止语音' : '点击开始语音输入'}
                  onClick={toggleVoiceMode}
                >
                  {isListening ? <LoadingOutlined /> : <AudioOutlined />}
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
            <div className="export-menu-title">📥 导出格式选择</div>
            <div className="export-menu-item primary" onClick={() => doExport('docx-real')}>
              <FileWordOutlined /> 导出为 DOCX (推荐)
            </div>
            <div className="export-menu-item" onClick={() => doExport('xlsx')}>
              <FileExcelOutlined /> 导出为 XLSX
            </div>
            <div className="export-menu-item" onClick={() => doExport('pptx')}>
              <FilePptOutlined /> 导出为 PPTX
            </div>
            <div className="export-menu-item" onClick={() => doExport('pdf')}>
              <FilePdfOutlined /> 导出为 PDF
            </div>
            <div className="export-menu-divider" />
            <div className="export-menu-item" onClick={() => doExport('md')}>
              <FileMarkdownOutlined /> 导出为 Markdown
            </div>
            <div className="export-menu-item" onClick={() => doExport('json')}>
              <DatabaseOutlined /> 导出为 JSON
            </div>
            <div className="export-menu-item" onClick={() => doExport('csv')}>
              <DownloadOutlined /> 导出为 CSV
            </div>
          </div>
        </div>
      )}
    </div>
  );
}