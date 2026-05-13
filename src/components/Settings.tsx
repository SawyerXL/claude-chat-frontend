import { useState } from 'react';
import { Modal } from 'antd';
import {
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import '../styles/settings.css';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function Settings({ open, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { key: 'general', icon: <SettingOutlined />, label: 'General' },
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
                <select className="settings-select">
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

          {activeTab === 'keyboard' && (
            <div className="settings-section">
              <div className="shortcuts-list">
                <div className="shortcut-item">
                  <span className="shortcut-desc">New conversation</span>
                  <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
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
                  <span className="shortcut-desc">Search</span>
                  <span className="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <div className="settings-about">
                <div className="about-logo">C</div>
                <h3>Claude Code Clone</h3>
                <p className="about-version">Version 2.1.0</p>
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