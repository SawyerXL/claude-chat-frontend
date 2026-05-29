import { useState, useEffect } from 'react';

const SHORTCUTS_STORAGE_KEY = 'claude_custom_shortcuts';

export interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string[];
  enabled: boolean;
  category: string;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'send', name: 'Send message', keys: ['Enter'], enabled: true, category: 'Chat' },
  { id: 'new_chat', name: 'New conversation', keys: ['Ctrl+Shift+N'], enabled: true, category: 'General' },
  { id: 'clear_chat', name: 'Clear conversation', keys: ['Ctrl+K'], enabled: true, category: 'Chat' },
  { id: 'copy_response', name: 'Copy last response', keys: ['Ctrl+Shift+C'], enabled: true, category: 'Chat' },
  { id: 'toggle_sidebar', name: 'Toggle sidebar', keys: ['Ctrl+B'], enabled: true, category: 'UI' },
  { id: 'toggle_theme', name: 'Toggle theme', keys: ['Ctrl+Shift+T'], enabled: true, category: 'UI' },
  { id: 'open_search', name: 'Open search', keys: ['Ctrl+F'], enabled: true, category: 'UI' },
  { id: 'stop_generation', name: 'Stop generation', keys: ['Escape'], enabled: true, category: 'Chat' },
  { id: 'navigate_up', name: 'Navigate up (history)', keys: ['↑'], enabled: true, category: 'Navigation' },
  { id: 'navigate_down', name: 'Navigate down (history)', keys: ['↓'], enabled: true, category: 'Navigation' },
  { id: 'voice_input', name: 'Voice input', keys: ['Ctrl+M'], enabled: true, category: 'Chat' },
];

function loadShortcuts(): KeyboardShortcut[] {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return DEFAULT_SHORTCUTS;
}

function saveShortcuts(shortcuts: KeyboardShortcut[]) {
  localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
}

interface KeyboardShortcutsProps {
  onClose?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function KeyboardShortcuts({ onClose: _onClose }: KeyboardShortcutsProps) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(loadShortcuts);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  useEffect(() => {
    setShortcuts(loadShortcuts());
  }, []);

  const handleToggle = (id: string) => {
    const updated = shortcuts.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setShortcuts(updated);
    saveShortcuts(updated);
  };

  const handleReset = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    saveShortcuts(DEFAULT_SHORTCUTS);
  };

  const startRecording = (id: string) => {
    setRecordingKey(id);
    setRecordedKeys([]);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!recordingKey) return;

    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');

    // Add the key
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      keys.push(key);
    }

    if (keys.length > 0) {
      setRecordedKeys(keys);
    }
  };

  const handleKeyUp = (_e: KeyboardEvent) => {
    if (!recordingKey || recordedKeys.length === 0) return;

    // Save the recorded keys
    const updated = shortcuts.map(s =>
      s.id === recordingKey ? { ...s, keys: [recordedKeys.join('+')] } : s
    );
    setShortcuts(updated);
    saveShortcuts(updated);
    setRecordingKey(null);
    setRecordedKeys([]);
  };

  useEffect(() => {
    if (recordingKey) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [recordingKey, recordedKeys]);

  const cancelRecording = () => {
    setRecordingKey(null);
    setRecordedKeys([]);
  };

  // Group shortcuts by category
  const categories = shortcuts.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div className="keyboard-section">
      <div className="keyboard-header">
        <h3>Keyboard Shortcuts</h3>
        <p>Customize keyboard shortcuts for quick actions</p>
      </div>

      <div className="keyboard-list">
        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="keyboard-category">
            <h4>{category}</h4>
            {items.map(shortcut => (
              <div key={shortcut.id} className="keyboard-item">
                <div className="keyboard-item-info">
                  <label className="keyboard-name">{shortcut.name}</label>
                  <div className="keyboard-keys-display">
                    {shortcut.keys.map((key, i) => (
                      <kbd key={i} className="keyboard-key">{key}</kbd>
                    ))}
                  </div>
                </div>
                <div className="keyboard-item-actions">
                  {recordingKey === shortcut.id ? (
                    <div className="keyboard-recording">
                      <span className="recording-indicator">●</span>
                      <span className="recording-keys">
                        {recordedKeys.length > 0 ? recordedKeys.join('+') : 'Press keys...'}
                      </span>
                      <button className="keyboard-cancel-btn" onClick={cancelRecording}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="keyboard-edit-btn"
                        onClick={() => startRecording(shortcut.id)}
                        title="Change shortcut"
                      >
                        ✎
                      </button>
                      <label className="settings-toggle">
                        <input
                          type="checkbox"
                          checked={shortcut.enabled}
                          onChange={() => handleToggle(shortcut.id)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="keyboard-footer">
        <button className="keyboard-reset-btn" onClick={handleReset}>
          Reset to defaults
        </button>
      </div>

      {recordingKey && (
        <div className="keyboard-recording-overlay">
          <div className="keyboard-recording-dialog">
            <h4>Recording new shortcut</h4>
            <p>Press the key combination you want to use</p>
            <div className="recording-preview">
              {recordedKeys.length > 0 ? (
                recordedKeys.map((k, i) => <kbd key={i}>{k}</kbd>)
              ) : (
                <span className="waiting-keys">Press any keys...</span>
              )}
            </div>
            <button onClick={cancelRecording}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}