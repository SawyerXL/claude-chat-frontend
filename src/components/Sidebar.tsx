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
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { ChatSession } from '../types';
import '../styles/sidebar.css';

interface SidebarProps {
  activeChat: string | null;
  onSelectChat: (id: string | null) => void;
  sessions: ChatSession[];
}

const NAV_ITEMS = [
  { key: 'search', icon: <SearchOutlined />, label: 'Search' },
  { key: 'chats', icon: <MessageOutlined />, label: 'Chats' },
  { key: 'projects', icon: <FolderOutlined />, label: 'Projects' },
  { key: 'artifacts', icon: <AppstoreOutlined />, label: 'Artifacts' },
  { key: 'code', icon: <CodeOutlined />, label: 'Code' },
  { key: 'customize', icon: <SettingOutlined />, label: 'Customize' },
];

export default function Sidebar({ activeChat, onSelectChat, sessions }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
        {NAV_ITEMS.map((item) => (
          <div key={item.key} className="sidebar-menu-item">
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </div>
        ))}
      </div>

      {!collapsed && (
        <>
          <div className="sidebar-section">Recents</div>
          <div className="sidebar-recents">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`recent-item ${activeChat === session.id ? 'active' : ''}`}
                onClick={() => onSelectChat(session.id)}
              >
                {session.title}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">S</div>
          {!collapsed && (
            <>
              <div className="user-info">
                <div className="user-name">sawyer</div>
                <div className="user-plan">Max plan</div>
              </div>
              <MoreOutlined style={{ color: 'var(--text-tertiary)' }} />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
