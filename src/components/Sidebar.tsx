import { useState } from 'react';
import { Tooltip, Dropdown, type MenuProps, Modal, Input } from 'antd';
import {
  EditIcon,
  SearchIcon,
  MessageIcon,
  FolderIcon,
  AppGridIcon,
  CodeIcon,
  SettingsIcon,
  MenuIcon,
  TrashIcon,
  UserIcon,
  LogOutIcon,
  ChevronLeftIcon,
  LightbulbIcon,
  StarIcon,
  BranchIcon,
  DocumentIcon,
  MoreHorizontalIcon,
} from './icons/ClaudeIcons';
import type { ChatSession } from '../types';
import type { User } from '../services/auth';
import { logout } from '../services/auth';
import ProjectsPanel from './ProjectsPanel';
import MemoryPanel from './MemoryPanel';
import PromptTemplatesPanel from './PromptTemplatesPanel';
import CollectionsPanel from './CollectionsPanel';
import { getCollections, getSessionsInCollection, addSessionToCollection } from '../services/collection';
import '../styles/sidebar.css';
import BranchTree from './BranchTree';

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
  activeCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
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
  { key: 'search', icon: <SearchIcon />, label: 'Search' },
  { key: 'chats', icon: <MessageIcon />, label: 'Chats' },
  { key: 'collections', icon: <FolderIcon />, label: 'Collections' },
  { key: 'projects', icon: <AppGridIcon />, label: 'Projects' },
  { key: 'templates', icon: <DocumentIcon />, label: 'Templates' },
  { key: 'memory', icon: <LightbulbIcon />, label: 'Memory' },
  { key: 'artifacts', icon: <AppGridIcon />, label: 'Artifacts' },
  { key: 'code', icon: <CodeIcon />, label: 'Code' },
  { key: 'customize', icon: <SettingsIcon />, label: 'Customize' },
  { key: 'branches', icon: <BranchIcon />, label: 'Branches' },
];

