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
  HolderOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { Tooltip, Dropdown, type MenuProps } from 'antd';
import type { ChatSession } from '../types';
import type { User } from '../services/auth';
import { logout } from '../services/auth';
import ProjectsPanel from './ProjectsPanel';
import MemoryPanel from './MemoryPanel';
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
  loggedIn?: boolean;
}

const NAV_ITEMS = [
  { key: 'search', icon: <SearchOutlined />, label: 'Search' },
  { key: 'chats', icon: <MessageOutlined />, label: 'Chats' },
  { key: 'projects', icon: <FolderOutlined />, label: 'Projects' },
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

// Format timestamp to display time
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const dayDiff = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (dayDiff === 1) {
    return 'Yesterday';
  } else if (dayDiff < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
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
  loggedIn = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  // Filter sessions by project
  const filteredSessions = activeProjectId
    ? sessions.filter(s => s.projectId === activeProjectId)
    : sessions;

  const groups = groupConversations(filteredSessions);

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
        if (apiKey) {
          navigator.clipboard.writeText(apiKey);
          alert(`API Key 已复制到剪贴板:\n${apiKey}`);
        } else {
          alert('暂无 API Key，请联系管理员获取');
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
    const menuItems: MenuProps['items'] = [
      { key: 'star', label: '标星' },
      { type: 'divider' as const },
      { key: 'rename', icon: <EditOutlined />, label: '重命名', onClick: () => {
        const newTitle = prompt('输入新标题:', session.title);
        if (newTitle && newTitle.trim()) onRenameChat(session.id, newTitle.trim());
      }},
      { key: 'add-project', label: '添加到项目' },
      { type: 'divider' as const },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => onDeleteChat(session.id) },
    ];

    return (
      <Dropdown key={session.id} menu={{ items: menuItems }} trigger={['contextMenu']} placement="bottomLeft">
        <div className={`recent-item ${isActive ? 'active' : ''}`} onClick={() => onSelectChat(session.id)}>
          <div className="recent-item-content">
            <div className="recent-title">{session.title}</div>
          </div>
        </div>
      </Dropdown>
    );
  };

  const renderGroup = (title: string, items: ChatSession[]) => {
    if (items.length === 0) return null;
    return (
      <div className="sidebar-group">
        <div className="sidebar-section">{title}</div>
        <div className="sidebar-recents">{items.map(renderConvItem)}</div>
      </div>
    );
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
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

          {/* Conversations list */}
          {!showProjects && !showMemory && (
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
      </aside>
  );
}
