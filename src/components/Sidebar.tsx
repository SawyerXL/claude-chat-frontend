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
} from '@ant-design/icons';
import { Tooltip, Dropdown, type MenuProps } from 'antd';
import type { ChatSession } from '../types';
import type { User } from '../services/auth';
import { logout } from '../services/auth';
import ProjectsPanel from './ProjectsPanel';
import '../styles/sidebar.css';

interface SidebarProps {
  activeChat: string | null;
  onSelectChat: (id: string | null) => void;
  onDeleteChat: (id: string) => void;
  sessions: ChatSession[];
  user?: User | null;
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

const NAV_ITEMS = [
  { key: 'search', icon: <SearchOutlined />, label: 'Search' },
  { key: 'chats', icon: <MessageOutlined />, label: 'Chats' },
  { key: 'projects', icon: <FolderOutlined />, label: 'Projects' },
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
  sessions,
  user,
  activeProjectId,
  onSelectProject,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Filter sessions by project
  const filteredSessions = activeProjectId
    ? sessions.filter(s => s.projectId === activeProjectId)
    : sessions;

  const groups = groupConversations(filteredSessions);

  // Get display name - prefer username, fallback to email
  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  // User menu items
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user?.email || 'Profile',
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
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
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Delete',
        danger: true,
        onClick: () => onDeleteChat(session.id),
      },
    ];

    return (
      <Dropdown
        key={session.id}
        menu={{ items: menuItems }}
        trigger={['contextMenu']}
        placement="bottomLeft"
      >
        <div
          className={`recent-item ${isActive ? 'active' : ''}`}
          onClick={() => onSelectChat(session.id)}
        >
          <div className="recent-item-content">
            <div className="recent-icon">
              <MessageOutlined />
            </div>
            <div className="recent-info">
              <div className="recent-title">{session.title}</div>
              <div className="recent-time">{formatTime(session.updatedAt)}</div>
            </div>
          </div>
          <Tooltip title="Delete">
            <button
              className="recent-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(session.id);
              }}
            >
              <DeleteOutlined />
            </button>
          </Tooltip>
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
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">C</div>
            <span>Claude</span>
          </div>
        )}
        <Tooltip title={collapsed ? 'Expand' : 'Collapse'} placement="right">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </Tooltip>
      </div>

      <button className="sidebar-new-chat" onClick={() => onSelectChat(null)}>
        <EditOutlined />
        {!collapsed && <span>New chat</span>}
      </button>

      <div className="sidebar-menu">
        {NAV_ITEMS.map((item) => {
          // Projects button toggles projects panel
          if (item.key === 'projects') {
            return (
              <div
                key={item.key}
                className={`sidebar-menu-item ${showProjects ? 'active' : ''}`}
                onClick={() => {
                  setShowProjects(!showProjects);
                }}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          }
          return (
            <div key={item.key} className="sidebar-menu-item">
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
              <button onClick={() => setShowProjects(false)}>
                <LeftOutlined /> Back
              </button>
            </div>
            <ProjectsPanel
              activeProjectId={activeProjectId}
              onSelectProject={(projectId) => {
                onSelectProject(projectId);
                setShowProjects(false);
              }}
            />
          </div>
        )}

        {/* Conversations list */}
        {!showProjects && (
          <div className="sidebar-conversations">
            {renderGroup('Today', groups.today)}
            {renderGroup('Yesterday', groups.yesterday)}
            {renderGroup('Previous 7 Days', groups.prev7Days)}
            {renderGroup('Previous 30 Days', groups.older)}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <Dropdown
          menu={{ items: userMenuItems }}
          trigger={['click']}
          open={showUserMenu}
          onOpenChange={setShowUserMenu}
          placement="topLeft"
        >
          <div className="sidebar-user" onClick={(e) => e.preventDefault()}>
            <div className="user-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="user-info">
                  <div className="user-name">{displayName}</div>
                  <div className="user-plan">{user?.role === 'admin' ? 'Admin' : 'User'}</div>
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
