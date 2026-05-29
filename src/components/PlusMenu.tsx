import { useRef } from 'react';
import { Dropdown, message as antMessage } from 'antd';
import { PlusIcon, PictureIcon, CameraIcon, FolderIcon, LightningIcon, ApiIcon, GlobeIcon, PaletteIcon, DocumentIcon } from './icons/ClaudeIcons';
import type { MenuProps } from 'antd';

const TEMPLATES = [
  { key: 'meeting', title: '📋 会议纪要', template: '请帮我整理以下会议纪要：\n\n**会议主题：**\n**时间：**\n**参会人员：**\n**讨论要点：**\n1. \n2. \n3. \n\n**待办事项：**\n- [ ] \n\n**下一步计划：**' },
  { key: 'email', title: '✉️ 邮件撰写', template: '请帮我撰写一封邮件：\n\n**收件人：**\n**主题：**\n**邮件目的：**\n\n**语气风格：**（正式/友好/简洁）\n**主要内容包括：**' },
  { key: 'resume', title: '📄 简历优化', template: '请帮我优化简历：\n\n**当前简历内容：**\n```\n\n```\n\n**目标岗位：**\n**期望强调的优势：**' },
  { key: 'code-review', title: '🔍 代码审查', template: '请帮我审查以下代码：\n\n```\n\n```\n\n**重点关注：**\n- 代码逻辑\n- 性能优化\n- 安全漏洞\n- 代码风格' },
  { key: 'summarize', title: '📝 内容总结', template: '请帮我总结以下内容的核心要点：\n\n```\n\n```\n\n**总结维度：**\n- 核心观点\n- 关键数据\n- 行动建议' },
  { key: 'translate', title: '🌐 翻译润色', template: '请帮我翻译并润色以下内容：\n\n**源语言：**\n**目标语言：**\n\n**待翻译内容：**' },
];

interface PlusMenuProps {
  onImageUpload?: (images: string[]) => void;
  onFileUpload?: (files: File[]) => void;
  onTemplateSelect?: (template: string) => void;
  onWebSearch?: (query: string) => void;
  onOpenSkills?: () => void;
  onOpenProjects?: () => void;
  onOpenStyle?: () => void;
  onOpenConnectors?: () => void;
}

export default function PlusMenu({ onImageUpload, onFileUpload, onTemplateSelect, onWebSearch, onOpenSkills, onOpenProjects, onOpenStyle, onOpenConnectors }: PlusMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageUrls: string[] = [];
    const docFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await fileToBase64(file);
          imageUrls.push(base64);
        } catch (err) {
          console.error('Failed to read image:', err);
          antMessage.error(`Failed to read ${file.name}`);
        }
      } else {
        // Non-image files (Word, PDF, etc.)
        docFiles.push(file);
      }
    }

    if (imageUrls.length > 0 && onImageUpload) {
      onImageUpload(imageUrls);
    }

    if (docFiles.length > 0 && onFileUpload) {
      onFileUpload(docFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;

      video.onloadedmetadata = async () => {
        video.width = video.videoWidth;
        video.height = video.videoHeight;
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob(async (blob) => {
            stream.getTracks().forEach(track => track.stop());
            if (blob) {
              const base64 = await blobToBase64(blob);
              if (onImageUpload) {
                onImageUpload([base64]);
              }
            }
          }, 'image/png');
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        antMessage.warning('Screen capture was cancelled');
      } else {
        console.error('Screenshot failed:', err);
        antMessage.error('Failed to capture screenshot');
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const items: MenuProps['items'] = [
    {
      key: 'files',
      icon: <PictureIcon />,
      label: 'Add files (images, Word, PDF)',
      onClick: handleUploadClick,
    },
    {
      key: 'screenshot',
      icon: <CameraIcon />,
      label: 'Take a screenshot',
      onClick: handleScreenshot,
    },
    { type: 'divider' },
    {
      key: 'templates',
      icon: <DocumentIcon />,
      label: 'Quick Templates',
      children: TEMPLATES.map(t => ({
        key: `template-${t.key}`,
        label: t.title,
        onClick: () => {
          if (onTemplateSelect) {
            onTemplateSelect(t.template);
            antMessage.success('Template loaded');
          }
        },
      })),
    },
    { type: 'divider' },
    {
      key: 'websearch',
      icon: <GlobeIcon />,
      label: 'Web search',
      onClick: async () => {
        const query = prompt('Enter search query:');
        if (query && onWebSearch) {
          onWebSearch(query);
        }
      },
    },
    {
      key: 'project',
      icon: <FolderIcon />,
      label: 'Add to project',
      onClick: () => onOpenProjects?.(),
    },
    {
      key: 'skills',
      icon: <LightningIcon />,
      label: 'Skills',
      onClick: () => onOpenSkills?.(),
    },
    {
      key: 'connectors',
      icon: <ApiIcon />,
      label: 'Add connectors',
      onClick: () => onOpenConnectors?.(),
    },
    {
      key: 'style',
      icon: <PaletteIcon />,
      label: 'Use style',
      onClick: () => onOpenStyle?.(),
    },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.xls,.xlsx,.ppt,.pptx"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <Dropdown
        menu={{ items }}
        trigger={['click']}
        placement="topLeft"
      >
        <button className="tool-btn" title="More">
          <PlusIcon />
        </button>
      </Dropdown>
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}