import { useState, useEffect } from 'react';
import { Modal, Input } from 'antd';
import { SearchIcon, MessageIcon } from './icons/ClaudeIcons';
import type { ChatSession } from '../types';
import { getSessions } from '../services/session';
import '../styles/sidebar.css';
import '../styles/search.css';

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
}

export default function SearchPanel({ open, onClose, onSelectChat }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ session: ChatSession; matchedMessage: string; matchedIndex: number }>>([]);
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
      const matched: Array<{ session: ChatSession; matchedMessage: string; matchedIndex: number }> = [];
      
      for (const session of sessions) {
        // Search in title
        if (session.title.toLowerCase().includes(q)) {
          matched.push({ session, matchedMessage: session.title, matchedIndex: -1 });
          if (matched.length >= 20) break;
        }
        
        // Search in messages
        for (let i = 0; i < session.messages.length; i++) {
          const msg = session.messages[i];
          if ((msg.content || '').toLowerCase().includes(q)) {
            matched.push({ 
              session, 
              matchedMessage: msg.content.slice(0, 150) + (msg.content.length > 150 ? '...' : ''), 
              matchedIndex: i 
            });
            if (matched.length >= 20) break;
          }
        }
        if (matched.length >= 20) break;
      }
      
      setResults(matched);
    } else {
      setResults([]);
    }
  }, [query, sessions]);

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="search-highlight">{part}</mark>
        : part
    );
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchIcon />
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
          prefix={<SearchIcon />}
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
        {results.map((result) => (
          <div
            key={`${result.session.id}-${result.matchedIndex}`}
            className="search-result-item"
            onClick={() => {
              onSelectChat(result.session.id);
              onClose();
            }}
          >
            <div className="search-result-title">
              <MessageIcon />
              <span>{highlightMatch(result.session.title, query)}</span>
              {result.matchedIndex >= 0 && (
                <span className="search-result-badge">消息 #{result.matchedIndex + 1}</span>
              )}
            </div>
            <div className="search-result-preview">
              {highlightMatch(result.matchedMessage, query)}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}