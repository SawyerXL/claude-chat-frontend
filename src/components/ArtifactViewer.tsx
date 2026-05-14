import { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  CloseOutlined,
  CopyOutlined,
  CheckOutlined,
  FullscreenOutlined,
  CompressOutlined,
  DownloadOutlined,
  CodeOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { Artifact } from '../types';
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

export default function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = language === 'tsx' ? 'tsx' : language === 'python' ? 'py' : 'html';
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = () => {
    // Simple DOCX export using html-docx-js style approach
    const content = artifact.content;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"></head>
      <body>
        <h1>${artifact.title}</h1>
        <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    // Open print dialog for PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${artifact.title}</title>
          <style>
            body { font-family: 'Consolas', monospace; padding: 40px; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
            h1 { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>${artifact.title}</h1>
          <pre>${artifact.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <script>window.print(); window.close();</script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const downloadOptions = [
    { key: 'code', icon: <CodeOutlined />, label: 'Download Code', onClick: handleDownload },
    { key: 'docx', icon: <FileWordOutlined />, label: 'Export as DOC/DOCX', onClick: handleDownloadDocx },
    { key: 'pdf', icon: <FilePdfOutlined />, label: 'Export as PDF', onClick: handleDownloadPdf },
  ];

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const getPreviewHtml = () => {
    if (isReact) {
      // For React, we'll show a simplified preview
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; padding: 16px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${artifact.content}
  </script>
</body>
</html>`;
    }
    if (artifact.type === 'svg') {
      return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
  </style>
</head>
<body>
  ${artifact.content}
</body>
</html>`;
    }
    if (artifact.type === 'html') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 16px; }
  </style>
</head>
<body>
  ${artifact.content}
</body>
</html>`;
    }
    return artifact.content;
  };

  const tabs: { key: 'code' | 'preview'; label: string; show: boolean }[] = [
    { key: 'code', label: 'Code', show: true },
    { key: 'preview', label: 'Preview', show: !isPython && !isReact },
  ];

  return (
    <div className={`artifact-viewer ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="artifact-header">
        <div className="artifact-title">
          <CodeOutlined />
          <span>{artifact.title}</span>
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
          <button
            className={`artifact-action-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark theme"
          >
            🌙
          </button>
          <button
            className={`artifact-action-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light theme"
          >
            ☀️
          </button>
          <button className="artifact-action-btn" onClick={handleCopy} title="Copy code">
            {copied ? <CheckOutlined /> : <CopyOutlined />}
          </button>
          <div className="download-dropdown" style={{ position: 'relative' }}>
            <button
              className="artifact-action-btn"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              title="Download / Export"
            >
              <DownloadOutlined />
              <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
            </button>
            {showDownloadMenu && (
              <div className="download-menu">
                {downloadOptions.map(opt => (
                  <div
                    key={opt.key}
                    className="download-menu-item"
                    onClick={() => {
                      opt.onClick();
                      setShowDownloadMenu(false);
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="artifact-action-btn"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <CompressOutlined /> : <FullscreenOutlined />}
          </button>
          <button className="artifact-action-btn" onClick={onClose} title="Close">
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
              customStyle={{
                margin: 0,
                padding: '16px',
                fontSize: '13px',
                lineHeight: '1.5',
              }}
              codeTagProps={{
                style: {
                  fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                },
              }}
            >
              {artifact.content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div className="preview-container">
            <iframe
              ref={iframeRef}
              srcDoc={getPreviewHtml()}
              sandbox="allow-scripts"
              title="Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
