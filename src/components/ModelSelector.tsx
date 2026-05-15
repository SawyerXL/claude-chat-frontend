import { useState, useEffect } from 'react';
import { Dropdown, Switch, Slider, InputNumber, message } from 'antd';
import { CheckOutlined, DownOutlined, SettingOutlined } from '@ant-design/icons';
import { MODELS } from '../constants';
import type { ModelOption, ModelSettings } from '../types';

const SETTINGS_KEY = 'claude_model_settings';

function loadSettings(): ModelSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { temperature: 0.7, topP: 0.9, topK: 40, maxTokens: 4096 };
}

function saveSettings(settings: ModelSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  settings?: ModelSettings;
  onSettingsChange?: (settings: ModelSettings) => void;
}

export default function ModelSelector({ value, onChange, settings, onSettingsChange }: ModelSelectorProps) {
  const [thinking, setThinking] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<ModelSettings>(loadSettings);
  const current = MODELS.find((m) => m.id === value) || MODELS[1];

  // Sync with props
  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = (key: keyof ModelSettings, val: number) => {
    const updated = { ...localSettings, [key]: val };
    setLocalSettings(updated);
    saveSettings(updated);
    onSettingsChange?.(updated);
    message.success('Settings saved');
  };

  const dropdownContent = showSettings ? (
    <div className="model-settings-panel">
      <div className="settings-header" onClick={() => setShowSettings(false)}>
        ← Back to models
      </div>
      <div className="settings-section">
        <div className="settings-title">Generation Settings</div>

        <div className="settings-row">
          <label>Temperature: {localSettings.temperature.toFixed(1)}</label>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={localSettings.temperature}
            onChange={(v) => handleSettingChange('temperature', v)}
            style={{ width: 120 }}
          />
          <span className="settings-hint">Higher = creative, Lower = focused</span>
        </div>

        <div className="settings-row">
          <label>Top P: {localSettings.topP.toFixed(1)}</label>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={localSettings.topP}
            onChange={(v) => handleSettingChange('topP', v)}
            style={{ width: 120 }}
          />
          <span className="settings-hint">Nucleus sampling threshold</span>
        </div>

        <div className="settings-row">
          <label>Top K: {localSettings.topK}</label>
          <Slider
            min={1}
            max={100}
            step={1}
            value={localSettings.topK}
            onChange={(v) => handleSettingChange('topK', v)}
            style={{ width: 120 }}
          />
          <span className="settings-hint">Limit vocabulary to top K tokens</span>
        </div>

        <div className="settings-row">
          <label>Max Tokens: {localSettings.maxTokens}</label>
          <InputNumber
            min={256}
            max={8192}
            step={256}
            value={localSettings.maxTokens}
            onChange={(v) => v && handleSettingChange('maxTokens', v)}
          />
          <span className="settings-hint">Maximum response length</span>
        </div>
      </div>
    </div>
  ) : (
    <div
      className="model-dropdown"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        minWidth: 280,
      }}
    >
      {MODELS.map((m: ModelOption) => (
        <div
          key={m.id}
          className={`model-option ${m.id === value ? 'selected' : ''}`}
          onClick={() => onChange(m.id)}
        >
          <div className="model-option-info">
            <div className="model-option-name">
              {m.name}
              {m.badge && <span className="model-badge">{m.badge}</span>}
            </div>
            <div className="model-option-desc">{m.description}</div>
          </div>
          {m.id === value && (
            <CheckOutlined style={{ color: 'var(--accent)' }} />
          )}
        </div>
      ))}
      <div className="model-divider" />
      <div className="thinking-row">
        <div>
          <div className="thinking-label">Adaptive thinking</div>
          <div className="thinking-desc">Use extended thinking when helpful</div>
        </div>
        <Switch
          checked={thinking}
          onChange={setThinking}
          size="small"
        />
      </div>
      <div className="model-divider" />
      <div
        className="model-settings-trigger"
        onClick={() => setShowSettings(true)}
      >
        <SettingOutlined /> Advanced Settings
      </div>
    </div>
  );

  return (
    <Dropdown
      trigger={['click']}
      placement="topLeft"
      dropdownRender={() => dropdownContent}
    >
      <button className="model-selector">
        <span>{current.name.replace('Claude ', '')}</span>
        <DownOutlined style={{ fontSize: 10 }} />
      </button>
    </Dropdown>
  );
}