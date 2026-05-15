import { useState, useEffect, useRef } from 'react';
import { message as antMessage } from 'antd';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  CloseOutlined,
  CopyOutlined,
  CheckOutlined,
  FullscreenOutlined,
  CompressOutlined,
  CodeOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  DownOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  BgColorsOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { Artifact } from '../types';
import { executeSandbox } from '../services/session';
import './ArtifactViewer.css';

interface ArtifactViewerProps {
  artifact: Artifact;
  onClose: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  'react': 'tsx',
  'html': 'html',
  'svg': 'xml',
  'python': 'python',
  'html-react': 'tsx',
  '_generative': 'javascript',
  'notebook': 'python',
};

interface GenerationOption {
  format: 'docx' | 'xlsx' | 'pptx' | 'pdf';
  label: string;
  icon: React.ReactNode;
  description: string;
  generateCode: (content: string) => string;
}

const GENERATION_OPTIONS: GenerationOption[] = [
  {
    format: 'docx',
    label: 'Word 文档',
    icon: <FileWordOutlined />,
    description: '生成 .docx 格式的 Word 文档',
    generateCode: (content) => `
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
const lines = ${JSON.stringify(content)}.split('\\n');
const children = [
  new Paragraph({ children: [new TextRun({ text: "Generated Document", heading: HeadingLevel.HEADING_1 })] }),
  new Paragraph({ children: [new TextRun({ text: "Generated at ${new Date().toLocaleString('zh-CN')}", color: "888888" })] }),
  new Paragraph({ children: [new TextRun("")] }),
  ...lines.map(line => new Paragraph({ children: [new TextRun(line || " ")] }))
];
const doc = new Document({ sections: [{ properties: {}, children }] });
sandbox.result = await Packer.toBuffer(doc);
`.trim(),
  },
  {
    format: 'xlsx',
    label: 'Excel 表格',
    icon: <FileExcelOutlined />,
    description: '生成 .xlsx 格式的 Excel 表格',
    generateCode: (content) => `
const raw = ${JSON.stringify(content)};
let rows;
if (raw.includes('\\t')) {
  rows = raw.split('\\n').filter(r => r.trim()).map(r => r.split('\\t').map(c => c.trim()));
} else if (raw.includes(',')) {
  rows = raw.split('\\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()));
} else {
  rows = raw.split('\\n').filter(r => r.trim()).map(r => [r.trim()]);
}
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "Data");
sandbox.result = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
`.trim(),
  },
  {
    format: 'pptx',
    label: 'PPT 演示文稿',
    icon: <FilePptOutlined />,
    description: '生成 .pptx 格式的 PowerPoint 演示文稿',
    generateCode: (content) => `
const p = new pptxgen();
p.title = "Generated Presentation";
p.addSlide().addText(${JSON.stringify(content)}, {
  x: 0.5, y: 0.5, w: 9.5, h: 6.8,
  fontSize: 14, fontFace: "Arial", valign: "top"
});
await p.writeFile("output.pptx");
`.trim(),
  },
  {
    format: 'pdf',
    label: 'PDF 文档',
    icon: <FilePdfOutlined />,
    description: '生成 .pdf 格式的 PDF 文档',
    generateCode: (content) => `
const p = new pptxgen();
p.addSlide().addText(${JSON.stringify(content)}, {
  x: 0.5, y: 0.5, w: 9.5, h: 6.8,
  fontSize: 11, fontFace: "SimSun", valign: "top"
});
await p.writeFile("output.pdf");
`.trim(),
  },
];

