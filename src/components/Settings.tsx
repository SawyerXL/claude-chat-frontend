import { useState, useEffect } from 'react';
import { Modal, message } from 'antd';
import {
  SettingsIcon,
  InfoIcon,
  MessageIcon,
  TrashIcon,
  PlusIcon,
  LightbulbIcon,
  ApiIcon,
} from './icons/ClaudeIcons';
import KeyboardShortcuts from './KeyboardShortcuts';
import ConnectorsPanel from './ConnectorsPanel';
import '../styles/settings.css';
import { getMemory, addMemory, deleteMemory, clearMemory } from '../services/memory';
import { notificationService } from '../services/notifications';
import ImportExportPanel from './ImportExportPanel';
import '../styles/keyboard-shortcuts.css';
import type { MemoryEntry } from '../services/memory';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onThemeChange?: (theme: 'dark' | 'light') => void;
}

const CUSTOM_INSTRUCTIONS_KEY = 'claude_custom_instructions';

interface CustomInstructions {
  background: string;
  preferences: string;
}

function loadInstructions(): CustomInstructions {
  try {
    const stored = localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { background: '', preferences: '' };
}

function saveInstructions(inst: CustomInstructions) {
  localStorage.setItem(CUSTOM_INSTRUCTIONS_KEY, JSON.stringify(inst));
}

export default function Settings({ open, onClose, onThemeChange }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [instructions, setInstructions] = useState<CustomInstructions>(loadInstructions);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [fontSize, setFontSize] = useState('medium');
  const [enterToSend, setEnterToSend] = useState(true);
  const [showThinking, setShowThinking] = useState(true);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(notificationService.isEnabled());
  const [connectorsOpen, setConnectorsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('claude_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setTheme(saved);
    }
    const savedFontSize = localStorage.getItem('claude_font_size');
    if (savedFontSize) setFontSize(savedFontSize);
    const savedEnterToSend = localStorage.getItem('claude_enter_send');
    if (savedEnterToSend !== null) setEnterToSend(savedEnterToSend !== 'false');
    const savedShowThinking = localStorage.getItem('claude_show_thinking');
    if (savedShowThinking !== null) setShowThinking(savedShowThinking !== 'false');
  }, [open]);

  useEffect(() => {
    if (open) {
      setMemoryEntries(getMemory().entries);
    }
  }, [open]);

  const handleAddMemory = () => {
    if (!newMemory.trim()) return;
    const entry = addMemory(newMemory.trim());
    setMemoryEntries(prev => [...prev, entry]);
    setNewMemory('');
    message.success('Memory added');
  };

  const handleDeleteMemory = (id: string) => {
    if (deleteMemory(id)) {
      setMemoryEntries(prev => prev.filter(e => e.id !== id));
      message.success('Memory deleted');
    }
  };

  const handleClearMemory = () => {
    if (confirm('Clear all memories?')) {
      clearMemory();
      setMemoryEntries([]);
      message.success('All memories cleared');
    }
  };

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('claude_theme', newTheme);
    // Import and use applyTheme directly for immediate response
    import('../services/theme').then(m => {
      m.applyTheme(newTheme);
      if (newTheme === 'system') {
        onThemeChange?.(m.getSystemTheme() as 'dark' | 'light');
        document.documentElement.setAttribute('data-theme', m.getSystemTheme());
      } else {
        onThemeChange?.(newTheme as 'dark' | 'light');
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    });
    message.success('Theme changed');
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    localStorage.setItem('claude_font_size', size);
    const fontSizeMap: Record<string, string> = { small: '13px', medium: '15px', large: '17px' };
    document.documentElement.style.setProperty('--font-size-base', fontSizeMap[size] || '15px');
    message.success('Font size changed');
  };

  const handleInstructionsChange = (field: keyof CustomInstructions, value: string) => {
    const updated = { ...instructions, [field]: value };
    setInstructions(updated);
    saveInstructions(updated);
    message.success('Instructions saved');
  };

  const tabs = [
    { key: 'general', icon: <SettingsIcon />, label: 'General' },
    { key: 'apikey', icon: <ApiIcon />, label: 'API Key' },
    { key: 'instructions', icon: <MessageIcon />, label: 'Custom Instructions' },
    { key: 'privacy', icon: <span>🔒</span>, label: 'Privacy' },
    { key: 'memory', icon: <LightbulbIcon />, label: 'Memory' },
    { key: 'import-export', icon: <span>📥</span>, label: 'Import/Export' },
    { key: 'mcp', icon: <span>🔌</span>, label: 'MCP Servers' },
    { key: 'keyboard', icon: <span>⌨️</span>, label: 'Keyboard' },
    { key: 'about', icon: <InfoIcon />, label: 'About' },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Settings"
      width={700}
      centered
      className="settings-modal"
    >
      <div className="settings-content">
        <nav className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`settings-nav-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Theme</div>
                  <div className="settings-item-desc">Choose your preferred color theme or follow system</div>
                </div>
                <select
                  className="settings-select"
                  value={theme}
                  onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light' | 'system')}
                >
                  <option value="system">System</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Font size</div>
                  <div className="settings-item-desc">Adjust text size</div>
                </div>
                <select
                  className="settings-select"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Enter to send</div>
                  <div className="settings-item-desc">Press Enter to send messages</div>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={enterToSend}
                    onChange={(e) => {
                      setEnterToSend(e.target.checked);
                      localStorage.setItem('claude_enter_send', String(e.target.checked));
                      message.success(e.target.checked ? 'Enter to send enabled' : 'Shift+Enter to send enabled');
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Show thinking</div>
                  <div className="settings-item-desc">Display Claude's thinking process</div>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={showThinking}
                    onChange={(e) => {
                      setShowThinking(e.target.checked);
                      localStorage.setItem('claude_show_thinking', String(e.target.checked));
                      message.success(e.target.checked ? 'Thinking shown' : 'Thinking hidden');
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Browser Notifications</div>
                  <div className="settings-item-desc">Get notified when responses complete</div>
                </div>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={notificationEnabled}
                    onChange={async (e) => {
                      if (e.target.checked) {
                        const granted = await notificationService.requestPermission();
                        setNotificationEnabled(granted);
                        if (!granted) {
                          message.warning('Notification permission denied');
                        }
                      } else {
                        notificationService.disable();
                        setNotificationEnabled(false);
                      }
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'apikey' && (
            <div className="settings-section apikey-section">
              <div className="apikey-header">
                <h3>Your API Key</h3>
                <p>Use your own Anthropic API key to have full control over your account's usage and billing.</p>
              </div>
              
              <div className="apikey-form">
                <div className="apikey-field">
                  <label>Anthropic API Key</label>
                  <input
                    type="password"
                    id="user-api-key"
                    placeholder="sk-ant-api03-..."
                    defaultValue={localStorage.getItem('user_api_key') || ''}
                    className="apikey-input"
                  />
                  <span className="field-hint">Your API key is stored locally and never sent to our servers.</span>
                </div>
                
                <div className="apikey-actions">
                  <button className="apikey-save-btn" onClick={() => {
                    const input = document.getElementById('user-api-key') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      localStorage.setItem('user_api_key', input.value.trim());
                      message.success('API Key saved! It will be used for future requests.');
                    } else {
                      localStorage.removeItem('user_api_key');
                      message.info('Using shared API key.');
                    }
                  }}>
                    Save API Key
                  </button>
                  <button className="apikey-clear-btn" onClick={() => {
                    localStorage.removeItem('user_api_key');
                    const input = document.getElementById('user-api-key') as HTMLInputElement;
                    if (input) input.value = '';
                    message.info('Cleared. Using shared API key.');
                  }}>
                    Clear
                  </button>
                </div>
                
                <div className="apikey-info">
                  <h4>Usage Notes</h4>
                  <ul>
                    <li>Using your own API key means you pay Anthropic directly for usage</li>
                    <li>Your key is stored in your browser only, not on our servers</li>
                    <li>When set, your key will be used instead of the shared account</li>
                    <li>Get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="settings-section instructions-section">
              <div className="instructions-header">
                <h3>Custom Instructions</h3>
                <p>Instructions here are prepended to every conversation, giving Claude context about who you are and how you prefer to interact.</p>
              </div>

              <div className="instructions-form">
                <div className="instructions-field">
                  <label>Background / Role</label>
                  <textarea
                    placeholder="Example: I'm a software engineer working on React projects. I prefer concise, code-focused responses..."
                    value={instructions.background}
                    onChange={(e) => handleInstructionsChange('background', e.target.value)}
                    rows={5}
                  />
                  <span className="field-hint">Tell Claude about yourself and your typical use cases</span>
                </div>

                <div className="instructions-field">
                  <label>Preferences</label>
                  <textarea
                    placeholder="Example: Use Chinese by default. Always include code examples. Format responses with clear sections..."
                    value={instructions.preferences}
                    onChange={(e) => handleInstructionsChange('preferences', e.target.value)}
                    rows={5}
                  />
                  <span className="field-hint">Define how Claude should communicate with you</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-section privacy-section">
              <div className="privacy-header">
                <h3>Privacy & Data</h3>
                <p>Control how your data is collected and used. Your privacy settings affect all future conversations.</p>
              </div>

              <div className="privacy-item">
                <div className="privacy-info">
                  <div className="privacy-label">Collect usage analytics</div>
                  <div className="privacy-desc">Help improve Claude by sending anonymous usage statistics</div>
                </div>
                <label className="privacy-toggle">
                  <input
                    type="checkbox"
                    checked={localStorage.getItem('claude_analytics') !== 'false'}
                    onChange={(e) => {
                      localStorage.setItem('claude_analytics', e.target.checked ? 'true' : 'false');
                      message.success(e.target.checked ? 'Analytics enabled' : 'Analytics disabled');
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="privacy-item">
                <div className="privacy-info">
                  <div className="privacy-label">Allow training on conversations</div>
                  <div className="privacy-desc">Let Anthropic use your conversations to improve AI models (requires opt-in)</div>
                </div>
                <label className="privacy-toggle">
                  <input
                    type="checkbox"
                    checked={localStorage.getItem('claude_training_optin') === 'true'}
                    onChange={(e) => {
                      localStorage.setItem('claude_training_optin', e.target.checked ? 'true' : 'false');
                      message.success(e.target.checked ? 'Training opt-in enabled' : 'Training opt-in disabled');
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="privacy-item">
                <div className="privacy-info">
                  <div className="privacy-label">Share error reports</div>
                  <div className="privacy-desc">Automatically send error reports when something breaks</div>
                </div>
                <label className="privacy-toggle">
                  <input
                    type="checkbox"
                    checked={localStorage.getItem('claude_error_reports') !== 'false'}
                    onChange={(e) => {
                      localStorage.setItem('claude_error_reports', e.target.checked ? 'true' : 'false');
                      message.success(e.target.checked ? 'Error reports enabled' : 'Error reports disabled');
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="privacy-section-divider"></div>

              <div className="privacy-danger">
                <h4>Data Management</h4>
                <button
                  className="privacy-btn danger"
                  onClick={() => {
                    if (confirm('This will delete all your sessions, memories, and preferences. This action cannot be undone.')) {
                      localStorage.removeItem('claude_sessions');
                      localStorage.removeItem('claude_memory');
                      localStorage.removeItem('claude_custom_instructions');
                      message.success('All local data cleared');
                    }
                  }}
                >
                  <TrashIcon /> Clear all local data
                </button>
                <button
                  className="privacy-btn"
                  onClick={() => {
                    const data = localStorage.getItem('claude_sessions_backup');
                    if (data) {
                      const backups = JSON.parse(data);
                      const total = backups.reduce((acc: number, b: any) => acc + b.count, 0);
                      alert(`Found ${backups.length} backups with ${total} total sessions.\nYou can restore from the backup in the Import/Export tab.`);
                    } else {
                      message.info('No backups found');
                    }
                  }}
                >
                  View backups
                </button>
              </div>

              <div className="privacy-info-box">
                <h4>Data Storage</h4>
                <ul>
                  <li>Conversations are stored locally in your browser</li>
                  <li>API keys are never sent to our servers</li>
                  <li>Custom instructions are stored locally only</li>
                  <li>You can export all your data anytime from the Import/Export tab</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="settings-section memory-section">
              <div className="memory-header">
                <h3>Memory</h3>
                <p>Claude uses these facts to provide personalized responses. Memories are automatically included in conversations.</p>
              </div>

              <div className="memory-add">
                <input
                  type="text"
                  placeholder="Add a new memory..."
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                />
                <button onClick={handleAddMemory}><PlusIcon /> Add</button>
              </div>

              <div className="memory-list">
                {memoryEntries.length === 0 ? (
                  <div className="memory-empty">No memories yet. Add some facts about yourself.</div>
                ) : (
                  memoryEntries.map((entry) => (
                    <div key={entry.id} className="memory-entry">
                      <span className="memory-fact">{entry.fact}</span>
                      <button
                        className="memory-delete"
                        onClick={() => handleDeleteMemory(entry.id)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {memoryEntries.length > 0 && (
                <button className="memory-clear" onClick={handleClearMemory}>
                  Clear all memories
                </button>
              )}
            </div>
          )}

          {activeTab === 'import-export' && (
            <ImportExportPanel />
          )}

          {activeTab === 'mcp' && (
            <ConnectorsPanel open={connectorsOpen} onClose={() => setConnectorsOpen(false)} />
          )}

          {activeTab === 'keyboard' && (
            <KeyboardShortcuts />
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <div className="settings-about">
                <div className="about-logo">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="6" fill="#1a1a1a"/>
                    <circle cx="12" cy="12" r="3" fill="#d4a574"/>
                    <path d="M12 8v1M12 15v1M8 12h1M15 12h1" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>Claude Code Clone</h3>
                <p className="about-version">Version 2.3.0</p>
                <p className="about-desc">
                  A Claude.com clone frontend built with React, powered by sub2api backend.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}