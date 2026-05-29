import { useState, useEffect } from 'react';
import { usageManager, formatCost, formatTokens } from '../services/usageStats';
import { CloseIcon } from './icons/ClaudeIcons';
import '../styles/usage-stats.css';

interface UsageStatsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface StatData {
  input: number;
  output: number;
  cost: number;
}

export default function UsageStatsPanel({ open, onClose }: UsageStatsPanelProps) {
  const [stats, setStats] = useState<StatData>({ input: 0, output: 0, cost: 0 });
  const [sessionStats, setSessionStats] = useState<{ id: string; cost: number; input: number; output: number }[]>([]);

  useEffect(() => {
    if (open) {
      setStats(usageManager.getGlobalStats());
      // Get session stats from localStorage
      try {
        const stored = localStorage.getItem('usage_session_costs');
        if (stored) {
          const data = JSON.parse(stored);
          setSessionStats(Object.entries(data).map(([id, info]: [string, any]) => ({
            id,
            cost: info.cost || 0,
            input: info.input || 0,
            output: info.output || 0,
          })));
        }
      } catch {
        // Ignore
      }
    }
  }, [open]);

  const handleClearStats = () => {
    if (confirm('确定要清除所有用量统计吗？')) {
      usageManager.clearStats();
      localStorage.removeItem('usage_session_costs');
      setStats({ input: 0, output: 0, cost: 0 });
      setSessionStats([]);
    }
  };

  if (!open) return null;

  return (
    <div className="usage-stats-overlay" onClick={onClose}>
      <div className="usage-stats-panel" onClick={(e) => e.stopPropagation()}>
        <div className="usage-stats-header">
          <h2>Usage Statistics</h2>
          <button className="close-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="usage-stats-content">
          <div className="usage-summary">
            <h3>Total Usage</h3>
            <div className="usage-cards">
              <div className="usage-card">
                <div className="usage-card-icon">📥</div>
                <div className="usage-card-value">{formatTokens(stats.input)}</div>
                <div className="usage-card-label">Input Tokens</div>
              </div>
              <div className="usage-card">
                <div className="usage-card-icon">📤</div>
                <div className="usage-card-value">{formatTokens(stats.output)}</div>
                <div className="usage-card-label">Output Tokens</div>
              </div>
              <div className="usage-card highlight">
                <div className="usage-card-icon">💰</div>
                <div className="usage-card-value">{formatCost(stats.cost)}</div>
                <div className="usage-card-label">Estimated Cost</div>
              </div>
            </div>
          </div>

          {sessionStats.length > 0 && (
            <div className="usage-sessions">
              <h3>Session Breakdown</h3>
              <div className="session-list">
                {sessionStats.map((s) => (
                  <div key={s.id} className="session-item">
                    <div className="session-id">{s.id.slice(0, 12)}...</div>
                    <div className="session-stats">
                      <span>In: {formatTokens(s.input)}</span>
                      <span>Out: {formatTokens(s.output)}</span>
                      <span className="session-cost">{formatCost(s.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="usage-info">
            <p>
              <strong>Note:</strong> Token counts are estimates based on character count.
              Actual counts may vary. Pricing is based on Anthropic's standard rates.
            </p>
            <button className="clear-stats-btn" onClick={handleClearStats}>
              Clear All Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}