function downloadFile(buffer: string, filename: string, mimeType: string) {
  const binary = atob(buffer);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [generating, setGenerating] = useState<string | null>(null);

  const language = LANGUAGE_MAP[artifact.type] || 'javascript';
  const isReact = artifact.type === 'react' || artifact.type === 'html-react';
  const isPython = artifact.type === 'python';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.code || artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const ext = language === 'tsx' ? 'tsx' : language === 'python' ? 'py' : 'html';
    const blob = new Blob([artifact.code || artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async (option: GenerationOption) => {
    const content = artifact.code || artifact.content;
    if (!content || !content.trim()) {
      antMessage.error('没有可生成的内容');
      return;
    }
    setGenerating(option.format);

    try {
      const code = option.generateCode(content);
      const result = await executeSandbox(code, option.format, `${artifact.title.replace(/\s+/g, '_')}.${option.format}`);
      if (result) {
        downloadFile(result.buffer, result.filename, result.mimeType);
        antMessage.success(`${option.label} 生成成功！`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      antMessage.error(`生成失败: ${msg}`);
    } finally {
      setGenerating(null);
    }
  };

  const getPreviewHtml = () => {
    if (isReact) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, sans-serif; padding: 16px; }</style>
</head>
<body><div id="root"></div><script type="text/babel">${artifact.code || artifact.content}</script></body>
</html>`;
    }
    if (artifact.type === 'svg') {
      return `<!DOCTYPE html><html><head><style>body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }</style></head><body>${artifact.code || artifact.content}</body></html>`;
    }
    if (artifact.type === 'html') {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { padding: 16px; }</style></head><body>${artifact.code || artifact.content}</body></html>`;
    }
    return artifact.code || artifact.content;
  };

  const tabs: { key: 'code' | 'preview'; label: string; show: boolean }[] = [
    { key: 'code', label: 'Code', show: true },
    { key: 'preview', label: 'Preview', show: !isPython && !isReact },
  ];

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const editAreaRef = useRef<HTMLDivElement>(null);

  // Canvas editing functions
  const saveToHistory = (content: string) => {
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(content);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undoCanvas = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
    }
  };

  const handleCanvasEdit = () => {
    if (!canvasMode) return;
    saveToHistory(getPreviewHtml());
  };

  const downloadMenuItems = [
    { key: 'code', icon: <CodeOutlined />, label: '下载代码', onClick: handleDownloadCode },
    ...GENERATION_OPTIONS.map(opt => ({
      key: opt.format,
      icon: opt.icon,
      label: opt.label,
      onClick: () => { handleGenerate(opt); setShowDownloadMenu(false); },
      loading: generating === opt.format,
    })),
  ];

  return (
    <div className={`artifact-viewer ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="artifact-header">
        <div className="artifact-title">
          <CodeOutlined />
          <span>{artifact.title}</span>
          <span className="artifact-type-tag">{artifact.type.toUpperCase()}</span>
        </div>
        <div className="artifact-tabs">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              className={`artifact-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="artifact-actions">
          <button className={`artifact-action-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="深色主题">🌙</button>
          <button className={`artifact-action-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="浅色主题">☀️</button>
          {!isPython && (
            <button
              className={`artifact-action-btn ${canvasMode ? 'active' : ''}`}
              onClick={() => setCanvasMode(!canvasMode)}
              title={canvasMode ? 'Exit Canvas Mode' : 'Canvas Mode'}
            >
              <BgColorsOutlined />
            </button>
          )}
          {canvasMode && (
            <>
              <button className="artifact-action-btn" onClick={undoCanvas} title="Undo" disabled={historyIndex <= 0}>
                <ClearOutlined />
              </button>
              <button className="artifact-action-btn" onClick={handleCanvasEdit} title="Save State">
                <span>💾</span>
              </button>
            </>
          )}
          <button className="artifact-action-btn" onClick={handleCopy} title="复制代码">
            {copied ? <CheckOutlined /> : <CopyOutlined />}
          </button>
          <div className="download-dropdown">
            <button
              className="artifact-action-btn primary"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              title="生成文件"
            >
              {generating ? <LoadingOutlined /> : <PlayCircleOutlined />}
              <span>生成文件</span>
              <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
            </button>
            {showDownloadMenu && (
              <div className="download-menu">
                {downloadMenuItems.map(item => (
                  <div key={item.key} className="download-menu-item" onClick={item.onClick as any}>
                    {(item as any).loading ? <LoadingOutlined /> : item.icon}
                    <span>{(item as any).loading ? '生成中...' : item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="artifact-action-btn" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? '退出全屏' : '全屏'}>
            {fullscreen ? <CompressOutlined /> : <FullscreenOutlined />}
          </button>
          <button className="artifact-action-btn" onClick={onClose} title="关闭">
            <CloseOutlined />
          </button>
        </div>
      </div>

      <div className="artifact-content">
        {activeTab === 'code' ? (
          <div className="code-container">
            <SyntaxHighlighter
              language={language}
              style={theme === 'dark' ? vscDarkPlus : oneLight}
              showLineNumbers
              customStyle={{ margin: 0, padding: '16px', fontSize: '13px', lineHeight: '1.5' }}
              codeTagProps={{ style: { fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace" } }}
            >
              {artifact.code || artifact.content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div className={`preview-container ${canvasMode ? 'canvas-mode' : ''}`} ref={editAreaRef} onClick={handleCanvasEdit}>
            <iframe srcDoc={getPreviewHtml()} sandbox="allow-scripts allow-same-origin" title="Preview" />
          </div>
        )}
      </div>
    </div>
  );
}