// Group conversations by time, with pinned sessions on top
function groupConversations(sessions: ChatSession[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Separate pinned, starred, archived, and regular sessions
  const pinned: ChatSession[] = [];
  const starred: ChatSession[] = [];
  const archived: ChatSession[] = [];
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const prev7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    if (session.archived) {
      archived.push(session);
    } else if (session.pinned) {
      pinned.push(session);
    } else if (session.starred) {
      starred.push(session);
    } else {
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
  }

  // Sort each group by updatedAt descending
  const sortByTime = (a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt;

  return {
    pinned: pinned.sort(sortByTime),
    starred: starred.sort(sortByTime),
    archived: archived.sort(sortByTime),
    today: today.sort(sortByTime),
    yesterday: yesterday.sort(sortByTime),
    prev7Days: prev7Days.sort(sortByTime),
    older: older.sort(sortByTime),
  };
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
  activeCollectionId,
  onSelectCollection,
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
  const [showCollections, setShowCollections] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);

  // Filter sessions by project and collection
  let filteredSessions = sessions;
  if (activeProjectId) {
    filteredSessions = filteredSessions.filter(s => s.projectId === activeProjectId);
  }
  if (activeCollectionId) {
    const collectionSessionIds = getSessionsInCollection(activeCollectionId);
    filteredSessions = filteredSessions.filter(s => collectionSessionIds.includes(s.id));
  }

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
      icon: <UserIcon />,
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
      icon: <LogOutIcon />,
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

    // Get collections for context menu
    const collections = getCollections();

    // Context menu items with icons
    const menuItems: MenuProps['items'] = [
      { key: 'star', icon: <StarIcon />, label: session.starred ? '取消星标' : '星标会话', onClick: () => {
        import('../services/session').then(m => {
          session.starred ? m.unstarSession(session.id) : m.starSession(session.id);
        });
      }},
      { type: 'divider' as const },
      {
        key: 'add-to-collection',
        icon: <FolderIcon />,
        label: '添加到收藏夹',
        children: collections.length > 0 ? collections.map(col => ({
          key: `col-${col.id}`,
          label: <span>{col.icon} {col.name}</span>,
          onClick: () => { addSessionToCollection(col.id, session.id); },
        })) : [{ key: 'no-collections', label: '暂无收藏夹', disabled: true }],
      },
      { key: 'pin', icon: <StarIcon />, label: session.pinned ? '取消置顶' : '置顶会话', onClick: () => {
        import('../services/session').then(m => {
          session.pinned ? m.unpinSession(session.id) : m.pinSession(session.id);
        });
      }},
      { key: 'archive', icon: session.archived ? <FolderIcon /> : <FolderIcon />, label: session.archived ? '取消归档' : '归档会话', onClick: () => {
        import('../services/session').then(m => {
          session.archived ? m.unarchiveSession(session.id) : m.archiveSession(session.id);
        });
      }},
      { type: 'divider' as const },
      { key: 'rename', icon: <EditIcon />, label: '重命名', onClick: () => {
        setRenamingSession(session.id);
        setRenameValue(session.title);
      }},
      { key: 'branch', icon: <BranchIcon />, label: '分支对话', onClick: () => onBranchChat?.(session.id) },
      { type: 'divider' as const },
      { key: 'delete', icon: <TrashIcon />, label: '删除', danger: true, onClick: () => {
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
            className={`recent-item ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''} ${session.pinned ? 'pinned' : ''} ${session.archived ? 'archived' : ''}`}
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
                          <EditIcon />
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
                          <TrashIcon />
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
                  <MenuIcon />
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
                <MenuIcon />
              </button>
            </Tooltip>
          </div>
        )}

        {loggedIn && (
          <button className="sidebar-new-chat" onClick={() => onSelectChat(null)}>
            <EditIcon />
            {!collapsed && <span>New chat</span>}
          </button>
        )}

        <div className="sidebar-menu">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <div key={item.key} className={`sidebar-menu-item ${isActive ? 'active' : ''}`} onClick={() => {
                if (item.key === 'projects') setShowProjects(!showProjects);
                else if (item.key === 'collections') setShowCollections(!showCollections);
                else if (item.key === 'search') onOpenSearch?.();
                else if (item.key === 'artifacts') onOpenArtifacts?.();
                else if (item.key === 'code') onOpenCode?.();
                else if (item.key === 'customize') onOpenCustomize?.();
                else if (item.key === 'memory') setShowMemory(!showMemory);
                else if (item.key === 'templates') setShowTemplates(!showTemplates);
                else if (item.key === 'branches') setShowBranches(!showBranches);
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
                <button onClick={() => setShowProjects(false)}><ChevronLeftIcon /> Back</button>
              </div>
              <ProjectsPanel activeProjectId={activeProjectId} onSelectProject={(projectId) => { onSelectProject(projectId); setShowProjects(false); }} />
            </div>
          )}

          {/* Memory panel overlay */}
          {showMemory && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowMemory(false)}><ChevronLeftIcon /> Back</button>
              </div>
              <MemoryPanel open={showMemory} />
            </div>
          )}

          {/* Templates panel overlay */}
          {showTemplates && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowTemplates(false)}><ChevronLeftIcon /> Back</button>
              </div>
              <PromptTemplatesPanel onUseTemplate={(content) => {
                onUsePromptTemplate?.(content);
                setShowTemplates(false);
              }} />
            </div>
          )}

          {/* Branches panel overlay */}
          {showBranches && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowBranches(false)}><ChevronLeftIcon /> Back</button>
              </div>
              <BranchTree
                sessions={sessions}
                activeSessionId={activeChat}
                onSelectBranch={(id) => { onSelectChat(id); setShowBranches(false); }}
                onCreateBranch={(parentId) => onBranchChat?.(parentId)}
                onDeleteBranch={(id) => onDeleteChat(id)}
              />
            </div>
          )}

          {/* Collections panel overlay */}
          {showCollections && (
            <div className="projects-overlay">
              <div className="projects-overlay-header">
                <button onClick={() => setShowCollections(false)}><ChevronLeftIcon /> Back</button>
              </div>
              <CollectionsPanel activeCollectionId={activeCollectionId} onSelectCollection={(collectionId) => { onSelectCollection(collectionId); setShowCollections(false); }} />
            </div>
          )}

          {/* Conversations list */}
          {!showProjects && !showMemory && !showTemplates && !showCollections && (
            <div className="sidebar-conversations">
              {filteredSessions.length === 0 ? (
                <div className="empty-conversations">暂无会话记录</div>
              ) : (
                <>
                  {/* Pinned sessions */}
                  {groups.pinned.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">📌 置顶</div>
                      {groups.pinned.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {groups.starred.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">⭐ 星标</div>
                      {groups.starred.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {/* Today's conversations */}
                  {groups.today.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">今天</div>
                      {groups.today.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {/* Yesterday's conversations */}
                  {groups.yesterday.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">昨天</div>
                      {groups.yesterday.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {/* Previous 7 days */}
                  {groups.prev7Days.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">近7天</div>
                      {groups.prev7Days.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {/* Older conversations */}
                  {groups.older.length > 0 && (
                    <div className="sidebar-section">
                      <div className="sidebar-section-title">更早</div>
                      {groups.older.map(session => renderConvItem(session))}
                    </div>
                  )}

                  {/* Archived sessions */}
                  {groups.archived.length > 0 && (
                    <div className="sidebar-section archived-section">
                      <div className="sidebar-section-title">📦 归档</div>
                      {groups.archived.map(session => renderConvItem(session))}
                    </div>
                  )}
                </>
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
                  <MoreHorizontalIcon style={{ color: 'var(--text-tertiary)' }} />
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
