import { useState } from 'react';
import { Modal, Button, message as antMessage } from 'antd';
import {
  LockOutlined,
  TeamOutlined,
  LinkOutlined,
  CheckOutlined,
} from '@ant-design/icons';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId?: string;
}

const OPTIONS = [
  {
    key: 'private',
    icon: <LockOutlined />,
    title: 'Keep private',
    desc: 'Only you can see this conversation',
  },
  {
    key: 'team',
    icon: <TeamOutlined />,
    title: 'Share with your team',
    desc: 'Members of your organization can view this chat',
  },
  {
    key: 'public',
    icon: <LinkOutlined />,
    title: 'Create public link',
    desc: 'Anyone with the link can view this conversation',
  },
];

export default function ShareDialog({ open, onClose, conversationId }: ShareDialogProps) {
  const [selected, setSelected] = useState('private');
  const [publicLink, setPublicLink] = useState('');

  const generatePublicLink = () => {
    // Generate a UUID for the conversation
    const uuid = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const link = `${window.location.origin}/shared/${uuid}`;

    // Store the shared conversation in localStorage (simplified version)
    // In production, this would be sent to a backend
    try {
      const sharedConversations = JSON.parse(localStorage.getItem('shared_conversations') || '{}');
      if (conversationId) {
        sharedConversations[uuid] = conversationId;
        localStorage.setItem('shared_conversations', JSON.stringify(sharedConversations));
      }
      setPublicLink(link);
    } catch {
      console.error('Failed to save shared conversation');
    }

    return link;
  };

  const handleCopyLink = async () => {
    const link = publicLink || generatePublicLink();
    try {
      await navigator.clipboard.writeText(link);
      antMessage.success('Link copied to clipboard');
    } catch {
      antMessage.error('Failed to copy link');
    }
  };

  const handleDone = () => {
    if (selected === 'public') {
      handleCopyLink();
    }
    onClose();
  };

  const handleClose = () => {
    setPublicLink('');
    setSelected('private');
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title="Share chat"
      className="share-dialog"
      width={480}
      centered
    >
      <div className="share-options">
        {OPTIONS.map((opt) => (
          <div
            key={opt.key}
            className={`share-option ${selected === opt.key ? 'selected' : ''}`}
            onClick={() => {
              setSelected(opt.key);
              if (opt.key !== 'public') {
                setPublicLink('');
              }
            }}
          >
            <div className="share-option-icon">{opt.icon}</div>
            <div className="share-option-body">
              <div className="share-option-title">{opt.title}</div>
              <div className="share-option-desc">{opt.desc}</div>
            </div>
            {selected === opt.key && (
              <CheckOutlined style={{ color: 'var(--accent)', marginTop: 8 }} />
            )}
          </div>
        ))}
      </div>

      {/* Show generated link */}
      {selected === 'public' && publicLink && (
        <div className="share-link-container">
          <input
            type="text"
            className="share-link-input"
            value={publicLink}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button type="primary" onClick={handleDone}>
          {selected === 'public' ? (publicLink ? 'Copy link' : 'Generate link') : 'Done'}
        </Button>
      </div>
    </Modal>
  );
}
