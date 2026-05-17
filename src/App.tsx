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
import ArtifactsPanel from './components/ArtifactsPanel';
import CodePanel from './components/CodePanel';
import SearchPanel from './components/SearchPanel';
import StylePanel from './components/StylePanel';
import ConnectorsPanel from './components/ConnectorsPanel';
import LoginDialog from './components/LoginDialog';
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
import { getAuthStatus, logout } from './services/login';
import type { User } from './services/auth';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from './hooks/useKeyboardShortcuts';
import './App.css';

const MODEL_ID_MAP: Record<string, string> = {
  'opus-4-7': 'claude-opus-4-7',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022': 'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620': 'claude-3-5-sonnet-20240620',
  'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet-20250219',
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
  // 登录状态（从后端 config.json 初始化）
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [showLogin, setShowLogin] = useState(false);

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
  const [sidebarTab, setSidebarTab] = useState<string>('chats');
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize theme and check auth status from backend
  useEffect(() => {
    const savedTheme = initTheme();
    setTheme(savedTheme);

    // 从后端获取认证状态
    getAuthStatus().then(({ loggedIn: isLoggedIn, username: name }) => {
      setLoggedIn(isLoggedIn);
      setUsername(name);
      setAuthChecked(true);
    });

    // Set demo user for testing (legacy)
    setUser({ id: 1, email: 'demo@local', username: 'Demo User', role: 'user', balance: 100, concurrency: 5, status: 'active' });
    setIsReady(true);
  }, []);

  // 退出登录处理函数
  const handleLogout = async () => {
    const res = await logout();
    if (res.ok) {
      setLoggedIn(false);
      setUsername('');
    } else {
      antMessage.error(res.error || '退出登录失败');
    }
  };

  // Keyboard shortcuts
  const shortcuts = [
    DEFAULT_SHORTCUTS.newChat(() => {
      setActiveChat(null);
      setMessages([]);
      setModel(MODELS[1].id);
    }),
    DEFAULT_SHORTCUTS.clearChat(() => {
      if (messages.length > 0 && confirm('Clear current conversation?')) {
        setMessages([]);
        setActiveChat(null);
      }
    }),
    DEFAULT_SHORTCUTS.toggleSidebar(() => {
      // Toggle is handled by sidebar component
    }),
    DEFAULT_SHORTCUTS.stopGeneration(() => {
      if (loading) {
        abortControllerRef.current?.abort();
      }
    }),
  ];

  useKeyboardShortcuts(shortcuts, isReady);

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

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        const updatedSession: ChatSession = { ...session, title: newTitle, updatedAt: Date.now() };
        await saveSession(updatedSession);
        await refreshSessions();
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const handleBranchChat = async (id: string) => {
    try {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        // Create a new session with same messages (branch)
        const newId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const branchSession: ChatSession = {
          ...session,
          id: newId,
          title: session.title + ' (branch)',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveSession(branchSession);
        await refreshSessions();
        setActiveChat(newId);
        setMessages(branchSession.messages);
      }
    } catch (err) {
      console.error('Failed to branch session:', err);
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
        onRenameChat={handleRenameChat}
        onBranchChat={handleBranchChat}
        sessions={sessions}
        user={user}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onOpenArtifacts={() => setArtifactsOpen(true)}
        onOpenCode={() => setCodeOpen(true)}
        onOpenCustomize={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        loggedIn={loggedIn}
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
            {/* 登录状态相关按钮 */}
            {authChecked ? (
              loggedIn ? (
                <>
                  <span className="header-username">{username}</span>
                  <button
                    className="header-btn"
                    onClick={handleLogout}
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <button className="header-btn" onClick={() => setShowLogin(true)}>
                  登录
                </button>
              )
            ) : null}
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
            loggedIn={loggedIn}
            onRetry={(messageId) => {
              console.log('[App] onRetry called with messageId:', messageId);
              console.log('[App] current messages:', messages.map((m, i) => ({i, role: m.role, content: m.content.substring(0, 30)})));
              // Find the failed message index and get user message
              const idx = messages.findIndex(m => m.id === messageId);
              console.log('[App] found message at index:', idx);
              if (idx > 0 && messages[idx - 1].role === 'user') {
                const userMsg = messages[idx - 1];
                const userContent = userMsg.content;
                const userAttachments = userMsg.attachments;
                console.log('[App] Retrying user message:', userContent.substring(0, 50));
                // Remove all messages from idx-1 onwards (including failed assistant)
                const truncatedMessages = messages.slice(0, idx - 1);
                console.log('[App] Truncating messages, new count:', truncatedMessages.length);
                setMessages(truncatedMessages);
                // Now send the user message again
                handleSend(userContent, [], userAttachments as any);
              }
            }}
            onOpenSkills={() => setSkillPanelOpen(true)}
            onOpenProjects={() => setSidebarTab('projects')}
            onOpenStyle={() => setStyleOpen(true)}
            onOpenConnectors={() => setConnectorsOpen(true)}
          />
        ) : (
          <WelcomePage
            onSend={handleSend}
            model={model}
            onModelChange={setModel}
            user={user}
            onOpenSkills={() => setSkillPanelOpen(true)}
            onOpenProjects={() => setSidebarTab('projects')}
            onOpenStyle={() => setStyleOpen(true)}
            onOpenConnectors={() => setConnectorsOpen(true)}
          />
        )}
      </main>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        conversationId={activeChat ?? undefined}
        session={sessions.find(s => s.id === activeChat)}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} onThemeChange={(theme) => { setTheme(theme); document.documentElement.setAttribute('data-theme', theme); }} />
      <SkillPanel open={skillPanelOpen} onClose={() => setSkillPanelOpen(false)} />
      <ArtifactsPanel open={artifactsOpen} onClose={() => setArtifactsOpen(false)} />
      <CodePanel open={codeOpen} onClose={() => setCodeOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} onSelectChat={handleSelectChat} />
      <StylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
      <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
      <LoginDialog
        open={showLogin}
        onCancel={() => setShowLogin(false)}
        onSuccess={(name) => {
          setLoggedIn(true);
          setUsername(name);
          setShowLogin(false);
        }}
      />
    </div>
  );
}
