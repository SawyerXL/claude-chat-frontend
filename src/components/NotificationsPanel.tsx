import { useState, useEffect } from 'react';
import { Modal, Empty } from 'antd';
import { BellIcon, CheckIcon, TrashIcon, CloseIcon } from './icons/ClaudeIcons';
import { notificationService, type NotificationEntry } from '../services/notifications';
import './NotificationsPanel.css';

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const [history, setHistory] = useState<NotificationEntry[]>([]);

  useEffect(() => {
    if (open) {
      setHistory(notificationService.getHistory());
    }
  }, [open]);

  if (!open) return null;

  const handleMarkAllRead = () => {
    notificationService.markAllRead();
    setHistory(notificationService.getHistory());
  };

  const handleClearAll = () => {
    notificationService.clearHistory();
    setHistory([]);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return d.toLocaleDateString('zh-CN');
  };

  const typeIcon = (type: NotificationEntry['type']) => {
    if (type === 'error') return '❌';
    if (type === 'success') return '✅';
    return 'ℹ️';
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellIcon />
          <span>Notifications</span>
          {history.filter(h => !h.read).length > 0 && (
            <span className="notif-badge">{history.filter(h => !h.read).length}</span>
          )}
        </div>
      }
      footer={null}
      width={480}
      centered
    >
      <div className="notifications-panel">
        <div className="notif-actions">
          <button onClick={handleMarkAllRead}><CheckIcon /> Mark all read</button>
          <button onClick={handleClearAll}><TrashIcon /> Clear all</button>
        </div>

        {history.length === 0 ? (
          <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="notif-list">
            {history.map(entry => (
              <div key={entry.id} className={`notif-item ${entry.read ? 'read' : 'unread'} notif-type-${entry.type}`}>
                <span className="notif-icon">{typeIcon(entry.type)}</span>
                <div className="notif-content">
                  <div className="notif-title">{entry.title}</div>
                  {entry.body && <div className="notif-body">{entry.body}</div>}
                  <div className="notif-time">{formatTime(entry.timestamp)}</div>
                </div>
                <button className="notif-close" onClick={() => {
                  const updated = history.filter(h => h.id !== entry.id);
                  localStorage.setItem('notifications_history', JSON.stringify(updated));
                  setHistory(updated);
                }}>
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}