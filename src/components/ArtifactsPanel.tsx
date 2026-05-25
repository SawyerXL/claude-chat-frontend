import { useState, useEffect } from 'react';
import { Modal, Input, Button, Empty, message } from 'antd';
import { CodeOutlined, CopyOutlined, DeleteOutlined, FileOutlined, EditOutlined } from '@ant-design/icons';
import type { Artifact } from '../types';
import '../styles/sidebar.css';

const ARTIFACTS_KEY = 'claude_artifacts';

interface ArtifactsPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectArtifact?: (artifact: Artifact) => void;
}

const ARTIFACT_TYPES = ['All', 'code', 'react', 'html', 'svg', 'document'];
const TYPE_LABELS: Record<string, string> = {
  'All': 'All Types',
  'code': 'Code',
  'react': 'React',
  'html': 'HTML',
  'svg': 'SVG',
  'document': 'Document',
};

function loadArtifacts(): Artifact[] {
  try {
    const stored = localStorage.getItem(ARTIFACTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveArtifacts(artifacts: Artifact[]) {
  localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts));
}

export default function ArtifactsPanel({ open, onClose, onSelectArtifact }: ArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  useEffect(() => {
    if (open) {
      setArtifacts(loadArtifacts());
    }
  }, [open]);

  const filteredArtifacts = artifacts.filter(a => {
    const matchesSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.content?.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === 'All' || a.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCopy = (artifact: Artifact) => {
    navigator.clipboard.writeText(artifact.content || artifact.code || '');
    message.success('Copied to clipboard!');
  };

  const handleDelete = (id: string) => {
    const updated = artifacts.filter(a => a.id !== id);
    saveArtifacts(updated);
    setArtifacts(updated);
    message.success('Artifact deleted');
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: 'Clear all artifacts?',
      content: 'This action cannot be undone.',
      okText: 'Clear All',
      okType: 'danger',
      onOk: () => {
        saveArtifacts([]);
        setArtifacts([]);
        message.success('All artifacts cleared');
      },
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeOutlined />
          <span>Artifacts</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>
            {artifacts.length} items
          </span>
        </div>
      }
      width={700}
      centered
      className="artifacts-modal"
    >
      <div className="artifacts-panel">
        {/* Search and filters */}
        <div className="artifacts-toolbar">
          <Input
            placeholder="Search artifacts..."
            prefix={<FileOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ flex: 1 }}
          />
          {artifacts.length > 0 && (
            <Button danger type="text" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
        </div>

        {/* Type tabs */}
        <div className="artifacts-tabs">
          {ARTIFACT_TYPES.map(type => (
            <Button
              key={type}
              type={selectedType === type ? 'primary' : 'default'}
              size="small"
              onClick={() => setSelectedType(type)}
            >
              {TYPE_LABELS[type]}
            </Button>
          ))}
        </div>

        {/* Artifacts list */}
        <div className="artifacts-list">
          {filteredArtifacts.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={search ? 'No matching artifacts' : 'No artifacts yet'}
            />
          ) : (
            filteredArtifacts.map((artifact) => (
              <div key={artifact.id} className="artifact-item">
                <div className="artifact-item-header">
                  <span className="artifact-item-type">{artifact.type || 'code'}</span>
                  <span className="artifact-item-title">{artifact.title || 'Untitled'}</span>
                  <div className="artifact-item-actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(artifact)}
                      title="Copy"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        onSelectArtifact?.(artifact);
                        onClose();
                      }}
                      title="Use"
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(artifact.id)}
                      title="Delete"
                    />
                  </div>
                </div>
                <div className="artifact-item-preview">
                  {artifact.content?.slice(0, 150) || artifact.code?.slice(0, 150) || ''}
                  {(artifact.content?.length || artifact.code?.length || 0) > 150 ? '...' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}