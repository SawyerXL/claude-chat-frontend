import { useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip, message as antMessage } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  DownOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import WelcomePage from './components/WelcomePage';
import ChatView from './components/ChatView';
import ShareDialog from './components/ShareDialog';
// TODO: Enable login before production
// import LoginPage from './components/LoginPage';
import Settings from './components/Settings';
import SkillPanel from './components/SkillPanel';
import type { ChatMessage, ChatSession } from './types';
import { MODELS } from './constants';
import { sendChatMessageStream } from './services/api';
import { getSessions, saveSession, deleteSession } from './services/session';
import { isAuthenticated } from './services/auth';
import { initTheme, toggleTheme as toggleThemeService } from './services/theme';
import type { User } from './services/auth';
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [user, setUser] = useState<User | null>(null);
  // TODO: Enable auth before production
  // const [needsAuth, setNeedsAuth] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isReady, setIsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize theme and check auth
  useEffect(() => {
    const savedTheme = initTheme();
    setTheme(savedTheme);

    // Check auth status
    // TODO: Enable auth before production
    // if (isAuthenticated()) {
    //   const currentUser = getCurrentUser();
    //   if (currentUser) {
    //     setUser(currentUser);
    //   }
    //   setIsReady(true);
    // } else {
    //   setNeedsAuth(true);
    //   setIsReady(true);
    // }
    setIsReady(true);
    setUser({ id: 1, email: 'demo@local', username: 'Demo User', role: 'user', balance: 100, concurrency: 5, status: 'active' });
  }, []);

  // Add demo sessions if none exist (for testing)
  useEffect(() => {
    const addDemoSessions = async () => {
      const existing = await getSessions();
      if (existing.length === 0) {
        const now = Date.now();
        const demoSessions: ChatSession[] = [
          {
            id: 'demo-1',
            title: 'Test Chat 1',
            messages: [
              { id: 'd1-1', role: 'user', content: 'Hello, how are you?', timestamp: now - 3600000 },
              { id: 'd1-2', role: 'assistant', content: 'Hello! I\'m doing well, thank you. How can I help you today?', timestamp: now - 3500000 },
            ],
            model: 'sonnet-4-6',
            createdAt: now - 3600000,
            updatedAt: now - 3500000,
          },
          {
            id: 'demo-2',
            title: 'Test Chat 2',
            messages: [
              { id: 'd2-1', role: 'user', content: 'Write a Hello World program in Python', timestamp: now - 7200000 },
              { id: 'd2-2', role: 'assistant', content: '```python\nprint("Hello, World!")\n```', timestamp: now - 7100000 },
            ],
            model: 'sonnet-4-6',
            createdAt: now - 7200000,
            updatedAt: now - 7100000,
          },
        ];
        for (const s of demoSessions) {
          await saveSession(s);
        }
        await refreshSessions();
      }
    };
    if (isReady && isAuthenticated()) {
      addDemoSessions();
    }
  }, [isReady]);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    refreshSessions();
  }, [isReady, refreshSessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleSelectChat(null);
      }
      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        // Toggle sidebar via event or state
      }
      // Ctrl/Cmd + K: Search (placeholder)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        antMessage.info('Search coming soon');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      console.log('[persistSession] Saving session:', session.title, 'messages:', nextMessages.length);
      try {
        await saveSession(session);
        console.log('[persistSession] Session saved successfully');
        await refreshSessions();
        console.log('[persistSession] Sessions refreshed');
      } catch (err) {
        console.error('[persistSession] Failed to save session:', err);
      }
    },
    [sessions, refreshSessions],
  );

  const handleSend = async (text: string, images?: string[], attachments?: Array<{ name: string; type: string; content: string }>) => {
    const sessionId = activeChat ?? generateSessionId();
    if (!activeChat) setActiveChat(sessionId);

    // Build attachments from images and uploaded files
    const allAttachments: Array<{ name: string; type: string; content: string }> = [];

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        allAttachments.push({
          name: `image_${i + 1}.png`,
          type: 'image/png',
          content: images[i],
        });
      }
    }

    if (attachments && attachments.length > 0) {
      allAttachments.push(...attachments);
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Create placeholder for streaming response
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const apiModel = MODEL_ID_MAP[model] || 'claude-sonnet-4-6';

      let fullResponse = '';
      let fullThinking = '';

      // Stream the response with abort signal
      for await (const chunk of sendChatMessageStream(nextMessages, apiModel, abortControllerRef.current.signal)) {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
        } else if (chunk.type === 'thinking') {
          fullThinking += chunk.thinking;
        }
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: fullResponse,
              thinking: fullThinking || undefined
            };
          }
          return updated;
        });
      }

      if (!fullResponse) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = { ...updated[lastIndex], content: '(空响应)' };
          }
          return updated;
        });
      }

      await persistSession(sessionId, [...nextMessages, { ...assistantMsg, content: fullResponse, thinking: fullThinking || undefined }], model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      antMessage.error(`请求失败: ${msg}`);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
          updated[lastIndex] = { ...updated[lastIndex], content: `请求失败: ${msg}` };
        }
        return updated;
      });
      const finalMessages = messages;
      await persistSession(sessionId, [...finalMessages, { ...assistantMsg, content: `请求失败: ${msg}` }], model);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = toggleThemeService();
    setTheme(nextTheme);
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

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteSession(id);
      await refreshSessions();
      if (activeChat === id) {
        setActiveChat(null);
        setMessages([]);
        setModel(MODELS[1].id);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleEditTitle = () => {
    setTitleInput(deriveTitle(messages));
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (activeChat && titleInput.trim()) {
      const newTitle = titleInput.trim();
      const session = sessions.find((s) => s.id === activeChat);
      if (session) {
        const updatedSession: ChatSession = {
          ...session,
          title: newTitle,
          updatedAt: Date.now(),
        };
        try {
          await saveSession(updatedSession);
          await refreshSessions();
        } catch (err) {
          console.error('Failed to update title:', err);
        }
      }
    }
    setEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(false);
    setTitleInput('');
  };

  const hasConversation = messages.length > 0;
  const currentTitle = hasConversation
    ? deriveTitle(messages)
    : activeChat
      ? '仿照claude官网实现项目'
      : 'New chat';

  // Show loading until auth check is complete
  if (!isReady) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Show login page if not authenticated
  // TODO: Enable auth before production
  // if (needsAuth) {
  //   return <LoginPage />;
  // }

  return (
    <div className="app-layout">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        sessions={sessions}
        user={user}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
      />

      <main className="main-content">
        <header className="main-header">
          {editingTitle ? (
            <div className="header-title-edit">
              <input
                type="text"
                className="title-edit-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelEditTitle();
                }}
                autoFocus
              />
              <button className="title-edit-btn save" onClick={handleSaveTitle}>Save</button>
              <button className="title-edit-btn cancel" onClick={handleCancelEditTitle}>Cancel</button>
            </div>
          ) : (
            <div className="header-title" onClick={hasConversation ? handleEditTitle : undefined}>
              <span>{currentTitle}</span>
              {hasConversation && <DownOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} />}
            </div>
          )}
          <div className="header-actions">
            <button className="header-btn header-btn-icon" onClick={() => setSkillPanelOpen(true)} title="Skills (⚡)">
              <span style={{ fontSize: 16 }}>⚡</span>
            </button>
            <button className="header-btn header-btn-icon" onClick={handleToggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <Tooltip title="Star">
              <button className="header-btn" style={{ padding: 7, width: 34 }}>
                <StarOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Settings">
              <button className="header-btn" onClick={() => setSettingsOpen(true)}>
                <EditOutlined />
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
            onEditMessage={(messageId, newContent) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId ? { ...m, content: newContent } : m
                )
              );
            }}
            loading={loading}
            model={model}
            onModelChange={setModel}
            onStop={handleStop}
          />
        ) : (
          <WelcomePage
            onSend={handleSend}
            model={model}
            onModelChange={setModel}
            user={user}
          />
        )}
      </main>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} conversationId={activeChat ?? undefined} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SkillPanel open={skillPanelOpen} onClose={() => setSkillPanelOpen(false)} />
    </div>
  );
}
