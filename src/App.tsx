import { useState, useEffect, useCallback } from 'react';
import { Tooltip, message as antMessage } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  DownOutlined,
} from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import WelcomePage from './components/WelcomePage';
import ChatView from './components/ChatView';
import ShareDialog from './components/ShareDialog';
import type { ChatMessage, ChatSession } from './types';
import { MODELS } from './constants';
import { sendChatMessage } from './services/api';
import { getSessions, saveSession } from './services/session';
import './App.css';

const MODEL_ID_MAP: Record<string, string> = {
  'opus-4-7': 'claude-opus-4-7',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'haiku-4-5': 'claude-haiku-4-5-20251001',
};

function generateSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  return firstUser.content.slice(0, 40);
}

export default function App() {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(MODELS[1].id);
  const [shareOpen, setShareOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const persistSession = useCallback(
    async (sessionId: string, nextMessages: ChatMessage[], sessionModel: string) => {
      if (nextMessages.length === 0) return;
      const existing = sessions.find((s) => s.id === sessionId);
      const now = Date.now();
      const session: ChatSession = {
        id: sessionId,
        title: deriveTitle(nextMessages),
        messages: nextMessages,
        model: sessionModel,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      try {
        await saveSession(session);
        await refreshSessions();
      } catch (err) {
        console.error('Failed to save session:', err);
      }
    },
    [sessions, refreshSessions],
  );

  const handleSend = async (text: string) => {
    const sessionId = activeChat ?? generateSessionId();
    if (!activeChat) setActiveChat(sessionId);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const apiModel = MODEL_ID_MAP[model] || 'claude-sonnet-4-6';
      const reply = await sendChatMessage(nextMessages, apiModel);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply || '(空响应)',
        timestamp: Date.now(),
      };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      await persistSession(sessionId, finalMessages, model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      antMessage.error(`请求失败: ${msg}`);
      const errorMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `请求失败: ${msg}`,
        timestamp: Date.now(),
      };
      const finalMessages = [...nextMessages, errorMsg];
      setMessages(finalMessages);
      await persistSession(sessionId, finalMessages, model);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = async (id: string | null) => {
    if (messages.length > 0 && activeChat) {
      await persistSession(activeChat, messages, model);
    }

    if (id === null) {
      setActiveChat(null);
      setMessages([]);
      setModel(MODELS[1].id);
    } else {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setActiveChat(session.id);
        setMessages(session.messages);
        setModel(session.model);
      }
    }
  };

  const hasConversation = messages.length > 0;
  const currentTitle = hasConversation
    ? deriveTitle(messages)
    : activeChat
      ? '仿照claude官网实现项目'
      : 'New chat';

  return (
    <div className="app-layout">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        sessions={sessions}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="header-title">
            <span>{currentTitle}</span>
            <DownOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} />
          </div>
          <div className="header-actions">
            <Tooltip title="Star">
              <button className="header-btn" style={{ padding: 7, width: 34 }}>
                <StarOutlined />
              </button>
            </Tooltip>
            <button
              className="header-btn"
              onClick={() => setShareOpen(true)}
            >
              <ShareAltOutlined />
              <span>Share</span>
            </button>
          </div>
        </header>

        {hasConversation ? (
          <ChatView
            messages={messages}
            onSend={handleSend}
            loading={loading}
            model={model}
            onModelChange={setModel}
          />
        ) : (
          <WelcomePage
            onSend={handleSend}
            model={model}
            onModelChange={setModel}
          />
        )}
      </main>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
