import { useState, useRef, useEffect } from 'react';
import { message, Modal, Timeline } from 'antd';
import { DownloadIcon, FileIcon, RestoreIcon } from './icons/ClaudeIcons';
import { exportAllData, importData, downloadFile, getLatestBackup, getBackupTimestamps, restoreFromBackup, saveSession } from '../services/session';
import '../styles/settings.css';

export default function ImportExportPanel() {
  const [importing, setImporting] = useState(false);
  const [backups, setBackups] = useState<Array<{ timestamp: number; count: number }>>([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = () => {
    const timestamps = getBackupTimestamps();
    setBackups(timestamps);
  };

  const handleExportAll = async () => {
    try {
      const data = await exportAllData();
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(data, `claude-export-${timestamp}.json`);
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败: ' + err);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importData(text, true);
      if (result.errors.length > 0) {
        message.warning(`导入完成: ${result.imported} 个, ${result.errors.length} 个错误`);
      } else {
        message.success(`成功导入 ${result.imported} 个会话`);
      }
    } catch (err) {
      message.error('导入失败: ' + err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRestore = (timestamp?: number) => {
    Modal.confirm({
      title: '恢复备份',
      content: `确定要从备份恢复会话吗？这将替换当前的所有会话。`,
      okText: '恢复',
      cancelText: '取消',
      async onOk() {
        const sessions = restoreFromBackup(timestamp);
        if (sessions) {
          // Update each session via the session service
          for (const session of sessions) {
            await saveSession(session);
          }
          message.success(`已恢复 ${sessions.length} 个会话`);
          window.dispatchEvent(new CustomEvent('sessions-updated'));
          setShowRestoreModal(false);
        } else {
          message.error('没有可用的备份');
        }
      },
    });
  };

  const latestBackup = getLatestBackup();

  return (
    <div className="settings-section">
      <div className="settings-item">
        <div className="settings-item-info">
          <div className="settings-item-label">导出所有数据</div>
          <div className="settings-item-desc">下载包含所有会话和记忆的备份文件</div>
        </div>
        <button
          className="settings-btn primary"
          onClick={handleExportAll}
        >
          <DownloadIcon /> 导出
        </button>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <div className="settings-item-label">导入数据</div>
          <div className="settings-item-desc">从备份文件恢复会话（会合并到现有数据）</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
        <button
          className="settings-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <FileIcon /> {importing ? '导入中...' : '导入'}
        </button>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <div className="settings-item-label">自动备份恢复</div>
          <div className="settings-item-desc">
            {latestBackup ? (
              <>最近备份: {new Date(latestBackup.timestamp).toLocaleString()} ({latestBackup.count} 个会话)</>
            ) : (
              <>暂无自动备份</>
            )}
          </div>
        </div>
        <button
          className="settings-btn"
          onClick={() => setShowRestoreModal(true)}
          disabled={backups.length === 0}
        >
          <RestoreIcon /> 恢复备份
        </button>
      </div>

      <Modal
        title="从备份恢复"
        open={showRestoreModal}
        onCancel={() => setShowRestoreModal(false)}
        footer={null}
        width={500}
      >
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            选择要恢复的备份点。当前共有 {backups.length} 个备份。
          </p>
          <Timeline
            items={backups.map((b, idx) => ({
              color: idx === 0 ? 'green' : 'blue',
              children: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{new Date(b.timestamp).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{b.count} 个会话</div>
                    {idx === 0 && <span style={{ fontSize: 11, color: '#52c41a' }}>最新</span>}
                  </div>
                  <button
                    className="settings-btn primary"
                    onClick={() => handleRestore(b.timestamp)}
                  >
                    恢复
                  </button>
                </div>
              ),
            }))}
          />
        </div>
      </Modal>

      <div className="settings-info-box">
        <p><strong>导出格式说明：</strong></p>
        <ul>
          <li>导出为 JSON 文件，包含所有会话记录</li>
          <li>记忆/Memory 也会一起导出</li>
          <li>导入时自动合并，不会覆盖现有数据</li>
          <li>如果会话已存在，会更新内容</li>
        </ul>
      </div>
    </div>
  );
}