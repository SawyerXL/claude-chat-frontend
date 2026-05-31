import { useState, useRef } from 'react';
import { message } from 'antd';
import { DownloadIcon, FileIcon } from './icons/ClaudeIcons';
import { exportAllData, importData, downloadFile } from '../services/session';
import '../styles/settings.css';

export default function ImportExportPanel() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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