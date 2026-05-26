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
import './ArtifactViewer.css';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';

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
  'table': 'plaintext',
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

function downloadFile(buffer: ArrayBuffer | Uint8Array | string, filename: string, mimeType: string) {
  let bytes: Uint8Array;

  if (typeof buffer === 'string') {
    // Base64 string
    const binary = atob(buffer);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else {
    bytes = buffer;
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
  const isTable = artifact.type === 'table';

  // Parse table data (Tab-separated or comma-separated)
  const parseTableData = (content: string): { headers: string[]; rows: string[][] } => {
    const lines = content.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    let rows = lines.map(line => {
      if (line.includes('\t')) return line.split('\t').map(c => c.trim());
      if (line.includes(',')) return line.split(',').map(c => c.trim());
      return [line.trim()];
    });

    const headers = rows[0] || [];
    const dataRows = rows.slice(1);
    return { headers, rows: dataRows };
  };

  const { headers, rows } = isTable ? parseTableData(artifact.content) : { headers: [], rows: [] };

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
      const filename = `${artifact.title.replace(/\s+/g, '_')}.${option.format}`;

      switch (option.format) {
        case 'xlsx': {
          // Parse content into rows
          let rows: string[][];
          if (content.includes('\t')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split('\t').map(c => c.trim()));
          } else if (content.includes(',')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()));
          } else {
            rows = content.split('\n').filter(r => r.trim()).map(r => [r.trim()]);
          }

          if (rows.length === 0) {
            antMessage.error('没有可生成的内容');
            return;
          }

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(rows);

          // Set column widths based on content
          const colWidths: { wch: number }[] = [];
          for (let i = 0; i < rows[0].length; i++) {
            let maxLen = rows[0][i]?.length || 10;
            for (const row of rows) {
              if (row[i] && row[i].length > maxLen) {
                maxLen = Math.min(row[i].length, 50);
              }
            }
            colWidths.push({ wch: Math.max(maxLen + 2, 8) });
          }
          ws['!cols'] = colWidths;

          // Style the worksheet
          const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

          // Apply styles to header row
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
            if (cell) {
              cell.s = {
                font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
                fill: { fgColor: { rgb: '1E6091' }, patternType: 'solid' },
                alignment: { horizontal: 'center', vertical: 'center', wrap_text: true },
                border: {
                  top: { style: 'thin', color: { rgb: '1B3A6B' } },
                  bottom: { style: 'thin', color: { rgb: '1B3A6B' } },
                  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                  right: { style: 'thin', color: { rgb: 'CCCCCC' } },
                },
              };
            }
          }

          // Apply styles to data rows
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const isEvenRow = (row - 1) % 2 === 0;
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
              if (cell) {
                cell.s = {
                  font: { sz: 11 },
                  fill: { fgColor: { rgb: isEvenRow ? 'E8F4FD' : 'FFFFFF' }, patternType: 'solid' },
                  alignment: { horizontal: 'left', vertical: 'center', wrap_text: true },
                  border: {
                    top: { style: 'thin', color: { rgb: 'DDDDDD' } },
                    bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
                    left: { style: 'thin', color: { rgb: 'DDDDDD' } },
                    right: { style: 'thin', color: { rgb: 'DDDDDD' } },
                  },
                };
              }
            }
          }

          // Set row height for header
          ws['!rows'] = [{ hpt: 25 }];

          XLSX.utils.book_append_sheet(wb, ws, artifact.title.slice(0, 31) || '数据');

          const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
          downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;
        }

        case 'docx': {
          const lines = content.split('\n').filter(l => l.trim());
          const headers = lines[0]?.split('\t') || [];
          const dataRows = lines.slice(1);

          // Parse table data
          const tableData = dataRows.map(row => {
            return row.split('\t').map(cell => cell.trim());
          });

          // Create professional Word document
          const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ShadingType } = await import('docx');

          // Table header row
          const headerRow = new TableRow({
            children: headers.map(h => new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', font: 'Arial' })],
                alignment: AlignmentType.CENTER,
              })],
              shading: { fill: '1E6091', type: ShadingType.CLEAR },
              width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            })),
          });

          // Data rows
          const dataTableRows = tableData.map((row, idx) => {
            const isEven = idx % 2 === 0;
            return new TableRow({
              children: row.map(cell => new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cell || '', font: 'Arial', size: 22 })],
                  alignment: AlignmentType.LEFT,
                })],
                shading: { fill: isEven ? 'E8F4FD' : 'FFFFFF', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
              })),
            });
          });

          const doc = new Document({
            sections: [{
              properties: {
                page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
              },
              children: [
                // Title
                new Paragraph({
                  children: [
                    new TextRun({
                      text: artifact.title || '数据文档',
                      heading: HeadingLevel.TITLE,
                      font: 'Arial',
                      size: 48,
                      bold: true,
                      color: '1B3A6B',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                }),
                // Subtitle
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
                      font: 'Arial',
                      size: 20,
                      color: '666666',
                      italics: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 400 },
                }),
                // Table
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [headerRow, ...dataTableRows],
                }),
              ],
            }],
          });

          const buffer = await Packer.toBuffer(doc);
          downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          break;
        }

        case 'pptx': {
          // Parse content into rows
          let rows: string[][];
          if (content.includes('\t')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split('\t').map(c => c.trim()));
          } else if (content.includes(',')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()));
          } else {
            rows = content.split('\n').filter(r => r.trim()).map(r => [r.trim()]);
          }

          if (rows.length === 0) {
            antMessage.error('没有可生成的内容');
            return;
          }

          const pptx = new pptxgen();
          pptx.title = artifact.title || '数据演示文稿';
          pptx.author = 'Claude Chat';
          pptx.subject = artifact.title || 'Generated Data';

          // Title slide
          const titleSlide = pptx.addSlide();
          titleSlide.addText(artifact.title || '数据演示文稿', {
            x: 0.5, y: 2, w: 9, h: 1.5,
            fontSize: 44, fontFace: 'Arial', bold: true,
            color: '1E6091', align: 'center',
          });
          titleSlide.addText(`生成时间: ${new Date().toLocaleString('zh-CN')}`, {
            x: 0.5, y: 3.8, w: 9, h: 0.5,
            fontSize: 16, fontFace: 'Arial',
            color: '666666', align: 'center',
          });

          // Table slide
          const tableSlide = pptx.addSlide();
          tableSlide.addText(artifact.title || '数据表格', {
            x: 0.5, y: 0.3, w: 9, h: 0.7,
            fontSize: 28, fontFace: 'Arial', bold: true,
            color: '1B3A6B',
          });

          // Style for table
          const tableRows = rows.map((row, rowIdx) => {
            return row.map((cell, colIdx) => ({
              text: cell,
              options: {
                fill: rowIdx === 0 ? '1E6091' : (rowIdx % 2 === 1 ? 'E8F4FD' : 'FFFFFF'),
                color: rowIdx === 0 ? 'FFFFFF' : '333333',
                bold: rowIdx === 0,
                fontFace: 'Arial',
                fontSize: 12,
                align: 'left',
                valign: 'middle',
              },
            }));
          });

          tableSlide.addTable(tableRows, {
            x: 0.5, y: 1.2, w: 9, h: 5.5,
            border: { pt: 0.5, color: 'CCCCCC' },
            colW: rows[0].map((_, i) => 9 / rows[0].length),
          });

          const pptxBuffer = await pptx.writeFile({ fileName: 'temp.pptx' }) as ArrayBuffer;
          downloadFile(pptxBuffer, filename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          break;
        }

        case 'pdf': {
          // Parse content into rows
          let rows: string[][];
          if (content.includes('\t')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split('\t').map(c => c.trim()));
          } else if (content.includes(',')) {
            rows = content.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()));
          } else {
            rows = content.split('\n').filter(r => r.trim()).map(r => [r.trim()]);
          }

          if (rows.length === 0) {
            antMessage.error('没有可生成的内容');
            return;
          }

          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();

          // Title
          doc.setFontSize(24);
          doc.setTextColor(30, 96, 145); // #1E6091
          doc.setFont('helvetica', 'bold');
          doc.text(artifact.title || '数据文档', pageWidth / 2, 20, { align: 'center' });

          // Subtitle
          doc.setFontSize(10);
          doc.setTextColor(102, 102, 102);
          doc.setFont('helvetica', 'normal');
          doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, 28, { align: 'center' });

          // Table
          const startY = 40;
          const colCount = rows[0].length;
          const colWidth = (pageWidth - 20) / colCount;
          const rowHeight = 10;

          // Header
          doc.setFillColor(30, 96, 145); // #1E6091
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);

          rows[0].forEach((cell, i) => {
            doc.rect(10 + i * colWidth, startY, colWidth, rowHeight, 'F');
            doc.text(String(cell).substring(0, 20), 10 + i * colWidth + 2, startY + 7);
          });

          // Data rows
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);

          rows.slice(1).forEach((row, rowIdx) => {
            const y = startY + (rowIdx + 1) * rowHeight;
            const fillColor = rowIdx % 2 === 0 ? [232, 244, 253] : [255, 255, 255]; // #E8F4FD or white
            doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
            doc.setTextColor(51, 51, 51);

            row.forEach((cell, i) => {
              doc.rect(10 + i * colWidth, y, colWidth, rowHeight, 'F');
              doc.text(String(cell).substring(0, 25), 10 + i * colWidth + 2, y + 7);
            });
          });

          const pdfBuffer = doc.output('arraybuffer');
          downloadFile(pdfBuffer, filename, 'application/pdf');
          break;
        }

        default:
          antMessage.error('不支持的格式');
      }

      antMessage.success(`${option.label} 生成成功！`);
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
    { key: 'preview', label: 'Preview', show: !isPython && !isReact && !isTable },
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
        {isTable && headers.length > 0 ? (
          <div className="table-container" style={{ padding: '16px', overflow: 'auto', height: '100%' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
              <thead>
                <tr>
                  {headers.map((header, i) => (
                    <th key={i} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
                      borderBottom: '2px solid ' + (theme === 'dark' ? '#444' : '#ddd'),
                      fontWeight: '600',
                      color: theme === 'dark' ? '#fff' : '#333',
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid ' + (theme === 'dark' ? '#333' : '#eee'),
                        color: theme === 'dark' ? '#ccc' : '#333',
                      }}>
                        {cell || '\u00A0'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'code' ? (
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