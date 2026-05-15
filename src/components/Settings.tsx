import { useState, useEffect } from 'react';
import { Modal, message } from 'antd';
import {
  SettingOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  DeleteOutlined,
  PlusOutlined,
  BankOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import '../styles/settings.css';
import { getMemory, addMemory, deleteMemory, clearMemory } from '../services/memory';
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('claude_theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
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

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('claude_theme', newTheme);
    onThemeChange?.(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    message.success('Theme changed');
  };

  const handleInstructionsChange = (field: keyof CustomInstructions, value: string) => {
    const updated = { ...instructions, [field]: value };
    setInstructions(updated);
    saveInstructions(updated);
    message.success('Instructions saved');
  };

  const tabs = [
    { key: 'general', icon: <SettingOutlined />, label: 'General' },
    { key: 'instructions', icon: <MessageOutlined />, label: 'Custom Instructions' },
    { key: 'memory', icon: <BankOutlined />, label: 'Memory' },
    { key: 'mcp', icon: <ApiOutlined />, label: 'MCP Servers' },
    { key: 'keyboard', icon: <span>⌨️</span>, label: 'Keyboard' },
    { key: 'about', icon: <InfoCircleOutlined />, label: 'About' },
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
                  <div className="settings-item-desc">Choose your preferred color theme</div>
                </div>
                <select
                  className="settings-select"
                  value={theme}
                  onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Font size</div>
                  <div className="settings-item-desc">Adjust text size</div>
                </div>
                <select className="settings-select">
                  <option value="small">Small</option>
                  <option value="medium" selected>Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Enter to send</div>
                  <div className="settings-item-desc">Press Enter to send messages</div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <div className="settings-item-label">Show thinking</div>
                  <div className="settings-item-desc">Display Claude's thinking process</div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider" />
                </label>
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
                <button onClick={handleAddMemory}><PlusOutlined /> Add</button>
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
                        <DeleteOutlined />
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

          {activeTab === 'mcp' && (
            <div className="settings-section mcp-section">
              <div className="mcp-header">
                <h3>MCP Servers</h3>
                <p>Configure Model Context Protocol servers to extend Claude's capabilities with external tools and data sources.</p>
              </div>

              <div className="mcp-coming-soon">
                <div className="coming-soon-icon"><ApiOutlined /></div>
                <h4>MCP Integration Coming Soon</h4>
                <p>This feature requires server-side MCP support. MCP allows Claude to:</p>
                <ul>
                  <li>Access real-time data from external APIs</li>
                  <li>Use specialized tools (browsers, databases, etc.)</li>
                  <li>Connect to enterprise data sources</li>
                </ul>
                <p className="coming-soon-note">Server configuration will be available in a future update.</p>
              </div>
            </div>
          )}

          {activeTab === 'keyboard' && (
            <div className="settings-section">
              <div className="shortcuts-list">
                <div className="shortcut-item">
                  <span className="shortcut-desc">New conversation</span>
                  <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Send message</span>
                  <span className="shortcut-keys"><kbd>Enter</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Multi-line input</span>
                  <span className="shortcut-keys"><kbd>Shift</kbd> + <kbd>Enter</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Stop generation</span>
                  <span className="shortcut-keys"><kbd>Esc</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Toggle sidebar</span>
                  <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>B</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Clear conversation</span>
                  <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Input history (up/down)</span>
                  <span className="shortcut-keys"><kbd>↑</kbd> / <kbd>↓</kbd></span>
                </div>
              </div>
            </div>
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