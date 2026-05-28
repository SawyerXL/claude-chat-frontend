import { useState } from 'react';
import {
  EditOutlined,
  SearchOutlined,
  MessageOutlined,
  FolderOutlined,
  AppstoreOutlined,
  CodeOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  LeftOutlined,
  BulbOutlined,
  StarOutlined,
  SwapOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Tooltip, Dropdown, type MenuProps, Modal, Input } from 'antd';
import type { ChatSession } from '../types';
import type { User } from '../services/auth';
import { logout } from '../services/auth';
import ProjectsPanel from './ProjectsPanel';
import MemoryPanel from './MemoryPanel';
import PromptTemplatesPanel from './PromptTemplatesPanel';
import '../styles/sidebar.css';

interface SidebarProps {
  activeChat: string | null;
  onSelectChat: (id: string | null) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onBranchChat?: (id: string) => void;
  sessions: ChatSession[];
  user?: User | null;
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenArtifacts?: () => void;
  onOpenCode?: () => void;
  onOpenCustomize?: () => void;
  onOpenMemory?: () => void;
  onUsePromptTemplate?: (content: string) => void;
  loggedIn?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV_ITEMS = [
  { key: 'search', icon: <SearchOutlined />, label: 'Search' },
  { key: 'chats', icon: <MessageOutlined />, label: 'Chats' },
  { key: 'projects', icon: <FolderOutlined />, label: 'Projects' },
  { key: 'templates', icon: <FileTextOutlined />, label: 'Templates' },
  { key: 'memory', icon: <BulbOutlined />, label: 'Memory' },
  { key: 'artifacts', icon: <AppstoreOutlined />, label: 'Artifacts' },
  { key: 'code', icon: <CodeOutlined />, label: 'Code' },
  { key: 'customize', icon: <SettingOutlined />, label: 'Customize' },
];

// Group conversations by time
function groupConversations(sessions: ChatSession[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const prev7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    const age = now - session.updatedAt;
    if (age < day) {
      today.push(session);
    } else if (age < 2 * day) {
      yesterday.push(session);
    } else if (age < 7 * day) {
      prev7Days.push(session);
    } else {
      older.push(session);
    }
  }

  return { today, yesterday, prev7Days, older };
}

export default function Sidebar({
  activeChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onBranchChat,
  sessions,
  user,
  activeProjectId,
  onSelectProject,
  activeTab = 'chats',
  onTabChange,
  onOpenSearch,
  onOpenArtifacts,
  onOpenCode,
  onOpenCustomize,
  onUsePromptTemplate,
  loggedIn = false,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);

  // Filter sessions by project
  const filteredSessions = activeProjectId
    ? sessions.filter(s => s.projectId === activeProjectId)
    : sessions;

  const groups = groupConversations(filteredSessions);

  // unused: const renderGroup = (title: string, items: ChatSession[]) => { ... }
  void groups;

  // Get display name - prefer username, fallback to email
  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const userBalance = user?.balance || 0;

  // User menu items
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'balance',
      icon: <span style={{ fontSize: '14px' }}>💰</span>,
      label: <span>余额: <b>¥{userBalance.toFixed(2)}</b></span>,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user?.email || 'Profile',
      disabled: true,
    },
    {
      key: 'view-apikey',
      icon: <span style={{ fontSize: '14px' }}>🔑</span>,
      label: '查看 API Key',
      onClick: () => {
        const apiKey = localStorage.getItem('claude_api_key');
        console.log('[Sidebar] claude_api_key from localStorage:', apiKey);
        console.log('[Sidebar] All localStorage keys:', Object.keys(localStorage));
        if (apiKey) {
          navigator.clipboard.writeText(apiKey);
          alert(`API Key 已复制到剪贴板:\n${apiKey}`);
        } else {
          const debugInfo = Object.keys(localStorage)
            .filter(k => k.includes('claude') || k.includes('token') || k.includes('key'))
            .reduce((acc: Record<string, string | null>, k) => { acc[k] = localStorage.getItem(k); return acc; }, {});
          alert('暂无 API Key，请联系管理员获取\n\n调试信息:\n所有存储: ' + JSON.stringify(debugInfo));
        }
      },
    },
    {
      key: 'recharge',
      icon: <span style={{ fontSize: '14px' }}>💳</span>,
      label: '去充值',
      onClick: () => {
        window.open('https://www.claudexia.com', '_blank');
      },
    },
    { type: 'divider' },
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        setShowUserMenu(false);
        logout();
        window.location.reload();
      },
    },
  ];

  const renderConvItem = (session: ChatSession) => {
    const isActive = activeChat === session.id;
    const isHovered = hoveredSession === session.id;
    const isRenaming = renamingSession === session.id;

    // Context menu items with icons
    const menuItems: MenuProps['items'] = [
      { key: 'star', icon: <StarOutlined />, label: '标星', onClick: () => console.log('Star:', session.id) },
      { type: 'divider' as const },
      { key: 'rename', icon: <EditOutlined />, label: '重命名', onClick: () => {
        setRenamingSession(session.id);
        setRenameValue(session.title);
      }},
      { key: 'branch', icon: <SwapOutlined />, label: '分支对话', onClick: () => onBranchChat?.(session.id) },
      { type: 'divider' as const },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => {
        setDeleteTarget(session);
      }},
    ];

    // Handle rename submit
    const handleRenameSubmit = () => {
      if (renameValue.trim() && renamingSession) {
        onRenameChat(renamingSession, renameValue.trim());
      }
      setRenamingSession(null);
      setRenameValue('');
    };

    return (
      <>
        <Dropdown key={session.id} menu={{ items: menuItems }} trigger={['contextMenu']} placement="bottomLeft">
          <div
            className={`recent-item ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
            onClick={() => !isRenaming && onSelectChat(session.id)}
            onMouseEnter={() => setHoveredSession(session.id)}
            onMouseLeave={() => setHoveredSession(null)}
          >
            <div className="recent-item-content">
              {isRenaming ? (
                <Input
                  className="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onPressEnter={handleRenameSubmit}
                  onBlur={handleRenameSubmit}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  size="small"
                />
              ) : (
                <>
                  <div className="recent-title">{session.title}</div>
                  {isHovered && !collapsed && (
                    <div className="recent-actions" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="重命名">
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSession(session.id);
                            setRenameValue(session.title);
                          }}
                        >
                          <EditOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="删除">
                        <button
                          className="action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(session);
                          }}
                        >
                          <DeleteOutlined />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Dropdown>
      </>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
        onClick={onMobileClose}
      />

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {!collapsed && (
          <>
            <div className="sidebar-header">
              <Tooltip title="收起侧边栏" placement="right">
                <button className="sidebar-toggle" onClick={() => setCollapsed(true)}>
                  <MenuFoldOutlined />
                </button>
              </Tooltip>
              {activeChat && (
                <span className="sidebar-chat-title">{sessions.find(s => s.id === activeChat)?.title || '新对话'}</span>
              )}
            </div>

            <div className="sidebar-top-section">
              <div className="sidebar-logo">
                <img src="/favicon.svg" alt="Claude" className="sidebar-logo-icon" width="24" height="24" />
                <span>Claude</span>
              </div>
            </div>
          </>
        )}

        {collapsed && (
          <div className="sidebar-header-collapsed">
            <Tooltip title="展开侧边栏" placement="right">
              <button className="sidebar-toggle" onClick={() => setCollapsed(false)}>
                <MenuUnfoldOutlined />
              </button>
            </Tooltip>
          </div>
        )}

        {loggedIn && (
          <button className="sidebar-new-chat" onClick={() => onSelectChat(null)}>
            <EditOutlined />
            {!collapsed && <span>New chat</span>}
          </button>
        )}

        <div className="sidebar-menu">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <div key={item.key} className={`sidebar-menu-item ${isActive ? 'active' : ''}`} onClick={() => {
                if (item.key === 'projects') setShowProjects(!showProjects);
                else if (item.key === 'search') onOpenSearch?.();
                else if (item.key === 'artifacts') onOpenArtifacts?.();
                else if (item.key === 'code') onOpenCode?.();
                else if (item.key === 'customize') onOpenCustomize?.();
                else if (item.key === 'memory') setShowMemory(!showMemory);
                else if (item.key === 'templates') setShowTemplates(!showTemplates);
                else onTabChange?.(item.key);
              }}>
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          })}
        </div>

        {/* Main content area */}
        <div className="sidebar-content">
          {/* Projects panel overlay */}
          {showProjects && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowProjects(false)}><LeftOutlined /> Back</button>
              </div>
              <ProjectsPanel activeProjectId={activeProjectId} onSelectProject={(projectId) => { onSelectProject(projectId); setShowProjects(false); }} />
            </div>
          )}

          {/* Memory panel overlay */}
          {showMemory && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowMemory(false)}><LeftOutlined /> Back</button>
              </div>
              <MemoryPanel open={showMemory} />
            </div>
          )}

          {/* Templates panel overlay */}
          {showTemplates && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowTemplates(false)}><LeftOutlined /> Back</button>
              </div>
              <PromptTemplatesPanel onUseTemplate={(content) => {
                onUsePromptTemplate?.(content);
                setShowTemplates(false);
              }} />
            </div>
          )}

          {/* Conversations list */}
          {!showProjects && !showMemory && !showTemplates && (
            <div className="sidebar-conversations">
              {filteredSessions.length === 0 ? (
                <div className="empty-conversations">暂无会话记录</div>
              ) : (
                filteredSessions.map(renderConvItem)
              )}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} open={showUserMenu} onOpenChange={setShowUserMenu} placement="topLeft">
            <div className="sidebar-user" onClick={(e) => e.preventDefault()}>
              <div className="user-avatar">{initials}</div>
              {!collapsed && (
                <>
                  <div className="user-info">
                    <div className="user-name">{displayName}</div>
                    <div className="user-plan"><span style={{ color: 'var(--accent-purple)', fontSize: '12px' }}>💰 ¥{userBalance.toFixed(2)}</span></div>
                  </div>
                  <MoreOutlined style={{ color: 'var(--text-tertiary)' }} />
                </>
              )}
            </div>
          </Dropdown>
        </div>

        {/* Delete Confirmation Modal */}
        <Modal
          title="删除对话"
          open={!!deleteTarget}
          onOk={() => {
            if (deleteTarget) {
              onDeleteChat(deleteTarget.id);
              setDeleteTarget(null);
            }
          }}
          onCancel={() => setDeleteTarget(null)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <p>确定要删除对话 "<strong>{deleteTarget?.title}</strong>" 吗？</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '8px' }}>此操作无法撤销。</p>
        </Modal>
      </aside>
    </>
  );
}
