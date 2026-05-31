/**
 * Notification Service
 * Handles browser notifications for chat events
 */

const NOTIFICATION_KEY = 'notifications_enabled';
const HISTORY_KEY = 'notifications_history';
const MAX_HISTORY = 50;

export interface NotificationEntry {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'success' | 'error' | 'info';
}

class NotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Check if notifications are enabled by user
   */
  isEnabled(): boolean {
    return localStorage.getItem(NOTIFICATION_KEY) === 'true';
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[Notifications] Not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      localStorage.setItem(NOTIFICATION_KEY, 'true');
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('[Notifications] Permission denied by user');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      if (result === 'granted') {
        localStorage.setItem(NOTIFICATION_KEY, 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Get notification history from localStorage
   */
  getHistory(): NotificationEntry[] {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  /**
   * Add entry to history
   */
  private addToHistory(title: string, body: string, type: NotificationEntry['type'] = 'info') {
    const history = this.getHistory();
    const entry: NotificationEntry = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      type,
    };
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  /**
   * Mark all as read
   */
  markAllRead() {
    const history = this.getHistory().map(e => ({ ...e, read: true }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  /**
   * Clear all history
   */
  clearHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.getHistory().filter(e => !e.read).length;
  }

  /**
   * Show a notification
   */
  show(title: string, options?: NotificationOptions): Notification | null {
    this.addToHistory(title, options?.body || '', 'info');
    if (!this.isSupported() || !this.isEnabled() || this.permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error('[Notifications] Failed to show:', error);
      return null;
    }
  }

  /**
   * Notify when response is complete (for long messages)
   */
  notifyResponseComplete(model: string, preview: string) {
    const truncated = preview.length > 50 ? preview.slice(0, 50) + '...' : preview;
    this.addToHistory('Response Complete', `${model}: ${truncated}`, 'success');
    this.show('Response Complete', {
      body: `${model}: ${truncated}`,
      tag: 'response-complete',
      requireInteraction: false,
    });
  }

  /**
   * Notify on error
   */
  notifyError(message: string) {
    this.addToHistory('Request Failed', message, 'error');
    this.show('Request Failed', {
      body: message,
      tag: 'request-error',
      requireInteraction: false,
    });
  }

  /**
   * Enable notifications
   */
  enable() {
    localStorage.setItem(NOTIFICATION_KEY, 'true');
  }

  /**
   * Disable notifications
   */
  disable() {
    localStorage.setItem(NOTIFICATION_KEY, 'false');
  }
}

// Export singleton
export const notificationService = new NotificationService();