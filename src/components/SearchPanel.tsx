import { useState, useEffect } from 'react';
import { Modal, Input } from 'antd';
import { SearchOutlined, MessageOutlined } from '@ant-design/icons';
import type { ChatSession } from '../types';
import { getSessions } from '../services/session';
import '../styles/sidebar.css';

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
}

export default function SearchPanel({ open, onClose, onSelectChat }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatSession[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (open) {
      // Load sessions from server for cross-device sync
      getSessions().then(s => setSessions(s)).catch(() => setSessions([]));
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      const filtered = sessions.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some(m => (m.content || '').toLowerCase().includes(q))
      ).slice(0, 20);
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query, sessions]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchOutlined />
          <span>Search conversations</span>
        </div>
      }
      width={500}
      centered
      className="search-modal"
    >
      <div className="search-input-wrapper">
        <Input
          placeholder="Search messages..."
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="search-results">
        {results.length === 0 && query && (
          <div className="search-empty">No results found</div>
        )}
        {results.length === 0 && !query && (
          <div className="search-empty">Type to search your conversations</div>
        )}
        {results.map((session) => (
          <div
            key={session.id}
            className="search-result-item"
            onClick={() => {
              onSelectChat(session.id);
              onClose();
            }}
          >
            <div className="search-result-title">
              <MessageOutlined />
              <span>{session.title}</span>
            </div>
            <div className="search-result-preview">
              {session.messages.find(m => (m.content || '').toLowerCase().includes(query.toLowerCase()))?.content.slice(0, 100)}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}