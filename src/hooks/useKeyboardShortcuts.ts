import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function matchShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  const needCtrl = isMac ? shortcut.meta : shortcut.ctrl;

  if (needCtrl && !e.ctrlKey && !e.metaKey) return false;
  if (shortcut.shift && !e.shiftKey) return false;
  if (shortcut.alt && !e.altKey) return false;
  if (needCtrl && e.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (!needCtrl && e.key !== shortcut.key && e.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;

  return true;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger in input/textarea unless it's a send command
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    for (const shortcut of shortcuts) {
      if (matchShortcut(e, shortcut)) {
        // Allow some shortcuts even in input fields
        const allowInInput = ['Enter', 'ArrowUp', 'ArrowDown', 'Escape'].includes(shortcut.key);

        if (isInput && !allowInInput) continue;

        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcuts configuration
export const DEFAULT_SHORTCUTS = {
  send: (action: () => void): Shortcut => ({
    key: 'Enter',
    action,
    description: 'Send message',
    preventDefault: false, // Don't prevent default for Enter
  }),
  newChat: (action: () => void): Shortcut => ({
    key: 'n',
    ctrl: true,
    shift: true,
    action,
    description: 'New conversation',
  }),
  clearChat: (action: () => void): Shortcut => ({
    key: 'k',
    ctrl: true,
    action,
    description: 'Clear conversation',
  }),
  copyLastResponse: (action: () => void): Shortcut => ({
    key: 'c',
    ctrl: true,
    shift: true,
    action,
    description: 'Copy last response',
  }),
  toggleSidebar: (action: () => void): Shortcut => ({
    key: 'b',
    ctrl: true,
    action,
    description: 'Toggle sidebar',
  }),
  stopGeneration: (action: () => void): Shortcut => ({
    key: 'Escape',
    action,
    description: 'Stop generation',
    preventDefault: false,
  }),
  navigateUp: (action: () => void): Shortcut => ({
    key: 'ArrowUp',
    action,
    description: 'Navigate up (input history)',
    preventDefault: false,
  }),
  navigateDown: (action: () => void): Shortcut => ({
    key: 'ArrowDown',
    action,
    description: 'Navigate down (input history)',
    preventDefault: false,
  }),
};