import { useState, useEffect } from 'react';
import { Modal } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import type { Artifact } from '../types';
import '../styles/sidebar.css';

interface ArtifactsPanelProps {
  open: boolean;
  onClose: () => void;
  onSelectArtifact?: (artifact: Artifact) => void;
}

const ARTIFACTS_KEY = 'claude_artifacts';

function loadArtifacts(): Artifact[] {
  try {
    const stored = localStorage.getItem(ARTIFACTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export default function ArtifactsPanel({ open, onClose, onSelectArtifact }: ArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => {
    if (open) {
      setArtifacts(loadArtifacts());
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeOutlined />
          <span>Artifacts</span>
        </div>
      }
      width={600}
      centered
      className="artifacts-modal"
    >
      <div className="artifacts-list">
        {artifacts.length === 0 ? (
          <div className="artifacts-empty">
            <p>No artifacts saved yet.</p>
            <p>Artifacts are created when Claude generates code, React components, or other content.</p>
          </div>
        ) : (
          artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="artifact-item"
              onClick={() => {
                onSelectArtifact?.(artifact);
                onClose();
              }}
            >
              <div className="artifact-item-header">
                <span className="artifact-item-title">{artifact.title}</span>
                <span className="artifact-item-type">{artifact.type}</span>
              </div>
              <div className="artifact-item-preview">
                {(artifact.code || artifact.content).slice(0, 100)}...
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}