import { useState, useEffect } from 'react';
import { Input, Modal, Button, message as antMessage } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { Collection } from '../types';
import {
  getCollections,
  createCollection,
  saveCollections,
} from '../services/collection';
import './CollectionsPanel.css';

interface CollectionsPanelProps {
  activeCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
}

const COLLECTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

const COLLECTION_ICONS = ['📂', '📁', '🏷️', '📑', '🗂️', '📚', '💼', '🎯', '🚀', '💡', '🔧', '📝'];

export default function CollectionsPanel({ activeCollectionId, onSelectCollection }: CollectionsPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLLECTION_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(COLLECTION_ICONS[0]);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = () => {
    const loaded = getCollections();
    setCollections(loaded);
  };

  const handleCreateCollection = () => {
    if (!collectionName.trim()) {
      antMessage.error('Please enter a collection name');
      return;
    }
    const newCollection = createCollection(collectionName.trim(), selectedIcon, selectedColor);
    const updatedCollections = [...collections, newCollection];
    setCollections(updatedCollections);
    saveCollections(updatedCollections);
    setCreateModalOpen(false);
    setCollectionName('');
    antMessage.success('Collection created');
  };

  const handleUpdateCollection = () => {
    if (!editingCollection || !collectionName.trim()) return;
    const updated = { ...editingCollection, name: collectionName.trim(), icon: selectedIcon, color: selectedColor };
    const updatedCollections = collections.map(c => c.id === updated.id ? updated : c);
    setCollections(updatedCollections);
    saveCollections(updatedCollections);
    setEditingCollection(null);
    setCollectionName('');
    antMessage.success('Collection updated');
  };

  const handleDeleteCollection = (collection: Collection) => {
    Modal.confirm({
      title: 'Delete Collection',
      content: `Are you sure you want to delete "${collection.name}"? Collections will be removed but conversations will stay.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const updatedCollections = collections.filter(c => c.id !== collection.id);
        setCollections(updatedCollections);
        saveCollections(updatedCollections);
        if (activeCollectionId === collection.id) {
          onSelectCollection(null);
        }
        antMessage.success('Collection deleted');
      },
    });
  };

  const openEditModal = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setSelectedColor(collection.color);
    setSelectedIcon(collection.icon);
  };

  const renderCollectionForm = (onSubmit: () => void, submitText: string) => (
    <div className="collection-form">
      <div className="collection-form-field">
        <label>Name</label>
        <Input
          value={collectionName}
          onChange={e => setCollectionName(e.target.value)}
          placeholder="Collection name"
          autoFocus
          onPressEnter={onSubmit}
        />
      </div>
      <div className="collection-form-field">
        <label>Icon</label>
        <div className="icon-picker">
          {COLLECTION_ICONS.map(icon => (
            <button
              key={icon}
              className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
              onClick={() => setSelectedIcon(icon)}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div className="collection-form-field">
        <label>Color</label>
        <div className="color-picker">
          {COLLECTION_COLORS.map(color => (
            <button
              key={color}
              className={`color-option ${selectedColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </div>
      <div className="collection-form-actions">
        <Button onClick={() => { setCreateModalOpen(false); setEditingCollection(null); setCollectionName(''); }}>
          Cancel
        </Button>
        <Button type="primary" onClick={onSubmit}>
          {submitText}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="collections-panel">
      <div className="collections-header">
        <span className="collections-title">Collections</span>
        <button className="collections-add-btn" onClick={() => setCreateModalOpen(true)}>
          <PlusOutlined />
        </button>
      </div>

      <div className="collections-list">
        <button
          className={`collection-item ${activeCollectionId === null ? 'active' : ''}`}
          onClick={() => onSelectCollection(null)}
        >
          <span className="collection-icon">🌐</span>
          <span className="collection-name">All conversations</span>
        </button>

        {collections.map(collection => (
          <div key={collection.id} className="collection-item-wrapper">
            <button
              className={`collection-item ${activeCollectionId === collection.id ? 'active' : ''}`}
              style={{ '--collection-color': collection.color } as React.CSSProperties}
              onClick={() => onSelectCollection(collection.id)}
            >
              <span className="collection-icon">{collection.icon}</span>
              <span className="collection-name">{collection.name}</span>
            </button>
            <div className="collection-actions">
              <button onClick={() => openEditModal(collection)}><EditOutlined /></button>
              <button onClick={() => handleDeleteCollection(collection)}><DeleteOutlined /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        title="New Collection"
        centered
      >
        {renderCollectionForm(handleCreateCollection, 'Create')}
      </Modal>

      <Modal
        open={!!editingCollection}
        onCancel={() => setEditingCollection(null)}
        footer={null}
        title="Edit Collection"
        centered
      >
        {renderCollectionForm(handleUpdateCollection, 'Save')}
      </Modal>
    </div>
  );
}