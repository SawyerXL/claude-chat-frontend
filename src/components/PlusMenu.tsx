import { useRef } from 'react';
import { Dropdown, message as antMessage } from 'antd';
import {
  PlusOutlined,
  PictureOutlined,
  CameraOutlined,
  FolderAddOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  GlobalOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

interface PlusMenuProps {
  onImageUpload?: (images: string[]) => void;
  onFileUpload?: (files: File[]) => void;
}

export default function PlusMenu({ onImageUpload, onFileUpload }: PlusMenuProps) {
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
      icon: <PictureOutlined />,
      label: 'Add files (images, Word, PDF)',
      onClick: handleUploadClick,
    },
    {
      key: 'screenshot',
      icon: <CameraOutlined />,
      label: 'Take a screenshot',
      onClick: handleScreenshot,
    },
    { type: 'divider' },
    {
      key: 'project',
      icon: <FolderAddOutlined />,
      label: 'Add to project',
      disabled: true,
    },
    {
      key: 'skills',
      icon: <ThunderboltOutlined />,
      label: 'Skills',
      disabled: true,
    },
    {
      key: 'connectors',
      icon: <ApiOutlined />,
      label: 'Add connectors',
      disabled: true,
    },
    {
      key: 'websearch',
      icon: <GlobalOutlined />,
      label: 'Web search',
      disabled: true,
    },
    {
      key: 'style',
      icon: <BgColorsOutlined />,
      label: 'Use style',
      disabled: true,
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
          <PlusOutlined />
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