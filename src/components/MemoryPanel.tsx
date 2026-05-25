import { useState, useEffect } from 'react';
import { Input, Button, Modal, message, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, BulbOutlined, SearchOutlined } from '@ant-design/icons';
import { getMemory, addMemory, updateMemory, deleteMemory, clearMemory, type MemoryEntry } from '../services/memory';
import './MemoryPanel.css';


const CATEGORIES = ['Personal', 'Work', 'Preferences', 'Goals', 'Other'];

export default function MemoryPanel({ open }: { open: boolean }) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [factInput, setFactInput] = useState('');
  const [category, setCategory] = useState('Personal');

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  const loadEntries = () => {
    const memory = getMemory();
    setEntries(memory.entries.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleAdd = () => {
    if (!factInput.trim()) return;
    addMemory(factInput.trim(), category);
    setFactInput('');
    setCategory('Personal');
    setAddModalOpen(false);
    loadEntries();
    message.success('已添加记忆');
  };

  const handleEdit = () => {
    if (!editingEntry || !factInput.trim()) return;
    updateMemory(editingEntry.id, factInput.trim());
    setEditModalOpen(false);
    setEditingEntry(null);
    setFactInput('');
    loadEntries();
    message.success('已更新记忆');
  };

  const handleDelete = (id: string) => {
    deleteMemory(id);
    loadEntries();
    message.success('已删除记忆');
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '清空所有记忆？',
      content: '此操作不可恢复',
      okText: '确认清空',
      cancelText: '取消',
      onOk: () => {
        clearMemory();
        loadEntries();
        message.success('已清空所有记忆');
      },
    });
  };

  const filteredEntries = entries.filter(e =>
    e.fact.toLowerCase().includes(search.toLowerCase())
  );

  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const cat = entry.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {} as Record<string, MemoryEntry[]>);

  return (
    <div className="memory-panel">
      <div className="memory-header">
        <div className="memory-title">
          <BulbOutlined /> 记忆
        </div>
        <div className="memory-actions">
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
            添加
          </Button>
          {entries.length > 0 && (
            <Button size="small" type="text" danger onClick={handleClearAll}>
              清空
            </Button>
          )}
        </div>
      </div>

      <div className="memory-search">
        <Input
          placeholder="搜索记忆..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
      </div>

      <div className="memory-list">
        {filteredEntries.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={search ? '没有找到匹配的记忆' : '还没有记忆，添加一个吧'}
          />
        ) : (
          Object.entries(groupedEntries).map(([category, categoryEntries]) => (
            <div key={category} className="memory-category">
              <div className="category-header">{category}</div>
              {categoryEntries.map(entry => (
                <div key={entry.id} className="memory-item">
                  <div className="memory-fact">{entry.fact}</div>
                  <div className="memory-actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setEditingEntry(entry);
                        setFactInput(entry.fact);
                        setCategory(entry.category || 'Personal');
                        setEditModalOpen(true);
                      }}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(entry.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <Modal
        title="添加记忆"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); setFactInput(''); }}
        onOk={handleAdd}
        okText="添加"
        cancelText="取消"
      >
        <div className="modal-form">
          <div className="form-label">记忆内容</div>
          <Input.TextArea
            rows={3}
            placeholder="输入要记住的信息..."
            value={factInput}
            onChange={e => setFactInput(e.target.value)}
          />
          <div className="form-label" style={{ marginTop: 12 }}>分类</div>
          <div className="category-buttons">
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                type={category === cat ? 'primary' : 'default'}
                size="small"
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑记忆"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingEntry(null); setFactInput(''); }}
        onOk={handleEdit}
        okText="保存"
        cancelText="取消"
      >
        <div className="modal-form">
          <div className="form-label">记忆内容</div>
          <Input.TextArea
            rows={3}
            value={factInput}
            onChange={e => setFactInput(e.target.value)}
          />
          <div className="form-label" style={{ marginTop: 12 }}>分类</div>
          <div className="category-buttons">
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                type={category === cat ? 'primary' : 'default'}
                size="small"
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}