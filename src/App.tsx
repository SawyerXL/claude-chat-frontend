import { useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip, message as antMessage } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  DownOutlined,
  EditOutlined,
  MenuOutlined,
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
import WebSearchPanel from './components/WebSearchPanel';
import LoginDialog from './components/LoginDialog';
// TODO: Enable login before production
// import LoginPage from './components/LoginPage';
import Settings from './components/Settings';
import UsageStatsPanel from './components/UsageStatsPanel';
import TemplatesPanel from './components/TemplatesPanel';
import { canSendMessage, recordMessageSent } from './utils/trialManager';
import SkillPanel from './components/SkillPanel';
import { SKILLS_REGISTRY } from './skills/registry';
import type { ChatMessage, ChatSession } from './types';
import { MODELS } from './constants';
import { sendChatMessageStream } from './services/api';
import { getSessions, getSessionById, saveSession, deleteSession, startSessionSync, subscribeToSessionChanges } from './services/session';
import { isAuthenticated } from './services/auth';
import { initTheme, toggleTheme as toggleThemeService } from './services/theme';
import { onSessionDeleted } from './services/collection';
import type { User } from './services/auth';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from './hooks/useKeyboardShortcuts';
import { usageManager } from './services/usageStats';
import { notificationService } from './services/notifications';
import './App.css';
import './styles/responsive.css';

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
  const [loggedIn, setLoggedIn] = useState(false);
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
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [isReady, setIsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<string>('chats');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [usageStatsOpen, setUsageStatsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize theme and check auth status from backend
  useEffect(() => {
    const savedTheme = initTheme();
    setTheme(savedTheme);

    // Load user from localStorage if exists
    const savedUser = localStorage.getItem('claude_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        if (userData && userData.id) {
          setUser(userData);
          setLoggedIn(true);
        }
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }

    // Check if authenticated
    if (isAuthenticated()) {
      setLoggedIn(true);
    }

    setIsReady(true);
  }, []);

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
      console.log('[refreshSessions] Getting sessions...');
      const list = await getSessions();
      console.log('[refreshSessions] Got', list.length, 'sessions');
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  const refreshSessionsWithCurrent = useCallback(async (currentSessions: ChatSession[]) => {
    try {
      console.log('[refreshSessionsWithCurrent] Getting sessions...');
      const list = await getSessions(currentSessions);
      console.log('[refreshSessionsWithCurrent] Got', list.length, 'sessions');
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    refreshSessions();
  }, [isReady, refreshSessions]);

  // Session sync polling for cross-device and cross-tab sync
  useEffect(() => {
    if (!isReady || !isAuthenticated()) return;

    console.log('[App] Starting session sync...');
    const stopSync = startSessionSync(refreshSessions);

    // Also subscribe to storage events from other tabs
    const unsubscribe = subscribeToSessionChanges(refreshSessions);

    return () => {
      console.log('[App] Stopping session sync...');
      stopSync();
      unsubscribe();
    };
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

      const userId = (() => {
        const userData = localStorage.getItem('claude_user');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            if (user?.id) return 'user_' + user.id;
          } catch {}
        }
        return '';
      })();

      console.log('[persistSession] Saving session:', sessionId, 'userId:', userId, 'messages:', nextMessages.length);

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
        console.log('[persistSession] Session saved, now refreshing...');
        
        // Optimistically update local state to move this session to top
        // Keep the existing session data (messages) from local state
        setSessions(prev => {
          const existing = prev.find(s => s.id === sessionId);
          const updated = existing ? { ...existing, title: session.title, updatedAt: session.updatedAt } : session;
          const others = prev.filter(s => s.id !== sessionId);
          return [updated, ...others];
        });
        
        // Pass current sessions with the new messages to preserve messages during refresh
        const sessionsWithNewMsg = sessions.map(s => 
          s.id === sessionId ? { ...s, title: session.title, updatedAt: session.updatedAt, messages: nextMessages } : s
        );
        await refreshSessionsWithCurrent(sessionsWithNewMsg);
        console.log('[persistSession] Sessions refreshed');
      } catch (err) {
        console.error('[persistSession] Failed to save session:', err);
      }
    },
    [sessions, refreshSessions],
  );

  const handleSend = async (text: string, images?: string[], attachments?: Array<{ name: string; type: string; content: string }>) => {
    // Check trial limits
    const trialCheck = canSendMessage();
    if (!trialCheck.canSend) {
      antMessage.warning(trialCheck.reason || '今日对话次数已用完');
      return;
    }

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

    // Immediately save user message (for session persistence)
    const tempSessionId = sessionId;
    const tempNextMessages = nextMessages;
    const tempModel = model;
    saveSession({
      id: tempSessionId,
      title: text.slice(0, 40),
      messages: tempNextMessages,
      model: tempModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }).catch(err => console.error('[handleSend] Initial save failed:', err));

    // Declare variables outside try block so catch can reference them
    let fullResponse = '';
    let fullThinking = '';

    try {
      const apiModel = MODEL_ID_MAP[model] || 'claude-sonnet-4-6';

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

      // Record message sent for trial tracking
      recordMessageSent();

      // Estimate and record usage stats
      const inputTokens = usageManager.estimateTokens(text);
      const outputTokens = usageManager.estimateTokens(fullResponse);
      usageManager.recordUsage(sessionId, inputTokens, outputTokens, 0, 0, apiModel);

      // Show notification for long responses
      if (fullResponse.length > 500 && notificationService.isEnabled()) {
        notificationService.notifyResponseComplete(model, fullResponse);
      }

      await persistSession(sessionId, [...nextMessages, { ...assistantMsg, content: fullResponse, thinking: fullThinking || undefined }], model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore abort errors (user stopped the request)
      if (msg === 'Aborted' || msg === 'The user aborted the request' || msg.includes('abort')) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant' && !updated[lastIndex].content) {
            updated[lastIndex] = { ...updated[lastIndex], content: '(已停止)' };
          }
          return updated;
        });
        return;
      }
      antMessage.error(`请求失败: ${msg}`);
      
      // Update message with error and save session
      const errorMsg = `请求失败: ${msg}`;
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
          updated[lastIndex] = { ...updated[lastIndex], content: errorMsg };
        }
        return updated;
      });

      // Save session even on error (with error message included)
      const messagesWithError = [...nextMessages, { ...assistantMsg, content: errorMsg, thinking: fullThinking || undefined }];
      await persistSession(sessionId, messagesWithError, model);
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
    console.log('[handleSelectChat] id:', id, 'messages count:', messages.length, 'activeChat:', activeChat);

    if (messages.length > 0 && activeChat) {
      await persistSession(activeChat, messages, model);
    }

    if (id === null) {
      console.log('[handleSelectChat] Creating new chat');
      setActiveChat(null);
      setMessages([]);
      setModel(MODELS[1].id);
    } else {
      // Fetch full session with messages from server
      console.log('[handleSelectChat] Loading session from server:', id);
      const session = await getSessionById(id);
      console.log('[handleSelectChat] Session loaded:', session?.id, 'messages:', session?.messages?.length);
      if (session) {
        console.log('[handleSelectChat] Setting messages:', session.messages?.length);
        setActiveChat(session.id);
        setMessages(session.messages || []);
        setModel(session.model || MODELS[1].id);
      } else {
        console.log('[handleSelectChat] Session not found for id:', id);
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      onSessionDeleted(id); // Clean up collection mapping
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

  // Handle skill activation
  const handleUseSkill = (skillKey: string, promptOrSystemPrompt?: string) => {
    // Find the skill from registry
    const skill = SKILLS_REGISTRY.find(s => s.id === skillKey);
    
    if (skill) {
      // If systemPrompt is provided (for direct activation), use it
      // Otherwise, construct the activation message
      let activationContext: string;
      
      if (promptOrSystemPrompt && !promptOrSystemPrompt.includes('描述你的')) {
        // It's a system prompt
        activationContext = promptOrSystemPrompt;
      } else {
        // It's a user prompt or we need to create activation message
        activationContext = `【技能激活】${skill.icon} ${skill.name}

${skill.systemPrompt}

${promptOrSystemPrompt ? `\n用户需求：${promptOrSystemPrompt}` : ''}

请确认技能已激活，并询问用户具体需求。`;
      }

      // Add as a user message with skill context
      const skillMsg: ChatMessage = {
        id: `skill-${Date.now()}`,
        role: 'user',
        content: activationContext,
        timestamp: Date.now(),
      };

      // Start a new chat with this context or add to existing
      if (messages.length === 0) {
        const newSessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setActiveChat(newSessionId);
        setMessages([skillMsg]);
      } else {
        setMessages(prev => [...prev, skillMsg]);
      }
      
      setModel(MODELS[1].id);
      antMessage.success(`${skill.name} 技能已激活！`);
    } else {
      antMessage.error(`未找到技能: ${skillKey}`);
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

  // 未登录时显示登录对话框
  if (!loggedIn) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <LoginDialog
          open={true}
          onCancel={() => {}}
          onSuccess={() => {
            // Refresh user from localStorage after login
            const savedUser = localStorage.getItem('claude_user');
            if (savedUser) {
              try {
                const userData = JSON.parse(savedUser);
                if (userData && userData.id) {
                  setUser(userData);
                }
              } catch (e) {
                console.error('Failed to parse saved user:', e);
              }
            }
            setLoggedIn(true);
            // Refresh sessions after login
            refreshSessions();
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}
      
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
        activeCollectionId={activeCollectionId}
        onSelectCollection={setActiveCollectionId}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onOpenArtifacts={() => setArtifactsOpen(true)}
        onOpenCode={() => setCodeOpen(true)}
        onOpenCustomize={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onUsePromptTemplate={(content) => {
          // Broadcast via localStorage for cross-tab/cross-component sync
          localStorage.setItem('claude_template_insert', JSON.stringify({ content }));
        }}
        loggedIn={loggedIn}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
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
              <button className="sidebar-toggle-mobile" style={{ display: 'none' }} onClick={() => setSidebarOpen(true)}>
                <MenuOutlined />
              </button>
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
            <Tooltip title="Usage Stats">
              <button className="header-btn" onClick={() => setUsageStatsOpen(true)}>
                <span>📊</span>
              </button>
            </Tooltip>
            <Tooltip title="Templates">
              <button className="header-btn" onClick={() => setTemplatesOpen(true)}>
                <span>📝</span>
              </button>
            </Tooltip>
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
            activeChat={activeChat}
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
            onOpenWebSearch={() => setWebSearchOpen(true)}
            onInsertTemplate={() => {
              // Listen via storage event in ChatView
            }}
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
            onOpenWebSearch={() => setWebSearchOpen(true)}
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
      <SkillPanel 
        open={skillPanelOpen} 
        onClose={() => setSkillPanelOpen(false)} 
        onUseSkill={handleUseSkill}
      />
      <ArtifactsPanel open={artifactsOpen} onClose={() => setArtifactsOpen(false)} />
      <CodePanel open={codeOpen} onClose={() => setCodeOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} onSelectChat={handleSelectChat} />
      <StylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
      <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
      <WebSearchPanel
        open={webSearchOpen}
        onClose={() => setWebSearchOpen(false)}
        onInsertSources={(results) => {
          const citationText = results.map((r, i) =>
            `[${i + 1}] ${r.title}: ${r.url}\n${r.snippet || ''}`
          ).join('\n\n');
          handleSend(`请根据以下搜索结果回答问题：\n\n搜索结果：\n${citationText}\n\n请提供总结和引用来源。`);
        }}
      />
      <UsageStatsPanel open={usageStatsOpen} onClose={() => setUsageStatsOpen(false)} />
      <TemplatesPanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onInsertTemplate={(content) => {
          // Insert template content into input
          const input = document.querySelector('.chat-input-area textarea') as HTMLTextAreaElement;
          if (input) {
            input.value = content;
            input.focus();
          }
        }}
      />
      <LoginDialog
        open={showLogin}
        onCancel={() => setShowLogin(false)}
        onSuccess={() => {
          setLoggedIn(true);
          setShowLogin(false);
          // Refresh sessions after login
          refreshSessions();
        }}
      />
    </div>
  );
}
