import { useState, useEffect } from 'react';
import { Modal } from 'antd';
import { CodeIcon } from './icons/ClaudeIcons';
import type { ChatSession } from '../types';
import { getSessions } from '../services/session';
import '../styles/sidebar.css';

interface CodePanelProps {
  open: boolean;
  onClose: () => void;
}

export default function CodePanel({ open, onClose }: CodePanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (open) {
      // Load sessions from server for cross-device sync
      getSessions().then(all => {
        const codeSessions = all.filter(s =>
          s.messages.some(m => (m.content || '').includes('```'))
        );
        setSessions(codeSessions);
      }).catch(() => setSessions([]));
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeIcon />
          <span>Code</span>
        </div>
      }
      width={600}
      centered
      className="code-modal"
    >
      <div className="code-list">
        {sessions.length === 0 ? (
          <div className="code-empty">
            <p>No code sessions found.</p>
            <p>Code snippets from your conversations will appear here.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="code-item">
              <div className="code-item-title">{session.title}</div>
              <div className="code-item-meta">
                {session.messages.length} messages • {session.model}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}