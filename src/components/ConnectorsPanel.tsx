import { useState, useEffect } from 'react';
import { Modal, List, Button, Input, message, Tag, Space, Tooltip } from 'antd';
import { ApiIcon, PlusIcon, TrashIcon, RefreshIcon, CheckCircleIcon, XCircleIcon } from './icons/ClaudeIcons';
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
  status: 'active' | 'inactive' | 'testing' | 'error';
  lastUsed?: number;
  lastError?: string;
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
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConnectors(loadConnectors());
    }
  }, [open]);

  const updateConnector = (id: string, updates: Partial<MCPConnector>) => {
    const updated = connectors.map(c => c.id === id ? { ...c, ...updates } : c);
    setConnectors(updated);
    saveConnectors(updated);
  };

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) {
      message.warning('请填写名称和 URL');
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
    message.success('连接器已添加');
  };

  const handleDelete = (id: string) => {
    const updated = connectors.filter(c => c.id !== id);
    setConnectors(updated);
    saveConnectors(updated);
    message.success('连接器已删除');
  };

  const handleTestConnection = async (connector: MCPConnector) => {
    if (!connector.url) {
      message.error('请先配置服务器 URL');
      return;
    }

    setTestingId(connector.id);
    updateConnector(connector.id, { status: 'testing', lastError: undefined });

    try {
      // Try to call the MCP server's capabilities endpoint
      // Most MCP servers respond to GET / or /health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(connector.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 405) {
        // 405 Method Not Allowed often means the server is up but expects POST
        updateConnector(connector.id, {
          status: 'active',
          lastUsed: Date.now(),
          lastError: undefined,
        });
        message.success(`${connector.name} 连接成功`);
      } else {
        // Try a POST request to the typical MCP endpoint
        const postResponse = await fetch(connector.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {},
          }),
        });

        if (postResponse.ok) {
          updateConnector(connector.id, {
            status: 'active',
            lastUsed: Date.now(),
            lastError: undefined,
          });
          message.success(`${connector.name} 连接成功`);
        } else {
          throw new Error(`HTTP ${postResponse.status}`);
        }
      }
    } catch (err: any) {
      const errorMsg = err.name === 'AbortError' ? '连接超时 (10秒)' : err.message;
      updateConnector(connector.id, {
        status: 'error',
        lastError: errorMsg,
      });
      message.error(`${connector.name} 连接失败: ${errorMsg}`);
    } finally {
      setTestingId(null);
    }
  };

  const getStatusTag = (status: MCPConnector['status']) => {
    switch (status) {
      case 'active':
        return <Tag color="green" style={{ marginTop: 4 }}>✓ 在线</Tag>;
      case 'inactive':
        return <Tag color="default" style={{ marginTop: 4 }}>○ 未测试</Tag>;
      case 'testing':
        return <Tag color="blue" style={{ marginTop: 4 }}>⏳ 测试中</Tag>;
      case 'error':
        return <Tag color="red" style={{ marginTop: 4 }}>✗ 错误</Tag>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: MCPConnector['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon style={{ color: '#52c41a', fontSize: 16 }} />;
      case 'error':
        return <XCircleIcon style={{ color: '#ff4d4f', fontSize: 16 }} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApiIcon />
          <span>MCP Connectors</span>
        </div>
      }
      footer={null}
      width={650}
      centered
    >
      <div style={{ padding: '16px 0' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, color: '#666', fontSize: 13, flex: 1 }}>
            通过 Model Context Protocol 连接外部工具和数据源
          </p>
          <Button type="primary" icon={<PlusIcon />} onClick={() => setShowAdd(!showAdd)}>
            添加连接器
          </Button>
        </div>

        {showAdd && (
          <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Input
              placeholder="连接器名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Input
              placeholder="服务器 URL (例如 http://localhost:3000)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setShowAdd(false)}>取消</Button>
              <Button type="primary" onClick={handleAdd}>添加</Button>
            </div>
          </div>
        )}

        <List
          dataSource={connectors}
          locale={{ emptyText: '暂无配置的连接器' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Tooltip key="test" title="测试连接">
                  <Button
                    type="text"
                    icon={testingId === item.id ? <RefreshIcon style={{ animation: 'spin 1s linear infinite' }} /> : <ApiIcon />}
                    onClick={() => handleTestConnection(item)}
                    disabled={testingId === item.id}
                  />
                </Tooltip>,
                <Button key="delete" type="text" danger icon={<TrashIcon />} onClick={() => handleDelete(item.id)} />
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ position: 'relative' }}>
                    <ApiIcon style={{ fontSize: 24, color: '#16baaa' }} />
                    <div style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.status === 'active' ? '#52c41a' : item.status === 'error' ? '#ff4d4f' : '#d9d9d9',
                    }} />
                  </div>
                }
                title={
                  <Space>
                    {item.name}
                    {getStatusIcon(item.status)}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#888' }}>{item.url}</div>
                    {getStatusTag(item.status)}
                    {item.lastError && (
                      <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>
                        错误: {item.lastError}
                      </div>
                    )}
                    {item.lastUsed && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        上次使用: {new Date(item.lastUsed).toLocaleString()}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />

        <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 6, fontSize: 13, color: '#52c41a' }}>
          <strong>💡 提示:</strong> 点击测试按钮验证连接器是否正常工作。连接器需要实现 MCP 协议才能被正确识别。
        </div>

        <div style={{ marginTop: 12, padding: 12, background: '#fff7e6', borderRadius: 6, fontSize: 13, color: '#ad6800' }}>
          <strong>注意:</strong> MCP 连接器需要在浏览器中能直接访问的服务端点。完整的功能集成需要后端支持。
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  );
}