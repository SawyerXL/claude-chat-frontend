import { useState, useEffect } from 'react';
import { Input, Modal, Button, message as antMessage } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { Project } from '../types';
import {
  getProjects,
  createProject,
  saveProjects,
  getDefaultProjects,
} from '../services/project';
import './ProjectsPanel.css';

interface ProjectsPanelProps {
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

const PROJECT_ICONS = ['📁', '💼', '🏠', '📚', '🎨', '🎯', '🚀', '💡', '🔧', '📝', '🎮', '🌟'];

export default function ProjectsPanel({ activeProjectId, onSelectProject }: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(PROJECT_ICONS[0]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    let loadedProjects = getProjects();
    if (loadedProjects.length === 0) {
      // Initialize with default projects
      const defaults = getDefaultProjects();
      setProjects(defaults);
      // Save to localStorage
      saveProjects(defaults);
    } else {
      setProjects(loadedProjects);
    }
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      antMessage.error('Please enter a project name');
      return;
    }
    const newProject = createProject(projectName.trim(), selectedIcon, selectedColor);
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setCreateModalOpen(false);
    setProjectName('');
    antMessage.success('Project created');
  };

  const handleUpdateProject = () => {
    if (!editingProject || !projectName.trim()) return;
    const updated = { ...editingProject, name: projectName.trim(), icon: selectedIcon, color: selectedColor };
    const updatedProjects = projects.map(p => p.id === updated.id ? updated : p);
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setEditingProject(null);
    setProjectName('');
    antMessage.success('Project updated');
  };

  const handleDeleteProject = (project: Project) => {
    Modal.confirm({
      title: 'Delete Project',
      content: `Are you sure you want to delete "${project.name}"? Conversations will be moved to Uncategorized.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const updatedProjects = projects.filter(p => p.id !== project.id);
        setProjects(updatedProjects);
        saveProjects(updatedProjects);
        if (activeProjectId === project.id) {
          onSelectProject(null);
        }
        antMessage.success('Project deleted');
      },
    });
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setSelectedColor(project.color);
    setSelectedIcon(project.icon);
  };

  const renderProjectForm = (onSubmit: () => void, submitText: string) => (
    <div className="project-form">
      <div className="project-form-field">
        <label>Name</label>
        <Input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="Project name"
          autoFocus
          onPressEnter={onSubmit}
        />
      </div>
      <div className="project-form-field">
        <label>Icon</label>
        <div className="icon-picker">
          {PROJECT_ICONS.map(icon => (
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
      <div className="project-form-field">
        <label>Color</label>
        <div className="color-picker">
          {PROJECT_COLORS.map(color => (
            <button
              key={color}
              className={`color-option ${selectedColor === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </div>
      <div className="project-form-actions">
        <Button onClick={() => { setCreateModalOpen(false); setEditingProject(null); setProjectName(''); }}>
          Cancel
        </Button>
        <Button type="primary" onClick={onSubmit}>
          {submitText}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="projects-panel">
      <div className="projects-header">
        <span className="projects-title">Projects</span>
        <button className="projects-add-btn" onClick={() => setCreateModalOpen(true)}>
          <PlusOutlined />
        </button>
      </div>

      <div className="projects-list">
        {/* All conversations */}
        <button
          className={`project-item ${activeProjectId === null ? 'active' : ''}`}
          onClick={() => onSelectProject(null)}
        >
          <span className="project-icon">🌐</span>
          <span className="project-name">All conversations</span>
        </button>

        {/* Projects */}
        {projects.map(project => (
          <div key={project.id} className="project-item-wrapper">
            <button
              className={`project-item ${activeProjectId === project.id ? 'active' : ''}`}
              style={{ '--project-color': project.color } as React.CSSProperties}
              onClick={() => onSelectProject(project.id)}
            >
              <span className="project-icon">{project.icon}</span>
              <span className="project-name">{project.name}</span>
            </button>
            <div className="project-actions">
              <button onClick={() => openEditModal(project)}><EditOutlined /></button>
              <button onClick={() => handleDeleteProject(project)}><DeleteOutlined /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        title="New Project"
        centered
      >
        {renderProjectForm(handleCreateProject, 'Create')}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editingProject}
        onCancel={() => setEditingProject(null)}
        footer={null}
        title="Edit Project"
        centered
      >
        {renderProjectForm(handleUpdateProject, 'Save')}
      </Modal>
    </div>
  );
}
