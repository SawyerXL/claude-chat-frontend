import { useState } from 'react';
import { Modal, Button, message, Tabs, Input, Space } from 'antd';
import { LockIcon, TeamIcon, LinkIcon, CheckIcon, CopyIcon, DownloadIcon, QrcodeIcon, ShareIcon } from './icons/ClaudeIcons';
import type { ChatSession } from '../types';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId?: string;
  session?: ChatSession;
}

type ShareOption = 'private' | 'team' | 'public';

export default function ShareDialog({ open, onClose, conversationId: _conversationId, session }: ShareDialogProps) {
  const [selected, setSelected] = useState<ShareOption>('private');
  const [publicLink, setPublicLink] = useState('');
  const [exportFormat, setExportFormat] = useState<string>('json');

  const generateShareId = () => {
    return `share_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const generatePublicLink = () => {
    const shareId = generateShareId();
    const link = `${window.location.origin}/shared/${shareId}`;

    // Save to localStorage
    if (session) {
      const shared = JSON.parse(localStorage.getItem('claude_shared_sessions') || '{}');
      shared[shareId] = {
        session,
        createdAt: Date.now(),
      };
      localStorage.setItem('claude_shared_sessions', JSON.stringify(shared));
    }

    setPublicLink(link);
    return link;
  };

  const handleCopyLink = async () => {
    const link = publicLink || generatePublicLink();
    try {
      await navigator.clipboard.writeText(link);
      message.success('链接已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const handleCopyMarkdown = async () => {
    if (!session) return;
    const md = generateMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      message.success('Markdown 已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const handleDownload = () => {
    if (!session) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (exportFormat === 'json') {
      content = JSON.stringify(session, null, 2);
      filename = `${session.title}.json`;
      mimeType = 'application/json';
    } else if (exportFormat === 'markdown') {
      content = generateMarkdown();
      filename = `${session.title}.md`;
      mimeType = 'text/markdown';
    } else {
      content = generatePlainText();
      filename = `${session.title}.txt`;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    message.success('下载成功');
  };

  const generateMarkdown = (): string => {
    if (!session) return '';
    let md = `# ${session.title}\n\n`;
    md += `**Model:** ${session.model}\n`;
    md += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n\n---\n\n`;

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '**User**' : '**Assistant**';
      md += `## ${role}\n\n${msg.content}\n\n---\n\n`;
    }

    return md;
  };

  const generatePlainText = (): string => {
    if (!session) return '';
    let text = `${session.title}\n${'='.repeat(40)}\n\n`;
    for (const msg of session.messages) {
      text += `[${msg.role.toUpperCase()}]\n${msg.content}\n\n`;
    }
    return text;
  };

  const handleShareNative = async () => {
    if (!session) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: session.title,
          text: session.messages[0]?.content.slice(0, 100) || '',
          url: window.location.href,
        });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          message.error('分享失败');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleClose = () => {
    setPublicLink('');
    setSelected('private');
    onClose();
  };

  const shareOptions = [
    { key: 'private', icon: <LockIcon />, title: '保持私密', desc: '只有你可以查看此对话' },
    { key: 'team', icon: <TeamIcon />, title: '团队分享', desc: '团队成员可以查看' },
    { key: 'public', icon: <LinkIcon />, title: '公开链接', desc: '生成可分享的链接' },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={<span><ShareIcon style={{ marginRight: 8 }} />分享对话</span>}
      width={520}
      centered
    >
      <Tabs
        defaultActiveKey="share"
        items={[
          {
            key: 'share',
            label: '分享',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  {shareOptions.map(opt => (
                    <div
                      key={opt.key}
                      onClick={() => { setSelected(opt.key as ShareOption); if (opt.key !== 'public') setPublicLink(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 12,
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        marginBottom: 8,
                        cursor: 'pointer',
                        background: selected === opt.key ? 'var(--bg-hover)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 18, marginRight: 12, color: selected === opt.key ? 'var(--accent)' : undefined }}>
                        {opt.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{opt.desc}</div>
                      </div>
                      {selected === opt.key && <CheckIcon style={{ color: 'var(--accent)' }} />}
                    </div>
                  ))}
                </div>

                {selected === 'public' && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    {publicLink ? (
                      <>
                        <Input.Search
                          value={publicLink}
                          readOnly
                          onSearch={handleCopyLink}
                          enterButton={<CopyIcon />}
                        />
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          <Button icon={<QrcodeIcon />} onClick={() => message.info('二维码功能开发中')}>生成二维码</Button>
                          <Button icon={<ShareIcon />} onClick={handleShareNative}>分享</Button>
                        </div>
                      </>
                    ) : (
                      <Button type="primary" block onClick={generatePublicLink}>
                        生成公开链接
                      </Button>
                    )}
                  </div>
                )}

                {selected !== 'public' && (
                  <Button type="primary" block onClick={handleShareNative} icon={<ShareIcon />}>
                    分享
                  </Button>
                )}
              </div>
            ),
          },
          {
            key: 'export',
            label: '导出',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>导出格式</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'json', label: 'JSON' },
                      { key: 'markdown', label: 'Markdown' },
                      { key: 'text', label: '纯文本' },
                    ].map(f => (
                      <Button
                        key={f.key}
                        type={exportFormat === f.key ? 'primary' : 'default'}
                        onClick={() => setExportFormat(f.key)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {session && (
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{session.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {session.messages.length} 条消息 • {session.model}
                    </div>
                  </div>
                )}

                <Space>
                  <Button icon={<CopyIcon />} onClick={handleCopyMarkdown}>复制 Markdown</Button>
                  <Button type="primary" icon={<DownloadIcon />} onClick={handleDownload}>下载文件</Button>
                </Space>
              </div>
            ),
          },
        ]}
      />

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button onClick={handleClose}>关闭</Button>
      </div>
    </Modal>
  );
}