import { useState, useEffect } from 'react';
import { Modal, List, Button, Input, message, Tag } from 'antd';
import { ApiOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import '../styles/settings.css';

interface StylePanelProps {
  open: boolean;
  onClose: () => void;
}

interface MCPConnector {
  id: string;
  name: string;
  type: 'http' | 'stdio';
  url?: string;
  status: 'active' | 'inactive';
  lastUsed?: number;
}

const CONNECTORS_KEY = 'claude_mcp_connectors';

function loadConnectors(): MCPConnector[] {
  try {
    const stored = localStorage.getItem(CONNECTORS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveConnectors(connectors: MCPConnector[]) {
  localStorage.setItem(CONNECTORS_KEY, JSON.stringify(connectors));
}

export default function ConnectorsPanel({ open, onClose }: StylePanelProps) {
  const [connectors, setConnectors] = useState<MCPConnector[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    if (open) {
      setConnectors(loadConnectors());
    }
  }, [open]);

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) {
      message.warning('Please fill in name and URL');
      return;
    }

    const connector: MCPConnector = {
      id: `conn-${Date.now()}`,
      name: newName.trim(),
      type: 'http',
      url: newUrl.trim(),
      status: 'inactive',
    };

    const updated = [...connectors, connector];
    setConnectors(updated);
    saveConnectors(updated);
    setNewName('');
    setNewUrl('');
    setShowAdd(false);
    message.success('Connector added');
  };

  const handleDelete = (id: string) => {
    const updated = connectors.filter(c => c.id !== id);
    setConnectors(updated);
    saveConnectors(updated);
    message.success('Connector removed');
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApiOutlined />
          <span>MCP Connectors</span>
        </div>
      }
      footer={null}
      width={600}
      centered
    >
      <div style={{ padding: '16px 0' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
            Connect external tools and data sources via Model Context Protocol
          </p>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(!showAdd)}>
            Add Connector
          </Button>
        </div>

        {showAdd && (
          <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Input
              placeholder="Connector name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Input
              placeholder="Server URL (e.g., http://localhost:3000)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="primary" onClick={handleAdd}>Add</Button>
            </div>
          </div>
        )}

        <List
          dataSource={connectors}
          locale={{ emptyText: 'No connectors configured' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item.id)} />
              ]}
            >
              <List.Item.Meta
                avatar={<ApiOutlined style={{ fontSize: 24, color: '#16baaa' }} />}
                title={item.name}
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#888' }}>{item.url}</div>
                    <Tag color={item.status === 'active' ? 'green' : 'default'} style={{ marginTop: 4 }}>
                      {item.status}
                    </Tag>
                  </div>
                }
              />
            </List.Item>
          )}
        />

        <div style={{ marginTop: 16, padding: 12, background: '#fff7e6', borderRadius: 6, fontSize: 13, color: '#ad6800' }}>
          <strong>Note:</strong> MCP connector functionality requires server-side MCP server support. Add connectors here to configure them, but full integration is pending.
        </div>
      </div>
    </Modal>
  );
}